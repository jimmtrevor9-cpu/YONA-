// YONA — Phase 5 / Étape 7.9 — Vérification des messages autorisés pendant le déblocage.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.9-messages-deblocage.mjs
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
sql("delete from auth.users where email like 'test-u79-%@example.test';");
const stamp = Date.now();
const PWD = "TestU79!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u79-${tag}-${stamp}@example.test`;
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

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  execFileSync("bash", [
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
await send("a", cA, "Grace 1");

// A. Avant : quota appliqué
check(
  "Avant déblocage : 4e message de Paul refusé",
  (await send("v", cA, "Refusé")).text.includes("free_limit_reached"),
);

// B. Pendant le déblocage (payé par Paul)
await unlock("v", cA, "tx-79");
const pv = await login("v");
await openConv(pv, cA);
await settleQuota(pv);
check(
  "Écran : « Conversation débloquée : messages illimités », champ ouvert",
  ((await pv.getByTestId("message-quota").textContent()) ?? "").trim() ===
    "Conversation débloquée : messages illimités" && (await field(pv).isEnabled()),
);
for (let i = 1; i <= 3; i++) {
  await field(pv).fill(`Illimité ${i}`);
  await button(pv).click();
  await waitCount(cA, 4 + i);
}
check(
  "3 messages envoyés depuis l'application au-delà du quota : acceptés et affichés",
  count(cA) === "7" && (await pv.getByText("Illimité 3").count()) >= 1,
);
let ok = 0;
for (let i = 1; i <= 15; i++) if ((await send("v", cA, `Série ${i}`)).status === 200) ok++;
check("15 messages de plus : tous acceptés", ok === 15 && count(cA) === "22");
const burst = await Promise.all(
  Array.from({ length: 10 }, (_, i) => send("v", cA, `Simultané ${i}`)),
);
check(
  "10 messages envoyés en même temps : tous acceptés",
  burst.every((r) => r.status === 200) && count(cA) === "32",
);
check("Compteur gratuit de Paul inchangé pendant le déblocage (3)", used(cA, "v") === "3");
ok = 0;
for (let i = 2; i <= 6; i++) if ((await send("a", cA, `Grace ${i}`)).status === 200) ok++;
check("Grace (qui n'a pas payé) : messages illimités aussi (5 acceptés)", ok === 5);
check("Compteur gratuit de Grace préservé (toujours 1 utilisé)", used(cA, "a") === "1");

// C. Les autres règles s'appliquent toujours
check(
  "Numéro de téléphone : toujours refusé",
  (await send("v", cA, "06 12 34 56 78")).text.includes("phone_number_detected"),
);
check(
  "Message vide : toujours refusé",
  (await send("v", cA, "   ")).text.includes("message_empty"),
);
check(
  "Personne extérieure : toujours refusée",
  (await send("c", cA, "Intrus")).text.includes("conversation_unavailable"),
);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.a}','${id.v}')`);
check(
  "Blocage : envoi refusé malgré le déblocage",
  (await send("v", cA, "Bloqué")).text.includes("conversation_unavailable"),
);
sql(`delete from public.blocks where blocker_id='${id.a}'`);
for (let i = 1; i <= 3; i++) await send("v", cB, `Ruth ${i}`);
check(
  "Autre conversation de Paul (non débloquée) : quota toujours appliqué",
  (await send("v", cB, "Ruth 4")).text.includes("free_limit_reached"),
);

// D. Fin du déblocage (période terminée, simulée)
sql(
  `update public.conversation_unlocks set starts_at = now() - interval '4 days', expires_at = now() - interval '1 day' where conversation_id='${cA}'`,
);
check(
  "Déblocage terminé : Paul (3 utilisés) de nouveau refusé",
  (await send("v", cA, "Après")).text.includes("free_limit_reached"),
);
check(
  "Grace : ses 2 messages gratuits restants sont utilisables",
  (await send("a", cA, "Grace après 1")).status === 200 &&
    (await send("a", cA, "Grace après 2")).status === 200 &&
    (await send("a", cA, "Grace après 3")).text.includes("free_limit_reached"),
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await settleQuota(pv);
check("Écran de Paul après la fin : champ de nouveau fermé", await field(pv).isDisabled());
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u79-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages, paiements et déblocages supprimés",
  sql("select count(*) from auth.users where email like 'test-u79-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const okN = results.filter(Boolean).length;
console.log(`\n${okN}/${results.length} vérifications réussies`);
process.exit(okN === results.length ? 0 : 1);
