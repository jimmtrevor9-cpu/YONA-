// YONA — Phase 2 / Étape 2.4 — Vérification : impossible de se liker soi-même (base + serveur + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.4-auto-like.mjs
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
const sqlStatus = (q) => {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
      {
        input: q,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return "accepté";
  } catch (e) {
    return String(e.stderr ?? e).includes("likes_no_self") ? "refusé (likes_no_self)" : "refusé";
  }
};
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-autolike-%@example.test';");
const stamp = Date.now();
const PWD = "TestAutoLike!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-autolike-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Auto${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
// V ne cherche aucun sexe en particulier : son propre profil correspondrait à ses préférences.
const id = { v: mk("v", "male"), a: mk("a", "female"), m: mk("m", "male") };
const self = () => sql(`select count(*) from public.likes where sender_id=receiver_id`);
const tokenRes = await fetch(`${API}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: KEY, "content-type": "application/json" },
  body: JSON.stringify({ email: emails.v, password: PWD }),
});
const tok = (await tokenRes.json()).access_token;
const h = { apikey: KEY, authorization: `Bearer ${tok}`, "content-type": "application/json" };

// ---------- A. Base de données ----------
let r = await fetch(`${API}/rest/v1/likes`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ sender_id: id.v, receiver_id: id.v }),
});
check(
  "API : Like de V vers lui-même refusé",
  r.status === 403 && self() === "0",
  `HTTP ${r.status}`,
);
r = await fetch(`${API}/rest/v1/likes`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ sender_id: id.v, receiver_id: id.v.toUpperCase() }),
});
check(
  "API : même chose avec l'identifiant en MAJUSCULES : refusé",
  r.status === 403 && self() === "0",
  `HTTP ${r.status}`,
);
r = await fetch(`${API}/rest/v1/likes`, {
  method: "POST",
  headers: h,
  body: JSON.stringify({ sender_id: id.v, receiver_id: id.a }),
});
r = await fetch(`${API}/rest/v1/likes?sender_id=eq.${id.v}&receiver_id=eq.${id.a}`, {
  method: "PATCH",
  headers: h,
  body: JSON.stringify({ receiver_id: id.v }),
});
check(
  "API : transformer un Like existant en auto-Like : refusé",
  r.status >= 400 && self() === "0",
  `HTTP ${r.status}`,
);
const direct = sqlStatus(
  `insert into public.likes (sender_id, receiver_id) values ('${id.m}','${id.m}');`,
);
check(
  "Base (même avec les droits du serveur) : auto-Like refusé par la contrainte",
  direct === "refusé (likes_no_self)",
  direct,
);

// ---------- B. Découverte : son propre profil n'apparaît jamais ----------
const feed = await (
  await fetch(`${API}/rest/v1/rpc/discover_profiles`, { method: "POST", headers: h, body: "{}" })
).json();
check(
  "Découverte (serveur) : V absent de sa propre liste",
  Array.isArray(feed) && feed.length > 0 && !feed.some((p) => p.user_id === id.v),
  `${feed.length} profils`,
);
const visible = await (
  await fetch(
    `${API}/rest/v1/profiles?select=user_id&status=eq.active&visibility=eq.visible&user_id=neq.${id.v}`,
    { headers: h },
  )
).json();
check("Recherche (serveur) : V absent", !visible.some((p) => p.user_id === id.v));

// ---------- C. Page et fonction serveur ----------
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
let captured = null;
page.on("request", (q) => {
  if (q.url().includes("/_serverFn/") && q.method() === "POST" && !captured)
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
await page.waitForTimeout(1500);
const titles = await page.locator("article h3").allTextContents();
check(
  "Page Découverte : pas de carte « Autov »",
  titles.length > 0 && !titles.some((t) => t.startsWith("Autov")),
  titles.join(" | "),
);
await page.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const found = await page.locator("article h3").allTextContents();
check(
  "Page Recherche : pas de carte « Autov »",
  !found.some((t) => t.startsWith("Autov")),
  found.join(" | "),
);

// Un Like normal pour capturer l'appel serveur, puis rejeu vers soi-même
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("article").filter({ hasText: "Autom" }).getByRole("button").click();
for (let i = 0; i < 50 && !captured; i++) await page.waitForTimeout(100);
const replay = async (target) => {
  const res = await fetch(captured.url, {
    method: "POST",
    headers: Object.fromEntries(
      Object.entries(captured.headers).filter(
        ([k]) => !["host", "content-length", "connection"].includes(k),
      ),
    ),
    body: captured.body.replace(id.m, target),
  });
  return res.text();
};
let text = captured ? await replay(id.v) : "";
check(
  "Fonction serveur : Like vers soi-même → « Vous ne pouvez pas liker votre propre profil. »",
  text.includes("Vous ne pouvez pas liker votre propre profil.") && self() === "0",
  text.slice(0, 120),
);
text = captured ? await replay(id.v.toUpperCase()) : "";
check(
  "Fonction serveur : identifiant en MAJUSCULES → même message clair",
  text.includes("Vous ne pouvez pas liker votre propre profil.") && self() === "0",
  text.match(/"message":\{"t":1,"s":"([^"]*)"/)?.[1] ?? text.slice(0, 120),
);
check(
  "Aucun auto-Like en base, 1 Like normal (V → M)",
  self() === "0" && sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "2",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-autolike-%@example.test';");
check(
  "Nettoyage : comptes et Likes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-autolike-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
