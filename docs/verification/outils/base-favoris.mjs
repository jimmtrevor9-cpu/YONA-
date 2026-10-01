// YONA — Outil commun des tests de la phase 8 (favoris) : comptes de test temporaires,
// connexion dans le navigateur, appels à la base et vérifications.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
export const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
export const API = process.env.API ?? "http://127.0.0.1:54321";
export const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";

export const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();

/** Erreur renvoyée par la base (texte), ou "" si la requête a réussi. */
export const sqlError = (q) => {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
      {
        input: q,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return "";
  } catch (e) {
    return String(e.stderr ?? e);
  }
};

export function createChecker() {
  const results = [];
  const check = (name, pass, detail = "") => {
    results.push(pass);
    console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const finish = () => {
    const ok = results.filter(Boolean).length;
    console.log(`\n${ok}/${results.length} vérifications réussies`);
    process.exit(ok === results.length ? 0 : 1);
  };
  return { check, finish };
}

/**
 * Crée des comptes de test (préfixe `test-<prefix>-…@example.test`), profils actifs et
 * visibles. `people` : { tag: [genre, prénom] }. Renvoie { id, emails, PWD, cleanup }.
 */
export function createAccounts(prefix, people) {
  sql(`delete from auth.users where email like 'test-${prefix}-%@example.test';`);
  const stamp = Date.now();
  const PWD = "TestFav!2026";
  const emails = {};
  const id = {};
  for (const [tag, [gender, name]] of Object.entries(people)) {
    const e = `test-${prefix}-${tag}-${stamp}@example.test`;
    emails[tag] = e;
    sql(
      `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
       update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04', city='Douala' from auth.users a where a.id=p.user_id and a.email='${e}';`,
    );
    id[tag] = sql(`select id from auth.users where email='${e}'`);
  }
  const cleanup = () => {
    sql(`delete from auth.users where email like 'test-${prefix}-%@example.test';`);
    return sql(`select count(*) from auth.users where email like 'test-${prefix}-%'`) === "0";
  };
  return { id, emails, PWD, cleanup };
}

export const match = (id, x, y) =>
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id[x]}','${id[y]}'), ('${id[y]}','${id[x]}');
     select m.id from public.matches m where m.user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and m.user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid);`,
  );

export async function tokenOf(email, password) {
  const res = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await res.json()).access_token;
}

/** Appel REST de la base au nom d'un membre (token) ou d'un visiteur (null). */
export async function rest(token, path, method = "GET", body) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
}

export async function openBrowser() {
  const browser = await chromium.launch();
  const jsErrors = [];
  const login = async (email, password, width = 390) => {
    const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
    page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.click("button[type=submit]");
    await page.waitForURL(/\/discover$/, { timeout: 8000 });
    for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
      await page.waitForTimeout(100);
    return page;
  };
  return { browser, jsErrors, login };
}

/** Texte de la première notification affichée (attend jusqu'à 10 s). */
export async function toastText(page) {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 100 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
}
