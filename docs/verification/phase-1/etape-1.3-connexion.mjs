// YONA — Phase 1 / Étape 1.3 — Vérification de la connexion (/login) dans Chromium.
// Complète le parcours de l'étape 0.5 (bon/mauvais mot de passe, compte inexistant,
// email non confirmé, déconnexion). Crée un compte de TEST confirmé puis le supprime.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.3-connexion.mjs
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
const email = `test-connexion-${Date.now()}@example.test`;
const pwd = "TestConn!2026";
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('${pwd}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Conn"}',now(),now(),'','','','');`,
);

const browser = await chromium.launch();
const jsErrors = [];
async function freshPage(width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  return page;
}
const toast = async (page) => {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 6000 }).catch(() => {});
  return ((await t.textContent().catch(() => "")) ?? "").trim();
};

// 1. Page et champs
let page = await freshPage();
const a = await page.evaluate(() => ({
  email: [
    document.querySelector("#email")?.type,
    document.querySelector("#email")?.autocomplete,
    document.querySelector("#email")?.required,
  ],
  pwd: [
    document.querySelector("#password")?.type,
    document.querySelector("#password")?.autocomplete,
    document.querySelector("#password")?.required,
  ],
  labels: [...document.querySelectorAll("label")].map((l) => l.htmlFor).join(","),
}));
check("Page /login affichée", (await page.title()).includes("Connexion"));
check(
  "Email : type email, saisie automatique « email », obligatoire",
  a.email.join() === "email,email,true",
  a.email.join(),
);
check(
  "Mot de passe : masqué, saisie automatique « current-password », obligatoire",
  a.pwd.join() === "password,current-password,true",
  a.pwd.join(),
);
check("Chaque champ a une étiquette", a.labels === "email,password", a.labels);

// 2. Email en majuscules + espaces autour
await page.fill("#email", `  ${email.toUpperCase()}  `);
await page.fill("#password", pwd);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check(
  "Email en MAJUSCULES avec espaces autour → connexion réussie",
  page.url().endsWith("/discover"),
  page.url(),
);
check(
  "Message de bienvenue « Bon retour parmi nous. »",
  (await toast(page)).includes("Bon retour"),
);
await page.context().close();

// 3. Touche Entrée
page = await freshPage();
await page.fill("#email", email);
await page.fill("#password", pwd);
await page.press("#password", "Enter");
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check("Touche Entrée → connexion", page.url().endsWith("/discover"), page.url());
await page.context().close();

// 4. Double clic : bouton désactivé pendant la connexion, une seule requête
page = await freshPage();
let tokenCalls = 0;
page.on("request", (r) => r.url().includes("/auth/v1/token") && tokenCalls++);
await page.fill("#email", email);
await page.fill("#password", pwd);
await page.route("**/auth/v1/token**", async (route) => {
  await new Promise((r) => setTimeout(r, 800));
  await route.continue();
});
await page.click("button[type=submit]");
const label = await page.locator("button[type=submit]").textContent();
const disabled = await page.locator("button[type=submit]").isDisabled();
await page.click("button[type=submit]", { force: true }).catch(() => {});
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check(
  "Pendant la connexion : bouton « Connexion… » désactivé",
  disabled && label.includes("Connexion…"),
  `${label} / désactivé=${disabled}`,
);
check("Double clic → une seule tentative envoyée", tokenCalls === 1, `${tokenCalls} requête(s)`);
await page.context().close();

// 5. Mot de passe avec espace final : pas de nettoyage (le mot de passe est exact)
page = await freshPage();
await page.fill("#email", email);
await page.fill("#password", `${pwd} `);
await page.click("button[type=submit]");
const t5 = await toast(page);
check(
  "Mot de passe suivi d'un espace → refusé (pas de modification du mot de passe)",
  t5.includes("incorrect"),
  t5,
);

// 6. Lien « Mot de passe oublié ? » et « Créer un compte »
await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
await page.waitForURL(/\/forgot-password$/, { timeout: 5000 }).catch(() => {});
check("Lien « Mot de passe oublié ? » → /forgot-password", page.url().endsWith("/forgot-password"));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Créer un compte" }).click();
await page.waitForURL(/\/register$/, { timeout: 5000 }).catch(() => {});
check("Lien « Créer un compte » → /register", page.url().endsWith("/register"));
await page.context().close();

// 7. Affichage sur petit téléphone (320 px)
page = await freshPage(320);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth,
);
check("320 px : pas de défilement horizontal", overflow <= 0, `${overflow}px`);
await page.context().close();

// 8. Trop de tentatives : le Supabase local n'applique pas de limite sur la connexion
// par mot de passe (limite active sur les projets hébergés). On simule donc la réponse
// exacte du serveur d'authentification (HTTP 429) pour vérifier le message affiché.
page = await freshPage();
await page.route("**/auth/v1/token**", (route) =>
  route.fulfill({
    status: 429,
    contentType: "application/json",
    body: JSON.stringify({
      code: 429,
      error_code: "over_request_rate_limit",
      msg: "Request rate limit reached",
    }),
  }),
);
await page.fill("#email", email);
await page.fill("#password", pwd);
await page.click("button[type=submit]");
const t8 = await toast(page);
check(
  "Réponse « trop de requêtes » (429) → « Trop de tentatives. Réessayez dans quelques minutes. »",
  t8.includes("Trop de tentatives"),
  t8,
);
check("Après ce refus, on reste sur /login", page.url().endsWith("/login"));
await page.context().close();

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email = '${email}';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
