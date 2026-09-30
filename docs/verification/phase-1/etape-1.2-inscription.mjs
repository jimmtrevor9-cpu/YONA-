// YONA — Phase 1 / Étape 1.2 — Vérification de l'inscription (/register) dans Chromium.
// Prérequis : Supabase local (Mailpit :54324), application buildée pour ce projet et
// servie sur BASE. MODE=confirmation (défaut) ou MODE=sans-confirmation selon le réglage
// « Confirm email » du projet Supabase testé.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" MODE=confirmation node docs/verification/phase-1/etape-1.2-inscription.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

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

async function fill(firstName, email, password) {
  await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
  await page.fill("#firstName", firstName);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}
async function toast() {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 6000 }).catch(() => {});
  return ((await t.textContent().catch(() => "")) ?? "").trim();
}
const account = (email) =>
  sql(
    `select coalesce(p.first_name,'∅')||'|'||(select count(*) from public.user_roles r where r.user_id=u.id)||'|'||(select count(*) from public.christian_profiles c where c.user_id=u.id)||'|'||(select count(*) from public.preferences c where c.user_id=u.id)||'|'||p.status from public.users u join public.profiles p on p.user_id=u.id where u.email='${email}'`,
  );

// 1. Page et champs
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
check("Page /register affichée", (await page.title()).includes("Créer un compte"));
const attrs = await page.evaluate(() => ({
  first: document.querySelector("#firstName")?.required,
  email: document.querySelector("#email")?.type,
  pwdMin: document.querySelector("#password")?.minLength,
  labels: [...document.querySelectorAll("label")].map((l) => l.htmlFor).join(","),
}));
check(
  "Champs : prénom obligatoire, email de type email, mot de passe 8 min",
  attrs.first && attrs.email === "email" && attrs.pwdMin === 8,
  JSON.stringify(attrs),
);
check("Chaque champ a une étiquette", attrs.labels === "firstName,email,password", attrs.labels);

// 2. Validations côté navigateur (aucun compte créé)
await fill("Test", mail("court"), "Court1!");
check("Mot de passe de 7 caractères refusé (aucun compte créé)", account(mail("court")) === "");
await fill("Test", "pas-un-email", "TestInscr!2026");
check(
  "Email invalide refusé",
  page.url().endsWith("/register") &&
    !(await page.getByText("Consultez votre boîte mail").isVisible()),
);

// 4. Inscription normale
const ok = mail("ok");
await fill("  Élise  ", ok, "TestInscr!2026");
if (MODE === "confirmation") {
  await page
    .getByText("Consultez votre boîte mail")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  check(
    "Inscription → écran « Consultez votre boîte mail »",
    await page.getByText("Consultez votre boîte mail").isVisible(),
  );
  check("L'écran rappelle l'adresse saisie", await page.getByText(ok).isVisible());
} else {
  await page.waitForURL(/\/onboarding$/, { timeout: 8000 }).catch(() => {});
  check(
    "Inscription (sans confirmation) → redirection vers /onboarding",
    page.url().endsWith("/onboarding"),
    page.url(),
  );
}
const acc = account(ok);
check(
  "Fiche créée : prénom nettoyé, rôle, profil chrétien, préférences, profil incomplet",
  acc === "Élise|1|1|1|incomplete",
  acc,
);

// 5. Prénom très long (au-delà de 60 caractères)
const long = mail("long");
await fill("A".repeat(80), long, "TestInscr!2026");
await page.waitForTimeout(2500);
const accLong = account(long);
check(
  "Prénom de 80 caractères : pas d'erreur, prénom limité à 60",
  accLong.startsWith("A".repeat(60) + "|"),
  accLong.slice(0, 70),
);

// 6. Prénom composé uniquement d'espaces
await fill("    ", mail("espaces"), "TestInscr!2026");
await page.waitForTimeout(1500);
const blankToast = await toast();
check(
  "Prénom vide (espaces) refusé avec un message clair",
  account(mail("espaces")) === "" && blankToast.includes("Indiquez votre prénom"),
  blankToast,
);

// 7. Email déjà utilisé
await fill("Autre", ok, "TestInscr!2026");
await page.waitForTimeout(2500);
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
