// YONA — Phase 5 / Étape 7.10 — Vérification de l'expiration après 3 jours.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.10-expirer-deblocage.mjs
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
sql("delete from auth.users where email like 'test-u710-%@example.test';");
const stamp = Date.now();
const PWD = "TestU710!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u710-${tag}-${stamp}@example.test`;
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
const unlockRow = () =>
  sql(
    `select status || ':' || to_char(expires_at - starts_at, 'DD HH24:MI:SS') from public.conversation_unlocks where conversation_id='${cA}' order by created_at limit 1`,
  );
for (let i = 1; i <= 3; i++) await send("v", cA, `Paul ${i}`);
await unlock("v", cA, "tx-710");

// A. Durée
check("Déblocage créé pour exactement 3 jours", unlockRow() === "active:03 00:00:00", unlockRow());
check("Pendant la période : envoi accepté", (await send("v", cA, "Pendant")).status === 200);

// B. Passage de la date de fin (période ramenée à 3 jours se terminant dans 3 secondes)
sql(
  `update public.conversation_unlocks set starts_at = now() - interval '3 days' + interval '3 seconds', expires_at = now() + interval '3 seconds' where conversation_id='${cA}'`,
);
check(
  "3 secondes avant la fin : toujours débloquée",
  (await quota("v", cA)).unlocked === true && (await send("v", cA, "Juste avant")).status === 200,
);
await new Promise((r) => setTimeout(r, 4000));
let q = await quota("v", cA);
check(
  "Date de fin passée : plus débloquée, sans aucune intervention (pour les deux)",
  q.unlocked === false && (await quota("a", cA)).unlocked === false,
);
check(
  "Envoi de nouveau limité par le quota (Paul : 3 utilisés)",
  (await send("v", cA, "Après la fin")).text.includes("free_limit_reached"),
);
check(
  "Statut encore « actif » tant que la tâche planifiée n'est pas passée",
  unlockRow().startsWith("active:"),
);

// C. Tâche d'expiration
const res = await service("expire_conversation_unlocks", {});
check(
  "Tâche d'expiration : 1 déblocage marqué « expiré »",
  res.text === "1" && unlockRow().startsWith("expired:"),
  res.text,
);
check(
  "Deuxième passage : rien à faire (0)",
  (await service("expire_conversation_unlocks", {})).text === "0",
);
check(
  "Tâche planifiée dans la base toutes les 5 minutes",
  sql("select schedule || '|' || command from cron.job where jobname='yona-expirer-deblocages'") ===
    "*/5 * * * *|select public.expire_conversation_unlocks()",
);
let r = await api("v", "rpc/expire_conversation_unlocks", "POST", {});
check("Tâche non appelable par un membre", [401, 403, 404].includes(r.status), String(r.status));
r = await api("v", `conversation_unlocks?conversation_id=eq.${cA}`, "PATCH", { status: "active" });
check(
  "Réactiver soi-même un déblocage expiré : refusé",
  [401, 403].includes(r.status) && unlockRow().startsWith("expired:"),
  String(r.status),
);

// D. Écran après l'expiration
const pv = await login("v");
await openConv(pv, cA);
await settleQuota(pv);
check("Écran : plus de bandeau « débloquée »", (await banner(pv).count()) === 0);
check(
  "Écran : champ fermé et offre de déblocage de nouveau proposée",
  (await field(pv).isDisabled()) && (await waitOffer(pv, true)),
);

// E. Nouveau déblocage possible
await unlock("v", cA, "tx-710-bis");
q = await quota("v", cA);
check(
  "Nouveau paiement : nouveau déblocage de 3 jours, l'ancien reste « expiré »",
  q.unlocked === true &&
    sql(
      `select string_agg(status::text, ',' order by created_at) from public.conversation_unlocks where conversation_id='${cA}'`,
    ) === "expired,active",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u710-%@example.test';");
check(
  "Nettoyage : comptes, conversations, paiements et déblocages supprimés",
  sql("select count(*) from auth.users where email like 'test-u710-%'") === "0" &&
    sql(`select count(*) from public.conversation_unlocks where conversation_id='${cA}'`) === "0",
);

const okN = results.filter(Boolean).length;
console.log(`\n${okN}/${results.length} vérifications réussies`);
process.exit(okN === results.length ? 0 : 1);
