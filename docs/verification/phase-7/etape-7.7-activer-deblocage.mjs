// YONA — Phase 5 / Étape 7.7 — Vérification de l'activation du déblocage.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.7-activer-deblocage.mjs
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
sql("delete from auth.users where email like 'test-u77-%@example.test';");
const stamp = Date.now();
const PWD = "TestU77!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u77-${tag}-${stamp}@example.test`;
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
const unlocks = (c) =>
  sql(
    `select string_agg(status || ':' || amount || currency || ':' || (expires_at - starts_at) || ':' || (paid_by_user_id::text) , ',' order by starts_at) from public.conversation_unlocks where conversation_id='${c}'`,
  );
const confirm = (pid, ref) =>
  service("confirm_payment", {
    _payment_id: pid,
    _provider: "test",
    _provider_transaction_id: ref,
    _amount: 100,
    _currency: "USD",
  });
for (let i = 1; i <= 3; i++) await send("v", cA, `Message ${i}`);

// A. Activation depuis l'application
const pv = await login("v");
await pv.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await pv.getByRole("button", { name: "Payer 1 USD" }).click();
await pv.getByTestId("payment-pending").waitFor({ timeout: 8000 });
check("Avant confirmation : aucun déblocage", (unlocks(cA) ?? "") === "");
const before = sql("select now()");
await pv.getByRole("button", { name: "Confirmer le paiement de test (aucun argent réel)" }).click();
await pv
  .getByTestId("payment-confirmed")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Écran : « Le déblocage de la conversation avec Qgrace est activé pour 3 jours. »",
  ((await pv.getByTestId("payment-confirmed").textContent()) ?? "").includes(
    "Le déblocage de la conversation avec Qgrace est activé pour 3 jours.",
  ),
);
check(
  "Déblocage créé : actif, 1 USD, durée 3 jours exactement, payé par Paul",
  unlocks(cA) === `active:100USD:3 days:${id.v}`,
  unlocks(cA),
);
check(
  "Commence à la confirmation (heure du serveur) et lié au paiement",
  sql(
    `select (u.starts_at >= '${before}'::timestamptz and u.starts_at <= now() and u.payment_id = p.id)::text from public.conversation_unlocks u join public.payments p on p.user_id='${id.v}' where u.conversation_id='${cA}'`,
  ) === "true",
);
let r = await api("v", "rpc/has_active_conversation_unlock", "POST", { _conversation_id: cA });
const rA = await api("a", "rpc/has_active_conversation_unlock", "POST", { _conversation_id: cA });
check(
  "Serveur : conversation débloquée (pour Paul et pour Grace)",
  r.text === "true" && rA.text === "true",
  `${r.text}/${rA.text}`,
);
check(
  "Autre conversation de Paul : non débloquée",
  (await api("v", "rpc/has_active_conversation_unlock", "POST", { _conversation_id: cB })).text ===
    "false",
);
await pv.getByRole("link", { name: "Revenir à la conversation" }).click();
await pv.waitForURL(new RegExp(`/messages/${cA}$`), { timeout: 8000 }).catch(() => {});
check("« Revenir à la conversation »", pv.url().endsWith(`/messages/${cA}`));

// B. Un paiement = un déblocage ; seuls les paiements réussis de déblocage activent
const ref = sql(`select provider_transaction_id from public.payments where user_id='${id.v}'`);
const pid = sql(`select id from public.payments where user_id='${id.v}'`);
await confirm(pid, ref);
check(
  "Confirmation répétée : toujours un seul déblocage",
  sql(`select count(*) from public.conversation_unlocks where conversation_id='${cA}'`) === "1",
);
const pidB = (await startPayment("b", cB)).json;
check("Paiement en attente : aucun déblocage", (unlocks(cB) ?? "") === "");
await service("confirm_payment", {
  _payment_id: pidB,
  _provider: "test",
  _provider_transaction_id: "tx-faux",
  _amount: 1,
  _currency: "USD",
});
check(
  "Paiement échoué (mauvais montant) : aucun déblocage",
  (unlocks(cB) ?? "") === "" && pay("b").startsWith("failed"),
);
sql(`insert into public.payments (user_id, type, amount, currency, provider, status, metadata) values ('${id.b}','subscription',500,'USD','test','pending', jsonb_build_object('conversation_id','${cB}'));
     update public.payments set status='succeeded', provider_transaction_id='tx-abo' where user_id='${id.b}' and type='subscription';`);
check("Paiement réussi d'un autre type (abonnement) : aucun déblocage", (unlocks(cB) ?? "") === "");

// C. Les deux participants paient presque en même temps
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.a}','${id.c}'), ('${id.c}','${id.a}');`,
);
const cD = conv("a", "c");
const p1 = (await startPayment("a", cD)).json;
const p2 = (await startPayment("c", cD)).json;
await Promise.all([confirm(p1, "tx-a"), confirm(p2, "tx-c")]);
const seq = sql(
  `select string_agg(to_char(expires_at - starts_at, 'DD') || ':' || (lag_end is null or starts_at = lag_end)::text, ',' order by starts_at) from (select *, lag(expires_at) over (order by starts_at) lag_end from public.conversation_unlocks where conversation_id='${cD}') t`,
);
check(
  "Deux paiements confirmés en même temps : deux déblocages de 3 jours à la suite (6 jours, aucun perdu)",
  seq === "03:true,03:true" &&
    sql(
      `select (max(expires_at) - min(starts_at))::text from public.conversation_unlocks where conversation_id='${cD}'`,
    ) === "6 days",
  seq,
);

// D. Protections
r = await api("v", `conversation_unlocks?conversation_id=eq.${cA}`, "PATCH", {
  expires_at: "2999-01-01T00:00:00Z",
});
check(
  "Prolonger soi-même son déblocage : refusé",
  [401, 403].includes(r.status) &&
    sql(
      `select to_char(expires_at - starts_at,'DD') from public.conversation_unlocks where conversation_id='${cA}'`,
    ) === "03",
  String(r.status),
);
r = await api("v", "conversation_unlocks", "POST", {
  conversation_id: cB,
  paid_by_user_id: id.v,
  status: "active",
  starts_at: new Date().toISOString(),
  expires_at: "2999-01-01T00:00:00Z",
});
check(
  "Créer soi-même un déblocage : refusé",
  [401, 403].includes(r.status) && (unlocks(cB) ?? "") === "",
  String(r.status),
);
r = await api("a", `conversation_unlocks?select=id&conversation_id=eq.${cA}`);
const rC = await api("c", `conversation_unlocks?select=id&conversation_id=eq.${cA}`);
check(
  "Les deux participants voient le déblocage ; une personne extérieure non",
  r.json?.length === 1 && rC.json?.length === 0,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u77-%@example.test';");
check(
  "Nettoyage : comptes, conversations, paiements et déblocages supprimés",
  sql("select count(*) from auth.users where email like 'test-u77-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_unlocks where conversation_id in ('${cA}','${cB}','${cD}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
