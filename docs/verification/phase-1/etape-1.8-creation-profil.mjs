// YONA — Phase 1 / Étape 1.8 — Vérification de la création du profil.
// Parcours réel (nouvelle inscription) : compte → e-mail de confirmation (Mailpit) →
// création du profil en 4 étapes. Puis formulaire complet (foi, attentes).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.8-creation-profil.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import { creerCompte, lienDeConfirmation, remplirParcours } from "../outils/inscription.mjs";

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
sql("delete from auth.users where email like 'test-onboarding-%@example.test';");
const email = `test-onboarding-${Date.now()}@example.test`;
const pwd = "TestOnb!2026";
const state = () =>
  sql(`select coalesce(p.first_name,'∅')||'|'||coalesce(p.gender::text,'∅')||'|'||coalesce(p.birth_date::text,'∅')||'|'||coalesce(p.city,'∅')||'|'||coalesce(p.country,'∅')||'|'||coalesce(p.bio,'∅')||'|'||p.status||'|'||p.visibility||'|'||(p.onboarding_completed_at is not null)
       ||'#'||coalesce(c.denomination,'∅')||'|'||coalesce(c.church_attendance,'∅')||'|'||coalesce(c.faith_importance,'∅')||'|'||coalesce(c.marriage_vision,'∅')
       ||'#'||coalesce(r.preferred_gender::text,'∅')||'|'||r.min_age||'|'||r.max_age||'|'||coalesce(r.relationship_goal,'∅')
       from public.users u join public.profiles p on p.user_id=u.id join public.christian_profiles c on c.user_id=u.id join public.preferences r on r.user_id=u.id where u.email='${email}'`);

const browser = await chromium.launch();
const jsErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
const toast = async () => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 60 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
};
const clearToasts = async () => {
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
};
const heading = () => page.locator("main h1").textContent();

// 1. Compte + confirmation, puis création du profil avec une panne pendant l'enregistrement
await creerCompte(page, { base: BASE, email, password: pwd });
await page.getByText("Consultez votre boîte mail").waitFor({ timeout: 8000 });
check("Compte créé → « Consultez votre boîte mail »", true);
check(
  "Avant la création du profil : profil « incomplet »",
  state().split("#")[0].split("|")[6] === "incomplete",
);
const link = await lienDeConfirmation(page, email);
await page.goto(link, { waitUntil: "networkidle" });
await page.waitForURL(/\/onboarding$/, { timeout: 10000 }).catch(() => {});
// Panne pendant l'enregistrement des préférences → le profil ne devient PAS visible
await page.route("**/rest/v1/preferences**", (route) =>
  route.request().method() === "PATCH" ? route.abort("failed") : route.continue(),
);
await remplirParcours(page, {
  firstName: "Élise",
  birthDate: "1996-04-12",
  country: "Cameroun",
  region: "Littoral",
  city: "Douala",
});
const failToast = await toast();
check(
  "Panne réseau → message « Impossible d'enregistrer. Réessayez. », on reste sur /onboarding",
  failToast.includes("Impossible d'enregistrer") && page.url().endsWith("/onboarding"),
  failToast,
);
check(
  "Panne réseau → profil toujours « incomplet », non visible des autres",
  state().split("#")[0].split("|")[6] === "incomplete",
  state().split("#")[0],
);
await page
  .getByText("Étape 1 sur 4")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Panne réseau → parcours ré-affiché avec les réponses (rien à ressaisir)",
  (await heading()) === "Crée ton profil" && (await page.inputValue("#firstName")) === "Élise",
);
check(
  "320 px : pas de défilement horizontal",
  await page.evaluate(() => {
    document.body.style.width = "320px";
    return document.documentElement.scrollWidth <= 390;
  }),
);
await page.unroute("**/rest/v1/preferences**");
await clearToasts();

