// YONA — Phase 2 / Étape 2.3 — Vérification : pas de Likes en double (base + serveur + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.3-likes-doublons.mjs
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

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-doublon-%@example.test';");
const stamp = Date.now();
const PWD = "TestDoublon!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-doublon-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Doublon${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male"),
  a: mk("a", "female"),
  b: mk("b", "female"),
  c: mk("c", "female"),
  d: mk("d", "female"),
  e: mk("e", "female"),
  f: mk("f", "female"),
};
async function token(tag) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: emails[tag], password: PWD }),
  });
  return (await r.json()).access_token;
}
const tok = { v: await token("v"), a: await token("a") };
const insert = (t, receiver, prefer = "return=minimal") =>
  fetch(`${API}/rest/v1/likes`, {
    method: "POST",
    headers: {
      apikey: KEY,
      authorization: `Bearer ${tok[t]}`,
      "content-type": "application/json",
      prefer,
    },
    body: JSON.stringify({ sender_id: id[t], receiver_id: receiver }),
  }).then((r) => r.status);
const rows = (s, r) =>
  sql(`select count(*) from public.likes where sender_id='${id[s]}' and receiver_id='${id[r]}'`);

// ---------- A. Base de données ----------
check("1er Like direct V → A : accepté", (await insert("v", id.a)) === 201);
const second = await insert("v", id.a);
check(
  "2e Like direct V → A : refusé (409 doublon), 1 seule ligne",
  second === 409 && rows("v", "a") === "1",
  `HTTP ${second}`,
);
const merged = await insert("v", id.a, "resolution=merge-duplicates,return=minimal");
check(
  "Écriture « fusion » (upsert) V → A : toujours 1 seule ligne",
  rows("v", "a") === "1",
  `HTTP ${merged}`,
);
const burst = await Promise.all(Array.from({ length: 10 }, () => insert("v", id.b)));
check(
  "10 Likes simultanés V → B : 1 accepté, 9 refusés, 1 seule ligne",
  burst.filter((s) => s === 201).length === 1 &&
    burst.filter((s) => s === 409).length === 9 &&
    rows("v", "b") === "1",
  burst.join(","),
);
check(
  "Sens inverse A → V : un Like distinct, autorisé",
  (await insert("a", id.v)) === 201 && rows("a", "v") === "1",
);

// ---------- B. Serveur + page ----------
const browser = await chromium.launch();
const jsErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
let captured = null;
async function open() {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  page.on("request", (r) => {
    if (r.url().includes("/_serverFn/") && r.method() === "POST" && !captured)
      captured = { url: r.url(), headers: r.headers(), body: r.postData() };
  });
  return page;
}
const tab1 = await open();
await tab1.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await tab1.fill("#email", emails.v);
await tab1.fill("#password", PWD);
await tab1.click("button[type=submit]");
await tab1.waitForURL(/\/discover$/, { timeout: 8000 });
const quiet = async (p) => {
  for (let i = 0; i < 80 && (await p.locator("[data-sonner-toast]").count()) > 0; i++)
    await p.waitForTimeout(100);
};
await quiet(tab1);
await tab1.waitForTimeout(500);
const tab2 = await open();
await tab2.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await tab2.waitForTimeout(1200);
const btn = (p, tag) =>
  p
    .locator("article")
    .filter({ hasText: `Doublon${tag}` })
    .getByRole("button");
const toast = async (p) => {
  const list = p.locator("[data-sonner-toast]");
  for (let i = 0; i < 80 && (await list.count()) === 0; i++) await p.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  await quiet(p);
  return t;
};

