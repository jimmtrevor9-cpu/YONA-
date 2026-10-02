// YONA — Phase 1 / Étape 1.2 — Vérification de l'inscription (/register) dans Chromium.
// Prérequis : Supabase local (Mailpit :54324), application buildée pour ce projet et
// servie sur BASE. MODE=confirmation (défaut) ou MODE=sans-confirmation selon le réglage
// « Confirm email » du projet Supabase testé.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" MODE=confirmation node docs/verification/phase-1/etape-1.2-inscription.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import {
  creerCompte,
  inscrireParEmail,
  lienDeConfirmation,
  remplirParcours,
} from "../outils/inscription.mjs";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const MODE = process.env.MODE ?? "confirmation";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const stamp = Date.now();
const mail = (tag) => `test-inscription-${tag}-${stamp}@example.test`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));

// Parcours (2 octobre 2026) : compte d'abord (e-mail + mot de passe), puis création du
// profil en 4 étapes (voir outils/inscription.mjs).
async function account(email, password) {
  await creerCompte(page, { base: BASE, email, password });
}
async function toast() {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 6000 }).catch(() => {});
  return ((await t.textContent().catch(() => "")) ?? "").trim();
}
const row = (email) =>
  sql(
    `select coalesce(p.first_name,'∅')||'|'||(select count(*) from public.user_roles r where r.user_id=u.id)||'|'||(select count(*) from public.christian_profiles c where c.user_id=u.id)||'|'||(select count(*) from public.preferences c where c.user_id=u.id)||'|'||p.status from public.users u join public.profiles p on p.user_id=u.id where u.email='${email}'`,
  );
/** Confirme le compte (si besoin) et arrive sur la création du profil. */
async function toProfile(email) {
  if (MODE === "confirmation") {
    const link = await lienDeConfirmation(page, email);
    if (link) await page.goto(link, { waitUntil: "networkidle" });
  }
  await page.waitForURL(/\/onboarding$/, { timeout: 10000 }).catch(() => {});
}

// 1. Page et champs (e-mail et mot de passe d'abord ; le prénom vient à l'étape 1)
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
check("Page /register affichée", (await page.title()).includes("Créer un compte"));
await page.getByTestId("signup-start").click();
const attrs = await page.evaluate(() => ({
  email: document.querySelector("#email")?.type,
  pwdMin: document.querySelector("#password")?.minLength,
  labels: [...document.querySelectorAll("label")]
    .map((l) => l.htmlFor)
    .filter(Boolean)
    .join(","),
}));
check(
  "Champs : e-mail de type email, mot de passe 8 caractères minimum",
  attrs.email === "email" && attrs.pwdMin === 8,
  JSON.stringify(attrs),
);
check("Chaque champ a une étiquette", attrs.labels === "email,password", attrs.labels);

// 2. Validations côté navigateur (aucun compte créé)
await account(mail("court"), "Court1!");
check("Mot de passe de 7 caractères refusé (aucun compte créé)", row(mail("court")) === "");
await account("pas-un-email", "TestInscr!2026");
check(
  "Email invalide refusé",
  page.url().endsWith("/register") &&
    !(await page.getByText("Consultez votre boîte mail").isVisible()),
);

// 3. Inscription normale
const ok = mail("ok");
await account(ok, "TestInscr!2026");
if (MODE === "confirmation") {
  check(
    "Inscription → écran « Consultez votre boîte mail »",
    await page.getByText("Consultez votre boîte mail").isVisible(),
  );
  check("L'écran rappelle l'adresse saisie", await page.getByText(ok).isVisible());
} else {
  check(
    "Inscription (sans confirmation) → redirection vers /onboarding",
    page.url().endsWith("/onboarding"),
    page.url(),
  );
}
check(
  "Fiche créée : rôle, profil chrétien, préférences, profil incomplet (prénom à l'étape 1)",
  row(ok) === "∅|1|1|1|incomplete",
  row(ok),
);
await toProfile(ok);
check("Compte confirmé → création du profil (/onboarding)", page.url().endsWith("/onboarding"));

// 4. Prénom composé uniquement d'espaces (étape 1)
await page.getByText("Étape 1 sur 4").waitFor({ timeout: 10000 });
await page.fill("#firstName", "    ");
await page.fill("#birthDate", "1995-06-15");
await page.getByTestId("choice-gender").getByRole("radio", { name: "Femme", exact: true }).click();
await page.getByTestId("signup-next").click();
const blankToast = await toast();
check(
  "Prénom vide (espaces) refusé avec un message clair",
  blankToast.includes("Indiquez votre prénom") &&
    (await page.getByText("Étape 1 sur 4").isVisible()),
  blankToast,
);

// 5. Prénom nettoyé puis profil créé
await remplirParcours(page, { firstName: "  Élise  " });
await page.waitForURL(/\/discover$/, { timeout: 10000 }).catch(() => {});
check("Profil créé : prénom nettoyé, profil actif", row(ok) === "Élise|1|1|1|active", row(ok));

// 6. Prénom très long (au-delà de 60 caractères)
const long = mail("long");
const second = await browser.newPage({ viewport: { width: 390, height: 844 } });
second.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await inscrireParEmail(second, {
  base: BASE,
  firstName: "A".repeat(80),
  email: long,
  password: "TestInscr!2026",
});
await second.waitForURL(/\/discover$/, { timeout: 10000 }).catch(() => {});
const accLong = row(long);
check(
  "Prénom de 80 caractères : pas d'erreur, prénom limité à 60",
  accLong.startsWith("A".repeat(60) + "|") && !accLong.startsWith("A".repeat(61)),
  accLong.slice(0, 70),
);
await second.close();

// 7. Email déjà utilisé
await page.evaluate(() => localStorage.clear());
await page.context().clearCookies();
await account(ok, "TestInscr!2026");
await page.waitForTimeout(1500);
const dupToast = await toast();
check(
  "Email déjà utilisé : aucun second compte",
  sql(`select count(*) from auth.users where email='${ok}'`) === "1",
  dupToast || "(écran de confirmation : l'existence du compte n'est pas révélée)",
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email like 'test-inscription-%@example.test';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
