// YONA — Phase 3 / Étape 3.5 — Vérification de la route /matches (accès protégé + navigation).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.5-route-matches.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
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

sql("delete from auth.users where email like 'test-routematch-%@example.test';");
const email = `test-routematch-${Date.now()}@example.test`;
const PWD = "TestRouteMatch!2026";
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Routem"}',now(),now(),'','','','');
   update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='male', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${email}';`,
);

const browser = await chromium.launch();
const jsErrors = [];
const consoleErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
page.on("console", (m) => {
  if (m.type() === "error" && /#418|hydrat/i.test(m.text()))
    consoleErrors.push(m.text().slice(0, 120));
});

// A. Sans connexion
await page.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check("Sans connexion : /matches renvoie vers /login", page.url().endsWith("/login"), page.url());

// B. Connexion puis accès
await page.fill("#email", email);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
await page.locator("nav a").first().waitFor({ timeout: 8000 });
const tabs = (await page.locator("nav a").allTextContents()).map((t) => t.trim());
check(
  "Barre du bas : Découvrir, Recherche, Matchs, Profil",
  tabs.join(",") === "Découvrir,Recherche,Matchs,Profil",
  tabs.join(","),
);
await page.getByRole("link", { name: "Matchs" }).click();
await page.waitForURL(/\/matches$/, { timeout: 5000 }).catch(() => {});
check("Onglet « Matchs » → page /matches", page.url().endsWith("/matches"), page.url());
await page.getByTestId("matches-page").waitFor({ timeout: 5000 });
check(
  "En-tête « Mes Matchs » et contenu affichés",
  (await page.locator("header h1").textContent())?.trim() === "Mes Matchs" &&
    (await page.getByTestId("matches-page").isVisible()),
);
check(
  "Titre de l'onglet du navigateur",
  (await page.title()).startsWith("Mes Matchs —"),
  await page.title(),
);
check(
  "Onglet « Matchs » signalé comme page courante",
  (await page.getByRole("link", { name: "Matchs" }).getAttribute("aria-current")) === "page",
);

// C. Chargement direct, rechargement, retour
await page.reload({ waitUntil: "networkidle" });
await page
  .getByTestId("matches-page")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Rechargement : reste sur /matches, page affichée",
  page.url().endsWith("/matches") && (await page.getByTestId("matches-page").isVisible()),
);
await page.goBack({ waitUntil: "networkidle" });
check("Bouton Retour : revient à /discover", page.url().endsWith("/discover"), page.url());
for (const path of ["/search", "/profile"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
}
check(
  "L'onglet « Matchs » est présent sur les autres pages",
  (await page.getByRole("link", { name: "Matchs" }).count()) === 1,
);
const other = await ctx.newPage();
other.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await other.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
await other
  .getByTestId("matches-page")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Nouvel onglet, adresse /matches tapée directement : page affichée",
  other.url().endsWith("/matches") && (await other.getByTestId("matches-page").isVisible()),
);

// D. Petit écran
await other.setViewportSize({ width: 320, height: 640 });
await other.waitForTimeout(300);
check(
  "Petit écran (320 px) : 4 onglets visibles, sans débordement",
  (await other.locator("nav a").count()) === 4 &&
    !(await other.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);

// E. Déconnexion
await other.getByRole("button", { name: "Quitter" }).click();
await other.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
await other.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
await other.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check(
  "Après « Quitter » : /matches renvoie vers /login",
  other.url().endsWith("/login"),
  other.url(),
);
check(
  "Aucune erreur JavaScript ni erreur d'hydratation",
  jsErrors.length === 0 && consoleErrors.length === 0,
  [...jsErrors, ...consoleErrors].join(" | "),
);
await browser.close();

sql("delete from auth.users where email like 'test-routematch-%@example.test';");
check(
  "Nettoyage : compte de test supprimé",
  sql("select count(*) from auth.users where email like 'test-routematch-%'") === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
