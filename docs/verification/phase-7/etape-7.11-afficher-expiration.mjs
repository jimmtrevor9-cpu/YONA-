// YONA — Phase 5 / Étape 7.11 — Vérification de l'affichage de l'expiration.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.11-afficher-expiration.mjs
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
sql("delete from auth.users where email like 'test-u711-%@example.test';");
const stamp = Date.now();
const PWD = "TestU711!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u711-${tag}-${stamp}@example.test`;
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
const TZ = "Africa/Douala";
const fmt = (iso) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
async function loginTz(tag) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 800 }, timezoneId: TZ })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  return page;
}
const expiryText = async (p) =>
  (
    (await p
      .getByTestId("unlock-expiry")
      .textContent()
      .catch(() => "")) ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
const endIso = () =>
  sql(
    `select to_char(max(expires_at) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from public.conversation_unlocks where conversation_id='${cA}'`,
  );
for (let i = 1; i <= 3; i++) await send("v", cA, `Paul ${i}`);
await unlock("v", cA, "tx-711");

// A. Pendant le déblocage
const pv = await loginTz("v");
await openConv(pv, cA);
await settleQuota(pv);
const end = endIso();
let t = await expiryText(pv);
check(
  `Bandeau : « Jusqu'au ${fmt(end)} » (heure locale de la personne, ici Douala)`,
  t.startsWith(`Jusqu'au ${fmt(end)}`),
  t,
);
check("Temps restant : « encore 2 j 23 h »", t.endsWith("(encore 2 j 23 h)"), t);
check(
  "Date lisible par les machines et lecteurs d'écran (élément time, date exacte du serveur)",
  new Date(
    (await pv.locator("[data-testid=unlock-expiry] time").getAttribute("datetime")) ?? "",
  ).getTime() === new Date(end).getTime(),
);
const pa = await loginTz("a");
await openConv(pa, cA);
await settleQuota(pa);
check("Grace voit la même date de fin", (await expiryText(pa)).startsWith(`Jusqu'au ${fmt(end)}`));

// B. Temps restant court
sql(
  `update public.conversation_unlocks set starts_at = now() - interval '3 days' + interval '90 minutes', expires_at = now() + interval '90 minutes' + interval '30 seconds' where conversation_id='${cA}'`,
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await settleQuota(pv);
t = await expiryText(pv);
check("Moins d'un jour : « encore 1 h 30 min »", t.endsWith("(encore 1 h 30 min)"), t);
sql(
  `update public.conversation_unlocks set expires_at = now() + interval '12 minutes' + interval '30 seconds' where conversation_id='${cA}'`,
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await settleQuota(pv);
t = await expiryText(pv);
check("Moins d'une heure : « encore 12 min »", t.endsWith("(encore 12 min)"), t);

// C. Fin atteinte pendant que la page est ouverte
sql(
  `update public.conversation_unlocks set expires_at = now() + interval '8 seconds' where conversation_id='${cA}'`,
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await settleQuota(pv);
check(
  "Juste avant la fin : bandeau affiché, champ ouvert",
  (await banner(pv).count()) === 1 && (await field(pv).isEnabled()),
);
const expiredIso = endIso();
let switched = false;
for (let i = 0; i < 150 && !switched; i++) {
  await pv.waitForTimeout(100);
  switched =
    (await banner(pv).count()) === 0 && (await pv.getByTestId("unlock-expired").count()) === 1;
}
check("À la fin, sans recharger : bandeau retiré, offre de nouveau proposée", switched);
t = (
  (await pv
    .getByTestId("unlock-expired")
    .textContent()
    .catch(() => "")) ?? ""
)
  .replace(/\s+/g, " ")
  .trim();
check(
  `Message « Le déblocage de cette conversation a expiré le ${fmt(expiredIso)}. »`,
  t === `Le déblocage de cette conversation a expiré le ${fmt(expiredIso)}.`,
  t,
);
check("Champ de nouveau fermé (quota gratuit épuisé)", await field(pv).isDisabled());
await service("expire_conversation_unlocks", {});
await pa.reload({ waitUntil: "networkidle" });
await openConv(pa, cA);
await settleQuota(pa);
check(
  "Grace (après la tâche d'expiration) : plus de bandeau ; l'offre n'est pas affichée (son quota n'est pas épuisé)",
  (await banner(pa).count()) === 0 && (await offer(pa).count()) === 0,
);
check(
  "Serveur : date de fin du dernier déblocage renvoyée",
  (await quota("v", cA)).last_unlock_expired_at !== null,
);

// D. Sans déblocage passé ; nouveau déblocage
for (let i = 1; i <= 3; i++) await send("v", cB, `Ruth ${i}`);
await openConv(pv, cB);
await settleQuota(pv);
check(
  "Conversation jamais débloquée : offre sans mention d'expiration",
  (await waitOffer(pv, true)) && (await pv.getByTestId("unlock-expired").count()) === 0,
);
await unlock("v", cA, "tx-711-bis");
await openConv(pv, cA);
await settleQuota(pv);
check(
  "Nouveau déblocage : nouvelle date de fin, plus de mention « a expiré »",
  (await expiryText(pv)).startsWith(`Jusqu'au ${fmt(endIso())}`) &&
    (await pv.getByTestId("unlock-expired").count()) === 0,
);

// E. Petit écran
const small = await (
  await browser.newContext({ viewport: { width: 320, height: 700 }, timezoneId: TZ })
).newPage();
small.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await small.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await small.fill("#email", emails.v);
await small.fill("#password", PWD);
await small.click("button[type=submit]");
await small.waitForURL(/\/discover$/, { timeout: 8000 });
await openConv(small, cA);
await settleQuota(small);
check(
  "Petit écran (320 px) : date de fin lisible, sans débordement",
  (await small.getByTestId("unlock-expiry").isVisible()) &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u711-%@example.test';");
check(
  "Nettoyage : comptes, conversations, paiements et déblocages supprimés",
  sql("select count(*) from auth.users where email like 'test-u711-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_unlocks where conversation_id in ('${cA}','${cB}')`,
    ) === "0",
);

const okN = results.filter(Boolean).length;
console.log(`\n${okN}/${results.length} vérifications réussies`);
process.exit(okN === results.length ? 0 : 1);
