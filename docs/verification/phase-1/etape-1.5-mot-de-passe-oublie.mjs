// YONA — Phase 1 / Étape 1.5 — Vérification de la demande de réinitialisation du mot de
// passe (/forgot-password) dans Chromium, avec la boîte mail de test Mailpit.
// Prérequis : Supabase local avec [auth.email] max_frequency = "60s" (valeur des projets
// hébergés), Mailpit sur :54324, application servie sur BASE (outils/demarrer-test-local.sh).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.5-mot-de-passe-oublie.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";
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
const email = `test-oubli-${stamp}@example.test`;
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('TestOubli!2026',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');`,
);
const mails = async (to) =>
  (await (await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(to)}`)).json())
    .messages ?? [];

const browser = await chromium.launch();
const jsErrors = [];
async function openPage(width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  return page;
}
async function submit(page, value) {
  await page.fill("#email", value);
  await page.click("button[type=submit]");
}
const confirmation = (page) => page.getByText("un lien de réinitialisation vient d'être envoyé");
const toast = async (page) => {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 6000 }).catch(() => {});
  return ((await t.textContent().catch(() => "")) ?? "").trim();
};

// 1. Page et champ
let page = await openPage();
const f = await page.evaluate(() => {
  const i = document.querySelector("#email");
  return [i?.type, i?.autocomplete, i?.required, document.querySelector("label")?.htmlFor].join(
    ",",
  );
});
check(
  "Page « Mot de passe oublié » et champ email (type, saisie automatique, obligatoire, étiquette)",
  f === "email,email,true,email",
  f,
);
check(
  "320 px : pas de défilement horizontal",
  await (
    await openPage(320)
  ).evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);

// 2. Email invalide bloqué
await submit(page, "pas-un-email");
check("Email invalide : formulaire non envoyé", !(await confirmation(page).isVisible()));

// 3. Compte existant (saisi en MAJUSCULES avec espaces) : 1 seule requête même avec double clic
page = await openPage();
let calls = 0;
page.on("request", (r) => r.url().includes("/auth/v1/recover") && calls++);
await page.route("**/auth/v1/recover**", async (route) => {
  await new Promise((r) => setTimeout(r, 700));
  await route.continue();
});
await page.fill("#email", `  ${email.toUpperCase()}  `);
await page.click("button[type=submit]");
const pending = [
  await page.locator("button[type=submit]").textContent(),
  await page.locator("button[type=submit]").isDisabled(),
];
await page.click("button[type=submit]", { force: true, timeout: 1000 }).catch(() => {});
await confirmation(page)
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Pendant l'envoi : bouton « Envoi… » désactivé",
  pending[0].includes("Envoi…") && pending[1],
  pending.join(" / "),
);
check("Double clic → une seule demande envoyée", calls === 1, `${calls}`);
check("Écran de confirmation neutre affiché", await confirmation(page).isVisible());
await page.waitForTimeout(1500);
const received = await mails(email);
check(
  "Email de réinitialisation reçu (adresse saisie en majuscules)",
  received.length === 1,
  `${received.length} email(s) — « ${received[0]?.Subject ?? ""} »`,
);
if (received[0]) {
  const full = await (await fetch(`${MAILPIT}/api/v1/message/${received[0].ID}`)).json();
  const link =
    (full.HTML || full.Text)
      .match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]
      ?.replaceAll("&amp;", "&") ?? "";
  const redirect = new URL(link).searchParams.get("redirect_to") ?? "";
  check(
    "Le lien renvoie vers /reset-password du site",
    redirect === `${BASE}/reset-password`,
    redirect,
  );
  if (process.env.TEMPLATE_FR !== "0") {
    check(
      "Email en français (modèle supabase/templates)",
      received[0].Subject === "Réinitialisez votre mot de passe YONA" &&
        (full.HTML ?? "").includes("Choisir un nouveau mot de passe"),
      received[0].Subject,
    );
    const p2 = await openPage();
    await p2.goto(link, { waitUntil: "networkidle" });
    await p2.waitForURL(/\/reset-password/, { timeout: 8000 }).catch(() => {});
    check(
      "Bouton de l'email → page « Nouveau mot de passe » prête",
      p2.url().includes("/reset-password") &&
        (await p2.getByText("Choisissez un mot de passe solide").isVisible()),
      p2.url().split("#")[0],
    );
  }
}

// 4. Compte inexistant : même écran, aucun email (ne révèle pas qui est inscrit)
page = await openPage();
const unknown = `inconnu-${stamp}@example.test`;
await submit(page, unknown);
await confirmation(page)
  .waitFor({ timeout: 8000 })
  .catch(() => {});
await page.waitForTimeout(1500);
check("Compte inexistant : même écran de confirmation", await confirmation(page).isVisible());
check("Compte inexistant : aucun email envoyé", (await mails(unknown)).length === 0);

// 5. Nouvelle demande moins de 60 s après : message clair, pas d'email en plus
page = await openPage();
await submit(page, email);
const t5 = await toast(page);
await page.waitForTimeout(1000);
check(
  "Nouvelle demande dans la minute → message clair en français",
  /patient|minute|seconde|Trop de tentatives/i.test(t5) && !t5.includes("Une erreur est survenue"),
  t5 || "(aucun message)",
);
check("Nouvelle demande dans la minute → pas de 2e email", (await mails(email)).length === 1);

// 6. Lien « Retour à la connexion »
await page.getByRole("link", { name: "Retour à la connexion" }).click();
await page.waitForURL(/\/login$/, { timeout: 5000 }).catch(() => {});
check("Lien « Retour à la connexion » → /login", page.url().endsWith("/login"));

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email = '${email}';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
