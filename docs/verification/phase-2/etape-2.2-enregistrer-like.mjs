// YONA — Phase 2 / Étape 2.2 — Vérification de l'enregistrement du Like (base + serveur + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.2-enregistrer-like.mjs
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
sql("delete from auth.users where email like 'test-enreg-%@example.test';");
const stamp = Date.now();
const PWD = "TestEnreg!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-enreg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Enreg${tag}"}',now(),now(),'','','','');` +
      (gender
        ? `update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male"), // expéditeur
  a: mk("a", "female"), // destinataire valable
  b: mk("b", "female"), // autre destinataire valable
  c: mk("c", "male"), // tiers
  h: mk("h", "female"), // profil masqué
  s: mk("s", "female"), // profil suspendu
  as: mk("as", "female"), // compte suspendu
  i: mk("i", null), // profil non finalisé
  bl: mk("bl", "female"), // a bloqué V
  n: mk("n", null), // expéditeur non finalisé
};
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}';
     update public.profiles set status='suspended' where user_id='${id.s}';
     update public.users set status='suspended' where id='${id.as}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.bl}','${id.v}');`);

async function token(tag) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: emails[tag], password: PWD }),
  });
  return (await r.json()).access_token;
}
const tok = {};
for (const t of ["v", "a", "c", "n"]) tok[t] = await token(t);
async function rest(t, method, path, body) {
  const r = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      ...(t ? { authorization: `Bearer ${tok[t]}` } : {}),
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, rows: Array.isArray(json) ? json : [] };
}
const like = (t, receiver, extra = {}) =>
  rest(t, "POST", "likes", { sender_id: id[t], receiver_id: receiver, ...extra });
const count = (where) => sql(`select count(*) from public.likes where ${where}`);
const from = (s, r) => `sender_id='${id[s]}' and receiver_id='${id[r]}'`;

// ---------- A. Enregistrement nominal ----------
let r = await like("v", id.a);
const row = sql(
  `select kind||'|'||status||'|'||(abs(extract(epoch from now()-created_at))<60) from public.likes where ${from("v", "a")}`,
);
check("Like de V vers A : enregistré (201)", r.status === 201, `HTTP ${r.status}`);
check(
  "Ligne enregistrée : type « like », actif, daté de maintenant",
  row === "like|active|true",
  row,
);

r = await like("v", id.b, { created_at: "2000-01-01T00:00:00Z" });
check(
  "Date falsifiée (2000-01-01) : remplacée par la date du serveur",
  r.status === 201 &&
    sql(
      `select created_at > now() - interval '1 minute' from public.likes where ${from("v", "b")}`,
    ) === "t",
);
r = await rest(
  "v",
  "PATCH",
  `likes?${new URLSearchParams({ sender_id: `eq.${id.v}`, receiver_id: `eq.${id.b}` })}`,
  {
    created_at: "2000-01-01T00:00:00Z",
  },
);
check(
  "Modification de la date d'un Like existant : ignorée",
  sql(
    `select created_at > now() - interval '1 minute' from public.likes where ${from("v", "b")}`,
  ) === "t",
  `HTTP ${r.status}`,
);

// ---------- B. Refus ----------
r = await rest("v", "POST", "likes", { sender_id: id.a, receiver_id: id.c });
check(
  "Like au nom d'un autre membre : refusé",
  r.status === 403 && count(`sender_id='${id.a}'`) === "0",
  `HTTP ${r.status}`,
);
r = await like("v", id.v);
check(
  "Se liker soi-même : refusé",
  r.status >= 400 && count(from("v", "v")) === "0",
  `HTTP ${r.status}`,
);
for (const [t, label] of [
  ["h", "profil masqué"],
  ["s", "profil suspendu"],
  ["as", "compte suspendu"],
  ["i", "profil non finalisé"],
  ["bl", "membre qui a bloqué V"],
]) {
  r = await like("v", id[t]);
  check(
    `Like vers un ${label} : refusé`,
    r.status === 403 && count(from("v", t)) === "0",
    `HTTP ${r.status}`,
  );
}
r = await like("n", id.a);
check(
  "Expéditeur au profil non finalisé : refusé",
  r.status === 403 && count(from("n", "a")) === "0",
  `HTTP ${r.status}`,
);
r = await rest(null, "POST", "likes", { sender_id: id.v, receiver_id: id.c });
check("Visiteur non connecté : refusé", r.status === 401 || r.status === 403, `HTTP ${r.status}`);