check(
  "Profils déjà aimés (A, B) affichés « Aimé » dans les deux onglets",
  (await btn(tab1, "a").textContent())?.trim() === "Aimé" &&
    (await btn(tab2, "b").textContent())?.trim() === "Aimé",
);
await btn(tab1, "c").click();
let t = await toast(tab1);
const firstDate = sql(
  `select created_at from public.likes where sender_id='${id.v}' and receiver_id='${id.c}'`,
);
check(
  "Onglet 1 : Like vers C → « Like envoyé. »",
  t === "Like envoyé." && rows("v", "c") === "1",
  t,
);
check(
  "Onglet 2 (pas encore rafraîchi) : C encore affichée « Like »",
  (await btn(tab2, "c").textContent())?.trim() === "Like",
);
await btn(tab2, "c").click();
t = await toast(tab2);
check(
  "Onglet 2 : 2e Like vers C → « Vous aimez déjà ce profil. »",
  t === "Vous aimez déjà ce profil.",
  t,
);
check("… bouton passé à « Aimé »", (await btn(tab2, "c").textContent())?.trim() === "Aimé");
check(
  "… toujours 1 seule ligne, Like d'origine non réécrit (même date)",
  rows("v", "c") === "1" &&
    sql(
      `select created_at from public.likes where sender_id='${id.v}' and receiver_id='${id.c}'`,
    ) === firstDate,
);

// Même appel serveur rejoué 5 fois en parallèle vers D
await btn(tab1, "d").click();
await toast(tab1);
const replay = captured
  ? await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(captured.url, {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(captured.headers).filter(
              ([k]) => !["host", "content-length", "connection"].includes(k),
            ),
          ),
          body: captured.body?.replace(id.c, id.d),
        }).then(async (r) => ({ status: r.status, text: await r.text() })),
      ),
    )
  : [];
check(
  "Appel serveur rejoué 5 fois en parallèle : tous répondent « déjà aimé », 1 seule ligne",
  replay.length === 5 &&
    replay.every(
      (r) =>
        r.status === 200 &&
        /"alreadyLiked"\],"v":\[\{"t":1,"s":"[^"]+"\},\{"t":2,"s":2\}/.test(r.text),
    ) &&
    rows("v", "d") === "1",
  replay.map((r) => r.status).join(","),
);

// Like retiré puis réaimé ; « Pass » puis Like → même ligne
sql(`update public.likes set status='withdrawn' where sender_id='${id.v}' and receiver_id='${id.e}';
     insert into public.likes (sender_id, receiver_id, status) values ('${id.v}','${id.e}','withdrawn') on conflict do nothing;
     insert into public.likes (sender_id, receiver_id, kind) values ('${id.v}','${id.f}','pass');`);
await tab1.reload({ waitUntil: "networkidle" });
await tab1.waitForTimeout(1200);
await btn(tab1, "e").click();
t = await toast(tab1);
check(
  "Like retiré puis réaimé : « Like envoyé. », réactivé sur la même ligne",
  t === "Like envoyé." &&
    rows("v", "e") === "1" &&
    sql(`select status from public.likes where sender_id='${id.v}' and receiver_id='${id.e}'`) ===
      "active",
  t,
);
await btn(tab1, "f").click();
t = await toast(tab1);
check(
  "Profil passé (« Pass ») puis aimé : même ligne, devenue un Like",
  rows("v", "f") === "1" &&
    sql(
      `select kind||'/'||status from public.likes where sender_id='${id.v}' and receiver_id='${id.f}'`,
    ) === "like/active",
  t,
);

await tab1.reload({ waitUntil: "networkidle" });
await tab1.waitForTimeout(1200);
const states = await Promise.all(
  ["a", "b", "c", "d", "e", "f"].map(async (k) => (await btn(tab1, k).textContent())?.trim()),
);
check(
  "Après rechargement : les 6 profils affichés « Aimé »",
  states.every((s) => s === "Aimé"),
  states.join(","),
);
check(
  "Total : exactement 1 ligne par profil aimé (6 pour V)",
  sql(
    `select count(*)||'/'||count(distinct receiver_id) from public.likes where sender_id='${id.v}'`,
  ) === "6/6",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-doublon-%@example.test';");
check(
  "Nettoyage : comptes et Likes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-doublon-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}' or sender_id='${id.a}'`) ===
      "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
