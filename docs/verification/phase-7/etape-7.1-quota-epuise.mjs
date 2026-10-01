// YONA — Phase 5 / Étape 7.1 — Vérification de la détection du quota épuisé.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.1-quota-epuise.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
// Erreur renvoyée par la base (texte), ou "" si la requête a réussi.
const sqlError = (q) => {
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
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-u71-%@example.test';");
const stamp = Date.now();
const PWD = "TestU71!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u71-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Qpaul"),
  a: mk("a", "female", "Qgrace"),
  b: mk("b", "female", "Qruth"),
  c: mk("c", "male", "Qtiers"),
};
for (const t of ["a", "b"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (x, y) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const usage = (c) =>
  sql(
    `select string_agg(user_id::text || ':' || free_messages_used, ',' order by user_id) from public.conversation_user_usage where conversation_id='${c}'`,
  );
const tokenOf = async (tag) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: emails[tag], password: PWD }),
      })
    ).json()
  ).access_token;
const api = async (tag, path, method = "GET", body) => {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tag ? await tokenOf(tag) : KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
};

const used = (c, tag) =>
  sql(
    `select free_messages_used from public.conversation_user_usage where conversation_id='${c}' and user_id='${id[tag]}'`,
  );
const count = (c) => sql(`select count(*) from public.messages where conversation_id='${c}'`);
const send = (tag, c, content) =>
  api(tag, "rpc/send_message", "POST", { _conversation_id: c, _content: content });
const cA = conv("v", "a");
const cB = conv("v", "b");

const browser = await chromium.launch();
const jsErrors = [];
async function login(tag) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 800 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  return page;
}
const openConv = async (page, c) => {
  await page.goto(`${BASE}/messages/${c}`, { waitUntil: "networkidle" });
  await page.getByTestId("message-composer").waitFor({ timeout: 8000 });
};
const waitCount = async (c, n) => {
  for (let i = 0; i < 60 && count(c) !== String(n); i++)
    await new Promise((r) => setTimeout(r, 100));
  return count(c);
};

const LIMIT_MSG = "Vous avez utilisé vos 3 messages gratuits dans cette conversation.";
const field = (p) => p.getByLabel(/^Votre message à /);
const button = (p) => p.getByRole("button", { name: /^(Envoyer le message|Envoi du message…)$/ });
const toastText = async (p) => {
  const list = p.locator("[data-sonner-toast]");
  for (let i = 0; i < 100 && (await list.count()) === 0; i++) await p.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
};

const quotaText = async (p) => {
  const q = p.getByTestId("message-quota");
  for (let i = 0; i < 50 && (await q.count()) === 0; i++) await p.waitForTimeout(100);
  return ((await q.textContent().catch(() => "")) ?? "").trim();
};
const waitQuota = async (p, expected) => {
  let t = "";
  for (let i = 0; i < 60; i++) {
    t = await quotaText(p);
    if (t === expected) return t;
    await p.waitForTimeout(100);
  }
  return t;
};
const L3 = "3 messages gratuits restants dans cette conversation";
const L2 = "2 messages gratuits restants dans cette conversation";
const L1 = "1 message gratuit restant dans cette conversation";
const L0 = "Vous avez utilisé vos 3 messages gratuits dans cette conversation.";

const quota = async (tag, c) =>
  (await api(tag, "rpc/get_message_quota", "POST", { _conversation_id: c })).json?.[0];

// A. Signal du serveur
let q = await quota("v", cA);
check(
  "0 message utilisé : non épuisé (3 restants)",
  q?.exhausted === false && q?.remaining === 3,
  JSON.stringify(q),
);
const states = [];
for (let i = 1; i <= 3; i++) {
  await send("v", cA, `Message ${i}`);
  q = await quota("v", cA);
  states.push(`${q.used}:${q.exhausted}`);
}
check(
  "1 et 2 messages : non épuisé ; 3e message : épuisé",
  states.join(",") === "1:false,2:false,3:true",
  states.join(","),
);
check(
  "Signal cohérent avec le refus d'envoi du serveur",
  (await send("v", cA, "4e")).text.includes("free_limit_reached") &&
    (await quota("v", cA)).exhausted === true,
);
check("L'autre participante : non épuisée", (await quota("a", cA)).exhausted === false);
check("Autre conversation de Paul : non épuisée", (await quota("v", cB)).exhausted === false);
let r = await api("c", "rpc/get_message_quota", "POST", { _conversation_id: cA });
check(
  "Personne extérieure : aucun signal (conversation indisponible)",
  r.text.includes("conversation_unavailable"),
);
r = await api(null, "rpc/get_message_quota", "POST", { _conversation_id: cA });
check("Sans connexion : refusé", r.status >= 400, String(r.status));

// B. Persistance et application
check(
  "Signal persistant (lu à nouveau) : toujours épuisé",
  (await quota("v", cA)).exhausted === true,
);
const pv = await login("v");
let quotaPayload = null;
pv.on("response", async (res) => {
  if (res.url().includes("/rpc/get_message_quota"))
    quotaPayload = await res.json().catch(() => null);
});
await openConv(pv, cA);
for (let i = 0; i < 50 && !quotaPayload; i++) await pv.waitForTimeout(100);
check(
  "L'application reçoit le signal « épuisé » du serveur",
  quotaPayload?.[0]?.exhausted === true,
  JSON.stringify(quotaPayload),
);
check(
  "Écran : champ fermé et « Vous avez utilisé vos 3 messages gratuits… »",
  (
    await waitQuota(pv, "Vous avez utilisé vos 3 messages gratuits dans cette conversation.")
  ).startsWith("Vous avez utilisé") && (await field(pv).isDisabled()),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u71-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-u71-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
