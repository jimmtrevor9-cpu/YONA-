// YONA — Phase 1 / Étape 1.9 — Vérification des informations personnelles
// (prénom, sexe, date de naissance / âge, ville, pays) : onboarding, page Profil, serveur.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.9-infos-personnelles.mjs
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
sql("delete from auth.users where email like 'test-infos-%@example.test';");
const stamp = Date.now();
const mk = (tag, completed) => {
  const e = `test-infos-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('TestInfos!2026',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Infos"}',now(),now(),'','','','');` +
      (completed
        ? `update public.profiles p set onboarding_completed_at = now(), status='active', gender='female', birth_date='1995-06-15' from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return e;
};
const iso = (d) => d.toISOString().slice(0, 10);
const yearsAgo = (n, dayOffset = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - n);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return iso(d);
};
const browser = await chromium.launch();
const jsErrors = [];
async function login(email, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", "TestInfos!2026");
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(discover|onboarding)$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++) {
    await page.waitForTimeout(100);
  }
  return page;
}
const lastToast = async (page) => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 50 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return t;
};

// ---------- A. Onboarding, étape « Vous » ----------
const e1 = mk("onb", false);
let page = await login(e1);
await page.waitForTimeout(700);
const cont = () => page.getByRole("button", { name: "Continuer" }).click();
const heading = () => page.locator("main h1").textContent();
const maxAttr = await page.getAttribute("#birthDate", "max");
check(
  "Calendrier : dates postérieures à « aujourd'hui − 18 ans » non proposées",
  maxAttr === yearsAgo(18),
  `max=${maxAttr}`,
);
check(
  "Ville / pays limités à 100 caractères",
  (await page.getAttribute("#city", "maxlength")) === "100" &&
    (await page.getAttribute("#country", "maxlength")) === "100",
);
await page.fill("#firstName", "   ");
await cont();
let t = await lastToast(page);
check(
  "Prénom vide → étape bloquée avec message",
  (await heading()) === "Vous" && t.includes("prénom"),
  t,
);
await page.fill("#firstName", "Infos");
await cont();
t = await lastToast(page);
check(
  "Sexe non indiqué → étape bloquée avec message",
  (await heading()) === "Vous" && /homme ou une femme/.test(t),
  t,
);
await page.selectOption("#gender", "female");
await cont();
t = await lastToast(page);
check(
  "Date de naissance absente → étape bloquée avec message",
  (await heading()) === "Vous" && t.includes("date de naissance"),
  t,
);
await page.fill("#birthDate", yearsAgo(18, 1));
await cont();
t = await lastToast(page);
check(
  "17 ans (18 ans demain) → étape bloquée : réservé aux majeurs",
  (await heading()) === "Vous" && t.includes("18 ans"),
  t,
);
await page.fill("#birthDate", "1850-01-01");
await cont();
t = await lastToast(page);
check(
  "Date de naissance 1850 → étape bloquée : date invalide",
  (await heading()) === "Vous" && /invalide/i.test(t),
  t,
);
await page.fill("#birthDate", yearsAgo(18));
await cont();
check("Exactement 18 ans aujourd'hui → étape suivante", (await heading()) === "Votre foi");
await page.context().close();

// ---------- B. Page Profil ----------
const e2 = mk("profil", true);
page = await login(e2);
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const exp =
  new Date().getFullYear() -
  1995 -
  (new Date() < new Date(new Date().getFullYear(), 5, 15) ? 1 : 0);
check(
  "Âge affiché correctement (née le 15/06/1995)",
  await page.getByText(`${exp} ans`).isVisible(),
  `${exp} ans attendu`,
);
check(
  "Profil : calendrier limité à 18 ans et plus",
  (await page.getAttribute("#birthDate", "max")) === yearsAgo(18),
);
await page.fill("#firstName", "");
await page.getByRole("button", { name: "Enregistrer" }).click();
t = await lastToast(page);
check(
  "Profil : prénom effacé → refusé avec message",
  t.includes("prénom") &&
    sql(
      `select first_name from public.profiles p join public.users u on u.id=p.user_id where u.email='${e2}'`,
    ) === "Infos",
  t,
);
await page.fill("#firstName", "Infos");
await page.fill("#birthDate", yearsAgo(17));
await page.getByRole("button", { name: "Enregistrer" }).click();
const bubble = await page.evaluate(() => document.querySelector("#birthDate").validationMessage);
t = bubble ? "" : await lastToast(page);
check(
  "Profil : date de naissance de 17 ans → refusée (bulle du navigateur ou message)",
  (bubble.length > 0 || t.includes("18 ans")) &&
    sql(
      `select birth_date from public.profiles p join public.users u on u.id=p.user_id where u.email='${e2}'`,
    ) === "1995-06-15",
  bubble || t,
);
await page.fill("#birthDate", "1990-02-20");
await page.fill("#city", "  Abidjan ");
await page.fill("#country", "Côte d'Ivoire");
await page.getByRole("button", { name: "Enregistrer" }).click();
t = await lastToast(page);
const saved = sql(
  `select birth_date||'|'||city||'|'||country from public.profiles p join public.users u on u.id=p.user_id where u.email='${e2}'`,
);
check(
  "Profil : modifications valides enregistrées (espaces retirés)",
  t.includes("Profil enregistré") && saved === "1990-02-20|Abidjan|Côte d'Ivoire",
  `${t} / ${saved}`,
);
await page.context().close();

// ---------- C. Calcul de l'âge selon le fuseau horaire ----------
for (const tz of ["America/New_York", "Africa/Abidjan", "Asia/Tokyo"]) {
  // Date du jour dans ce fuseau, 30 ans plus tôt : c'est l'anniversaire, là-bas, aujourd'hui.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz })
    .format(new Date())
    .split("-");
  sql(
    `update public.profiles p set birth_date='${Number(y) - 30}-${m}-${d}' from auth.users a where a.id=p.user_id and a.email='${e2}'`,
  );
  page = await login(e2, { timezoneId: tz });
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  check(
    `Anniversaire aujourd'hui (30 ans) affiché « 30 ans » — fuseau ${tz}`,
    await page.getByText("30 ans").isVisible(),
    (await page
      .locator("#birthDate ~ p")
      .textContent()
      .catch(() => "")) ?? "",
  );
  await page.context().close();
}

