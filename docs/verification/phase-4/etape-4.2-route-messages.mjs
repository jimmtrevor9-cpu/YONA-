// YONA — Phase 4 / Étape 4.2 — Vérification de la route /messages (accès protégé + navigation).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.2-route-messages.mjs
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

sql("delete from auth.users where email like 'test-routemsg-%@example.test';");
const email = `test-routemsg-${Date.now()}@example.test`;
const PWD = "TestRouteMsg!2026";
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Routemsg"}',now(),now(),'','','','');
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
await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check("Sans connexion : /messages renvoie vers /login", page.url().endsWith("/login"), page.url());

// B. Connexion puis accès
await page.fill("#email", email);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
await page.locator("nav a").first().waitFor({ timeout: 8000 });
const tabs = (await page.locator("nav a").allTextContents()).map((t) => t.trim());
check(
  "Barre du bas : Découvrir, Recherche, Matchs, Messages, Profil",
  tabs.join(",") === "Découvrir,Recherche,Matchs,Messages,Profil",
  tabs.join(","),
);
await page.getByRole("link", { name: "Messages" }).click();
await page.waitForURL(/\/messages$/, { timeout: 5000 }).catch(() => {});
check("Onglet « Messages » → page /messages", page.url().endsWith("/messages"), page.url());
await page.getByTestId("messages-page").waitFor({ timeout: 5000 });
check(
  "En-tête « Messages » et contenu affichés",
  (await page.locator("header h1").textContent())?.trim() === "Messages" &&
    (await page.getByTestId("messages-page").isVisible()),
);
check(
  "Titre de l'onglet du navigateur",
  (await page.title()).startsWith("Messages —"),
  await page.title(),
);
check(
  "Onglet « Messages » signalé comme page courante",
  (await page.getByRole("link", { name: "Messages" }).getAttribute("aria-current")) === "page",
);

// C. Chargement direct, rechargement, retour
await page.reload({ waitUntil: "networkidle" });
await page
  .getByTestId("messages-page")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Rechargement : reste sur /messages, page affichée",
  page.url().endsWith("/messages") && (await page.getByTestId("messages-page").isVisible()),
);
await page.goBack({ waitUntil: "networkidle" });
check("Bouton Retour : revient à /discover", page.url().endsWith("/discover"), page.url());
for (const path of ["/search", "/profile"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
}
check(
  "L'onglet « Messages » est présent sur les autres pages",
  (await page.getByRole("link", { name: "Messages" }).count()) === 1,
);
const other = await ctx.newPage();
other.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await other.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await other
  .getByTestId("messages-page")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Nouvel onglet, adresse /messages tapée directement : page affichée",
  other.url().endsWith("/messages") && (await other.getByTestId("messages-page").isVisible()),
);

// D. Petit écran
await other.setViewportSize({ width: 320, height: 640 });
await other.waitForTimeout(300);
check(
  "Petit écran (320 px) : tous les onglets visibles, sans débordement",
  (await other.locator("nav a").count()) === 5 &&
    !(await other.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);

// E. Déconnexion
await other.getByRole("button", { name: "Quitter" }).click();
await other.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
await other.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await other.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check(
  "Après « Quitter » : /messages renvoie vers /login",
  other.url().endsWith("/login"),
  other.url(),
);
check(
  "Aucune erreur JavaScript ni erreur d'hydratation",
  jsErrors.length === 0 && consoleErrors.length === 0,
  [...jsErrors, ...consoleErrors].join(" | "),
);
await browser.close();

sql("delete from auth.users where email like 'test-routemsg-%@example.test';");
check(
  "Nettoyage : compte de test supprimé",
  sql("select count(*) from auth.users where email like 'test-routemsg-%'") === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
