// YONA — Phase 1 / Étape 1.12 — Vérification des préférences (personne recherchée).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.12-preferences.mjs
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
sql("delete from auth.users where email like 'test-prefs-%@example.test';");
const stamp = Date.now();
const PWD = "TestPrefs!2026";
const mk = (tag, completed) => {
  const e = `test-prefs-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Prefs${tag}"}',now(),now(),'','','','');` +
      (completed
        ? `update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='male', birth_date='1990-01-01' from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return e;
};
const A = mk("a", false);
const B = mk("b", true);
const prefs = (e) =>
  sql(
    `select coalesce(preferred_gender::text,'∅')||'|'||min_age||'|'||max_age||'|'||coalesce(relationship_goal,'∅')||'|'||coalesce(family_project,'∅') from public.preferences r join public.users u on u.id=r.user_id where u.email='${e}'`,
  );
const status = (e) =>
  sql(
    `select p.status from public.profiles p join public.users u on u.id=p.user_id where u.email='${e}'`,
  );
const token = async (e) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: e, password: PWD }),
      })
    ).json()
  ).access_token;

const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
const toast = async () => {
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
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", A);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/onboarding$/, { timeout: 8000 });
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.selectOption("#gender", "female");
await page.fill("#birthDate", "1995-03-03");
await page.getByRole("button", { name: "Continuer" }).click();
await page.getByRole("button", { name: "Continuer" }).click();

// 1. Étape « Vos attentes »
const opts = await page.locator("#preferredGender option").allTextContents();
check(
  "Sexe recherché : Indifférent / Une femme / Un homme",
  opts.join("/") === "Indifférent/Une femme/Un homme",
  opts.join("/"),
);
check(
  "Âges : 18 à 99 ; proposés 25–40",
  (await page.getAttribute("#minAge", "min")) === "18" &&
    (await page.getAttribute("#maxAge", "max")) === "99" &&
    (await page.inputValue("#minAge")) === "25" &&
    (await page.inputValue("#maxAge")) === "40",
);
check(
  "« Ce que vous recherchez » limité à 100 caractères",
  (await page.getAttribute("#relationshipGoal", "maxlength")) === "100",
);
check(
  "« Votre projet familial » présent, limité à 200 caractères",
  (await page.getAttribute("#familyProject", "maxlength")) === "200",
);

// 2. Tranches d'âge invalides → message, rien d'enregistré
const tryAges = async (min, max) => {
  await page.fill("#minAge", min);
  await page.fill("#maxAge", max);
  await page.getByRole("button", { name: "Terminer" }).click();
  return toast();
};
let t = await tryAges("40", "30");
check(
  "Âge min 40 > max 30 → message clair, rien d'enregistré",
  t.includes("ne peut pas dépasser") && status(A) === "incomplete",
  t,
);
t = await tryAges("25", "");
check("Âge max vidé → message clair", t.includes("entre 18 et 99"), t);
t = await tryAges("17", "30");
check("Âge min 17 → message clair", t.includes("entre 18 et 99"), t);
t = await tryAges("25", "120");
check("Âge max 120 → message clair", t.includes("entre 18 et 99") && status(A) === "incomplete", t);

// 3. Saisie valide
await page.selectOption("#preferredGender", "male");
await page.fill("#minAge", "27");
await page.fill("#maxAge", "38");
await page.fill("#relationshipGoal", "  Mariage chrétien  ");
await page.fill("#familyProject", "Fonder une famille, deux ou trois enfants");
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check(
  "Préférences enregistrées (espaces retirés)",
  prefs(A) === "male|27|38|Mariage chrétien|Fonder une famille, deux ou trois enfants",
  prefs(A),
);

// 4. Réouverture : pré-rempli
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Continuer" }).click();
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "Onboarding rouvert : préférences pré-remplies",
  (await page.inputValue("#preferredGender")) === "male" &&
    (await page.inputValue("#minAge")) === "27" &&
    (await page.inputValue("#familyProject")).startsWith("Fonder une famille"),
);

// 5. Confidentialité : un autre membre ne voit pas les préférences
const jwtB = await token(B);
const uidA = sql(`select id from auth.users where email='${A}'`);
const r = await (
  await fetch(`${API}/rest/v1/preferences?user_id=eq.${uidA}&select=*`, {
    headers: { apikey: KEY, authorization: `Bearer ${jwtB}` },
  })
).json();
check(
  "Un autre membre ne peut pas lire les préférences (privées)",
  Array.isArray(r) && r.length === 0,
);

// 6. Serveur : règles appliquées sans l'interface
const jwtA = await token(A);
const patch = async (body) =>
  (
    await fetch(`${API}/rest/v1/preferences?user_id=eq.${uidA}`, {
      method: "PATCH",
      headers: { apikey: KEY, authorization: `Bearer ${jwtA}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).status;
check("Serveur : âge minimum 17 refusé", (await patch({ min_age: 17 })) >= 400);
check("Serveur : âge maximum 100 refusé", (await patch({ max_age: 100 })) >= 400);
check("Serveur : minimum > maximum refusé", (await patch({ min_age: 50, max_age: 40 })) >= 400);
check(
  "Serveur : objectif de 150 caractères refusé",
  (await patch({ relationship_goal: "G".repeat(150) })) >= 400,
);
check(
  "Serveur : projet familial de 250 caractères refusé",
  (await patch({ family_project: "F".repeat(250) })) >= 400,
);
check(
  "Serveur : modification valide acceptée",
  (await patch({ min_age: 30, max_age: 45 })) < 300 && prefs(A).startsWith("male|30|45|"),
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql("delete from auth.users where email like 'test-prefs-%@example.test';");
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
