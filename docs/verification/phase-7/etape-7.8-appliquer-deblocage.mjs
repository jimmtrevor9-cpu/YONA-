// YONA — Phase 5 / Étape 7.8 — Vérification de l'application du déblocage à la conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.8-appliquer-deblocage.mjs
import { execFileSync } from "node:child_process";
import { spawn } from "node:child_process";
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
sql("delete from auth.users where email like 'test-u78-%@example.test';");
const stamp = Date.now();
const PWD = "TestU78!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u78-${tag}-${stamp}@example.test`;
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

const offer = (p) => p.getByTestId("unlock-offer");
const waitOffer = async (p, present) => {
  for (let i = 0; i < 60 && ((await offer(p).count()) === 1) !== present; i++)
    await p.waitForTimeout(100);
  return (await offer(p).count()) === 1;
};

const SERVICE_KEY = execFileSync("bash", [
  "-c",
  "cd /var/tmp/yona-local && /var/tmp/sbcli/node_modules/.bin/supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY' | cut -d= -f2- | tr -d '\"'",
])
  .toString()
  .trim();
const pay = (tag) =>
  sql(
    `select status || '|' || coalesce(provider_transaction_id, '') || '|' || (metadata ? 'confirmed_at') from public.payments where user_id='${id[tag]}' order by created_at desc limit 1`,
  );
const service = (fn, args) =>
  fetch(`${API}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  }).then(async (x) => ({ status: x.status, text: await x.text() }));
const startPayment = (tag, c) =>
  api(tag, "rpc/start_conversation_unlock_payment", "POST", {
    _conversation_id: c,
    _provider: "test",
  });
const quota = async (tag, c) =>
  (await api(tag, "rpc/get_message_quota", "POST", { _conversation_id: c })).json?.[0];
const unlock = async (tag, c, ref) => {
  const pid = (await startPayment(tag, c)).json;
  await service("confirm_payment", {
    _payment_id: pid,
    _provider: "test",
    _provider_transaction_id: ref,
    _amount: 100,
    _currency: "USD",
  });
};
const banner = (p) => p.getByTestId("conversation-unlocked");
const settleQuota = async (p) => {
  await p
    .getByTestId("message-quota")
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  await p.waitForTimeout(600);
};
for (let i = 1; i <= 3; i++) await send("v", cA, `Paul ${i}`);
for (let i = 1; i <= 3; i++) await send("a", cA, `Grace ${i}`);

// A. Avant
const pv = await login("v");
await openConv(pv, cA);
await settleQuota(pv);
check(
  "Avant déblocage : pas de bandeau, offre affichée (quota épuisé)",
  (await banner(pv).count()) === 0 && (await waitOffer(pv, true)),
);
let q = await quota("v", cA);
check(
  "Serveur : non débloquée",
  q.unlocked === false && q.unlocked_by === null && q.unlock_expires_at === null,
);

// B. Paul débloque ; appliqué aux deux participants
await unlock("v", cA, "tx-paul");
q = await quota("v", cA);
const qa = await quota("a", cA);
check(
  "Serveur, pour Paul : débloquée, payée par Paul",
  q.unlocked === true && q.unlocked_by === id.v,
  JSON.stringify(q),
);
check(
  "Serveur, pour Grace : débloquée, payée par Paul (même conversation)",
  qa.unlocked === true && qa.unlocked_by === id.v,
);
const hours = (iso) => (new Date(iso).getTime() - Date.now()) / 3600000;
check(
  "Fin de période : dans 3 jours (≈ 72 h)",
  Math.abs(hours(q.unlock_expires_at) - 72) < 0.1 && q.unlock_expires_at === qa.unlock_expires_at,
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await settleQuota(pv);
check(
  "Paul : bandeau « Conversation débloquée — Débloquée par vous, pour vous deux. »",
  ((await banner(pv).textContent()) ?? "")
    .replace(/\s+/g, " ")
    .includes("Conversation débloquéeDébloquée par vous, pour vous deux."),
);
check("Paul : l'offre de paiement disparaît", (await offer(pv).count()) === 0);
const pa = await login("a");
await openConv(pa, cA);
await settleQuota(pa);
check(
  "Grace : bandeau « Débloquée par Qpaul, pour vous deux. »",
  ((await banner(pa).textContent()) ?? "").includes("Débloquée par Qpaul, pour vous deux."),
);
check("Grace (quota épuisé elle aussi) : pas d'offre de paiement", (await offer(pa).count()) === 0);
// Depuis l'étape 7.9, l'envoi est autorisé pendant le déblocage.
check(
  "Pendant le déblocage : envoi accepté malgré le quota épuisé (étape 7.9)",
  (await send("v", cA, "Message pendant le déblocage")).status === 200,
);

// C. Portée du déblocage
check(
  "Autre conversation de Paul : non débloquée, pas de bandeau",
  (await quota("v", cB)).unlocked === false,
);
await openConv(pv, cB);
await settleQuota(pv);
check("… et aucun bandeau à l'écran", (await banner(pv).count()) === 0);
let r = await api("c", "rpc/get_message_quota", "POST", { _conversation_id: cA });
check(
  "Personne extérieure : aucune information (conversation indisponible)",
  r.text.includes("conversation_unavailable"),
);
r = await startPayment("a", cA);
check(
  "Nouveau paiement pour une conversation déjà débloquée : refusé",
  r.text.includes("unlock_already_active"),
);
await pa.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await pa.getByRole("button", { name: "Payer 1 USD" }).click();
await pa
  .getByText("Cette conversation est déjà débloquée.")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Écran de paiement : « Cette conversation est déjà débloquée. »",
  (await pa.getByText("Cette conversation est déjà débloquée.").count()) === 1,
);

// D. Déblocages à la suite ; déblocage annulé
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.a}','${id.c}'), ('${id.c}','${id.a}');`,
);
const cD = conv("a", "c");
const p1 = (await startPayment("a", cD)).json;
const p2 = (await startPayment("c", cD)).json;
await Promise.all([
  service("confirm_payment", {
    _payment_id: p1,
    _provider: "test",
    _provider_transaction_id: "tx-d1",
    _amount: 100,
    _currency: "USD",
  }),
  service("confirm_payment", {
    _payment_id: p2,
    _provider: "test",
    _provider_transaction_id: "tx-d2",
    _amount: 100,
    _currency: "USD",
  }),
]);
q = await quota("c", cD);
check(
  "Deux déblocages à la suite : fin de période dans 6 jours (≈ 144 h)",
  q.unlocked && Math.abs(hours(q.unlock_expires_at) - 144) < 0.1,
  q.unlock_expires_at,
);
sql(`update public.conversation_unlocks set status='cancelled' where conversation_id='${cD}'`);
check("Déblocages annulés : plus débloquée", (await quota("c", cD)).unlocked === false);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u78-%@example.test';");
check(
  "Nettoyage : comptes, conversations, paiements et déblocages supprimés",
  sql("select count(*) from auth.users where email like 'test-u78-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_unlocks where conversation_id in ('${cA}','${cB}','${cD}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