// 2. Nouvel essai → enregistrement complet
for (let i = 0; i < 3; i++) await page.getByTestId("signup-next").click();
await page.getByTestId("signup-next").click();
await page.locator("#certify").click();
await page.getByTestId("terms-accept").click();
const okToast = await toast();
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check(
  "Nouvel essai → « Votre profil est prêt. » et arrivée sur /discover",
  okToast.includes("Votre profil est prêt") && page.url().endsWith("/discover"),
  okToast,
);
const created =
  "Élise|female|1996-04-12|Douala|Cameroun|∅|active|visible|true#∅|∅|∅|∅#∅|25|45|Mariage";
check("Réponses du parcours enregistrées en base", state() === created, state());
for (let i = 0; i < 6 && (await page.getByRole("dialog").count()) > 0; i++) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
}

// 3. Déconnexion / reconnexion → profil créé : arrivée directe sur /discover
await page.getByRole("button", { name: "Quitter" }).click();
await page.waitForURL(/\/login$/, { timeout: 8000 });
await page.fill("#email", email);
await page.fill("#password", pwd);
await page.click("button[type=submit]");
await page.waitForURL(/\/(discover|onboarding)$/, { timeout: 8000 }).catch(() => {});
check("Reconnexion avec un profil créé → /discover", page.url().endsWith("/discover"), page.url());

// 4. Formulaire complet (Ma foi et mes attentes) : pré-rempli, navigation, enregistrement
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
check(
  "Formulaire complet « Étape 1 sur 3 » « Vous », pré-rempli",
  (await page.getByText("Étape 1 sur 3").isVisible()) &&
    (await heading()) === "Vous" &&
    (await page.inputValue("#firstName")) === "Élise" &&
    (await page.inputValue("#city")) === "Douala" &&
    (await page.inputValue("#gender")) === "female",
);
await page.fill("#bio", "Je crois en l'amour qui construit.");
await page.getByRole("button", { name: "Continuer" }).click();
check("« Continuer » → étape 2 « Votre foi »", (await heading()) === "Votre foi");
await page.fill("#denomination", "Évangélique");
await page.fill("#churchAttendance", "Chaque dimanche");
await page.fill("#faithImportance", "Centrale");
await page.fill("#marriageVision", "Une alliance pour la vie.");
await page.getByRole("button", { name: "Retour" }).click();
check(
  "« Retour » → étape 1 avec les valeurs conservées",
  (await heading()) === "Vous" && (await page.inputValue("#city")) === "Douala",
);
await page.getByRole("button", { name: "Continuer" }).click();
check("Étape 2 : valeurs conservées", (await page.inputValue("#denomination")) === "Évangélique");
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "Étape 3 « Vos attentes » avec les âges choisis à l'inscription (25–45)",
  (await heading()) === "Vos attentes" &&
    (await page.inputValue("#minAge")) === "25" &&
    (await page.inputValue("#maxAge")) === "45",
);
await page.selectOption("#preferredGender", "male");
await page.fill("#minAge", "27");
await page.fill("#maxAge", "38");
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
const expected =
  "Élise|female|1996-04-12|Douala|Cameroun|Je crois en l'amour qui construit.|active|visible|true#Évangélique|Chaque dimanche|Centrale|Une alliance pour la vie.#male|27|38|Mariage";
check(
  "Toutes les réponses enregistrées en base (profil, foi, attentes)",
  state() === expected,
  state(),
);

// 5. Rouvert sans rien changer → aucune donnée perdue
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "Formulaire rouvert : étape 2 pré-remplie",
  (await page.inputValue("#marriageVision")) === "Une alliance pour la vie.",
);
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "Formulaire rouvert : étape 3 pré-remplie (27–38, homme, Mariage)",
  (await page.inputValue("#minAge")) === "27" &&
    (await page.inputValue("#maxAge")) === "38" &&
    (await page.inputValue("#preferredGender")) === "male",
);
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check("« Terminer » sans rien changer → aucune donnée perdue", state() === expected, state());

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email = '${email}';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