// ---------- D. Contrôles côté serveur (API directe, sans l'interface) ----------
const tokenFor = async (email) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email, password: "TestInfos!2026" }),
      })
    ).json()
  ).access_token;
const jwt = await tokenFor(e2);
const uid = sql(`select id from auth.users where email='${e2}'`);
const patch = async (body) =>
  (
    await fetch(`${API}/rest/v1/profiles?user_id=eq.${uid}`, {
      method: "PATCH",
      headers: { apikey: KEY, authorization: `Bearer ${jwt}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).status;
check(
  "Serveur : date de naissance de 17 ans refusée",
  (await patch({ birth_date: yearsAgo(17) })) >= 400,
);
check(
  "Serveur : date de naissance future refusée",
  (await patch({ birth_date: "2090-01-01" })) >= 400,
);
check(
  "Serveur : date de naissance avant 1900 refusée",
  (await patch({ birth_date: "1850-01-01" })) >= 400,
);
check("Serveur : ville de 150 caractères refusée", (await patch({ city: "V".repeat(150) })) >= 400);
check(
  "Serveur : pays de 150 caractères refusé",
  (await patch({ country: "P".repeat(150) })) >= 400,
);
check(
  "Serveur : date de naissance valide acceptée",
  (await patch({ birth_date: "1992-03-03" })) < 300,
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql("delete from auth.users where email like 'test-infos-%@example.test';");
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