// ---------- C. Modifications ----------
const va = new URLSearchParams({ sender_id: `eq.${id.v}`, receiver_id: `eq.${id.a}` });
r = await rest("v", "PATCH", `likes?${va}`, { receiver_id: id.c });
check(
  "Rediriger un Like vers un autre membre : refusé",
  r.status >= 400 && count(from("v", "a")) === "1",
  `HTTP ${r.status}`,
);
sql(`update public.profiles set visibility='hidden' where user_id='${id.a}';`);
r = await rest("v", "PATCH", `likes?${va}`, { status: "withdrawn" });
check(
  "A devenue invisible : V peut retirer son Like",
  r.status === 200 &&
    sql(`select status from public.likes where ${from("v", "a")}`) === "withdrawn",
);
r = await rest("v", "PATCH", `likes?${va}`, { status: "active" });
check(
  "… mais pas le réactiver tant qu'elle est invisible",
  r.status === 403 &&
    sql(`select status from public.likes where ${from("v", "a")}`) === "withdrawn",
  `HTTP ${r.status}`,
);
sql(`update public.profiles set visibility='visible' where user_id='${id.a}';`);
r = await rest("v", "PATCH", `likes?${va}`, { status: "active" });
check(
  "A de nouveau visible : réactivation acceptée",
  r.status === 200 && sql(`select status from public.likes where ${from("v", "a")}`) === "active",
);

// ---------- D. Confidentialité ----------
check(
  "V voit ses Likes envoyés",
  (await rest("v", "GET", `likes?select=receiver_id&sender_id=eq.${id.v}`)).rows.length === 2,
);
check(
  "A ne voit pas qui l'a likée (réservé à une étape ultérieure)",
  (await rest("a", "GET", "likes?select=id")).rows.length === 0,
);
check("Un tiers ne voit aucun Like", (await rest("c", "GET", "likes?select=id")).rows.length === 0);

// ---------- E. Par la page (fonction serveur) + persistance ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  return { ctx, page };
}
let { ctx, page } = await login("c");
await page
  .locator("article")
  .filter({ hasText: "Enrega" })
  .getByRole("button", { name: /^(Liker le profil|Profil de .* aimé)/ })
  .click();
for (let i = 0; i < 50 && count(from("c", "a")) === "0"; i++) await page.waitForTimeout(100);
check(
  "Par la page : Like de C vers A enregistré, expéditeur = membre connecté",
  sql(`select kind||'|'||status from public.likes where ${from("c", "a")}`) === "like|active",
);
await ctx.close();
({ ctx, page } = await login("c"));
check(
  "Nouvelle session : le Like est toujours là (bouton « Aimé »)",
  (
    await page
      .locator("article")
      .filter({ hasText: "Enrega" })
      .getByRole("button", { name: /^(Liker le profil|Profil de .* aimé)/ })
      .textContent()
  )?.trim() === "Aimé",
);
await ctx.close();
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- F. Suppression d'un compte ----------
sql(`delete from auth.users where id='${id.a}';`);
check(
  "Compte de A supprimé : ses Likes reçus disparaissent aussi",
  count(`receiver_id='${id.a}'`) === "0",
);

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-enreg-%@example.test';");
check(
  "Nettoyage : comptes et Likes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-enreg-%'") === "0" &&
    count(`sender_id='${id.v}' or sender_id='${id.c}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
