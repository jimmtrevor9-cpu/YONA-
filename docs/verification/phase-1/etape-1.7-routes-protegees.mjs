// YONA — Phase 1 / Étape 1.7 — Vérification des routes protégées dans Chromium.
// Complète l'étape 0.5 (redirection de /discover, pages chargées une fois connecté,
// compte supprimé). Compte de TEST confirmé créé puis supprimé.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.7-routes-protegees.mjs
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
sql("delete from auth.users where email like 'test-routes-%@example.test';");
const email = `test-routes-${Date.now()}@example.test`;
const pwd = "TestRoutes!2026";
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('${pwd}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Routes"}',now(),now(),'','','',''); update public.profiles p set onboarding_completed_at = now() from auth.users a where a.id = p.user_id and a.email like 'test-%@example.test' and p.onboarding_completed_at is null;`,
);

const PROTECTED = {
  "/discover": "Découvrir",
  "/search": "Recherche",
  "/profile": "Mon profil",
  "/onboarding": "Vous",
};
const PUBLIC = ["/", "/login", "/register", "/forgot-password", "/reset-password"];
const browser = await chromium.launch();
const jsErrors = [];
// Enregistre tout texte de page protégée apparu, même une fraction de seconde.
const watcher = () => {
  window.__seen = [];
  new MutationObserver(() => {
    const h = document.querySelector("header h1, main h1");
    if (h) window.__seen.push(h.textContent);
  }).observe(document, { childList: true, subtree: true, characterData: true });
};
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(watcher);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(`${page.url()} ${String(e).slice(0, 100)}`));
  return page;
}

// 1. Visiteur non connecté : chargement direct de chaque page protégée
for (const [path, title] of Object.entries(PROTECTED)) {
  const page = await newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
  const seen = await page.evaluate(() => window.__seen);
  check(`Non connecté : ${path} → /login`, page.url().endsWith("/login"), page.url());
  check(
    `Non connecté : ${path} n'affiche jamais son contenu, même un instant`,
    !seen.some((t) => t?.includes(title)),
    seen.filter(Boolean).slice(0, 3).join(" | "),
  );
  const html = await (await fetch(`${BASE}${path}`)).text();
  check(
    `Non connecté : le serveur n'envoie aucun contenu de ${path}`,
    !html.includes(`>${title}<`),
  );
  await page.context().close();
}

// 2. Visiteur non connecté : navigation interne vers une page protégée
{
  const page = await newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    history.pushState({}, "", "/profile");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
  check(
    "Non connecté : navigation interne vers /profile → /login",
    page.url().endsWith("/login"),
    page.url(),
  );
  await page.context().close();
}

// 3. Pages publiques accessibles sans connexion
for (const path of PUBLIC) {
  const page = await newPage();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  check(
    `Public : ${path} reste accessible sans connexion`,
    new URL(page.url()).pathname === path,
    page.url(),
  );
  await page.context().close();
}

// 4. Page inexistante → page 404 en français
{
  const page = await newPage();
  const res = await page.goto(`${BASE}/page-qui-n-existe-pas`, { waitUntil: "networkidle" });
  check(
    "Page inexistante → 404 « Page introuvable »",
    res.status() === 404 && (await page.getByText("Page introuvable").isVisible()),
    `HTTP ${res.status()}`,
  );
  await page.getByRole("link", { name: "Retour à l'accueil" }).click();
  await page.waitForURL(`${BASE}/`, { timeout: 5000 }).catch(() => {});
  check("404 : lien « Retour à l'accueil »", new URL(page.url()).pathname === "/");
  await page.context().close();
}

// 5. Session falsifiée dans le navigateur (jeton modifié) → refusée, retour à /login
{
  const page = await newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pwd);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  await page.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.includes("auth-token"));
    const s = JSON.parse(localStorage.getItem(k));
    const [h, p] = s.access_token.split(".");
    const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
    payload.sub = "00000000-0000-4000-8000-000000000000";
    s.access_token = `${h}.${btoa(JSON.stringify(payload)).replace(/=+$/, "")}.signature-falsifiee`;
    s.refresh_token = "jeton-falsifie";
    localStorage.setItem(k, JSON.stringify(s));
  });
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(2000);
  check(
    "Session falsifiée → refusée, retour stable sur /login",
    page.url().endsWith("/login"),
    page.url(),
  );
  check(
    "Session falsifiée → effacée du navigateur",
    (await page.evaluate(
      () => Object.keys(localStorage).filter((k) => k.includes("auth-token")).length,
    )) === 0,
  );
  await page.context().close();
}

// 6. Membre connecté : navigation entre les pages protégées via le menu du bas
{
  const page = await newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pwd);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (const [label, path] of [
    ["Recherche", "/search"],
    ["Profil", "/profile"],
    ["Découvrir", "/discover"],
  ]) {
    await page.locator("nav").getByRole("link", { name: label }).click();
    await page.waitForURL(new RegExp(`${path}$`), { timeout: 5000 }).catch(() => {});
    check(`Connecté : menu « ${label} » → ${path}`, page.url().endsWith(path), page.url());
  }
  await page.context().close();
}

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email = '${email}';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
