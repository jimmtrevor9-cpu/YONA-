// YONA — Phase 1 / Étape 1.4 — Vérification de la déconnexion dans Chromium.
// Crée 2 comptes de TEST confirmés (@example.test) puis les supprime.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.4-deconnexion.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
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
const users = { A: `test-deco-a-${stamp}@example.test`, B: `test-deco-b-${stamp}@example.test` };
const pwd = "TestDeco!2026";
for (const [n, e] of Object.entries(users)) {
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${pwd}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Prenom${n}"}',now(),now(),'','','',''); update public.profiles p set onboarding_completed_at = now() from auth.users a where a.id = p.user_id and a.email like 'test-%@example.test' and p.onboarding_completed_at is null;`,
  );
}

const browser = await chromium.launch();
const jsErrors = [];
async function login(ctx, email) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pwd);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  return page;
}
const authKeys = (page) =>
  page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("auth-token")));
const storedSession = (page) =>
  page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.includes("auth-token"));
    return k ? JSON.parse(localStorage.getItem(k)) : null;
  });
const quit = async (page) => {
  await page.getByRole("button", { name: "Quitter" }).click();
  await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
};

// 1. Bouton « Quitter » sur chaque page qui l'affiche
for (const path of ["/discover", "/search", "/profile"]) {
  const ctx = await browser.newContext();
  const page = await login(ctx, users.A);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await quit(page);
  check(`${path} : « Quitter » → /login`, page.url().endsWith("/login"), page.url());
  check(`${path} : session effacée du navigateur`, (await authKeys(page)).length === 0);
  await ctx.close();
}

// 2. Jeton de renouvellement révoqué côté serveur + bouton « Retour »
{
  const ctx = await browser.newContext();
  const page = await login(ctx, users.A);
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  const before = await storedSession(page);
  await quit(page);
  const r = await fetch(`${API}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: before.refresh_token }),
  });
  check(
    "Après déconnexion, l'ancien jeton de renouvellement est refusé par le serveur",
    r.status >= 400,
    `HTTP ${r.status}`,
  );
  await page.goBack();
  await page.waitForTimeout(1500);
  check(
    "Bouton « Retour » du navigateur → pas de retour dans l'espace membre",
    page.url().endsWith("/login"),
    page.url(),
  );
  await ctx.close();
}

// 3. Deux onglets : déconnexion dans l'un → l'autre est aussi déconnecté
{
  const ctx = await browser.newContext();
  const tab1 = await login(ctx, users.A);
  const tab2 = await ctx.newPage();
  await tab2.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  check("Onglet 2 connecté sur /profile", tab2.url().endsWith("/profile"));
  await quit(tab1);
  await tab2.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
  check(
    "Déconnexion dans l'onglet 1 → onglet 2 renvoyé vers /login",
    tab2.url().endsWith("/login"),
    tab2.url(),
  );
  await ctx.close();
}

// 4. Même navigateur, autre membre : aucune donnée du membre précédent
{
  const ctx = await browser.newContext();
  const page = await login(ctx, users.A);
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  const aSeen = await page
    .locator("#firstName")
    .inputValue()
    .catch(() => "");
  await quit(page);
  await page.fill("#email", users.B);
  await page.fill("#password", pwd);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const bSeen = await page
    .locator("#firstName")
    .inputValue()
    .catch(() => "");
  check(
    "Membre suivant : ses propres données, rien du membre précédent",
    aSeen === "PrenomA" && bSeen === "PrenomB",
    `A vu « ${aSeen} », puis B voit « ${bSeen} »`,
  );
  await ctx.close();
}

// 5. Coupure réseau au moment de la déconnexion
{
  const ctx = await browser.newContext();
  const page = await login(ctx, users.A);
  await page.route("**/auth/v1/logout**", (route) => route.abort("internetdisconnected"));
  await quit(page);
  await page.waitForTimeout(1500);
  check(
    "Réseau coupé pendant « Quitter » → quand même déconnecté (/login)",
    page.url().endsWith("/login"),
    page.url(),
  );
  check("Réseau coupé : session effacée du navigateur", (await authKeys(page)).length === 0);
  await ctx.close();
}

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email like 'test-deco-%@example.test';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
