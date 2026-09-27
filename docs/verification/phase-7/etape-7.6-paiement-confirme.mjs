// YONA — Phase 5 / Étape 7.6 — Vérification de l'enregistrement du paiement confirmé.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.6-paiement-confirme.mjs
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
sql("delete from auth.users where email like 'test-u76-%@example.test';");
const stamp = Date.now();
const PWD = "TestU76!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u76-${tag}-${stamp}@example.test`;
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
for (let i = 1; i <= 3; i++) await send("v", cA, `Message ${i}`);

// A. Parcours complet dans l'application (mode test)
const pv = await login("v");
let captured = null;
pv.on("request", (q) => {
  if (
    q.url().includes("/_serverFn/") &&
    q.method() === "POST" &&
    (q.postData() ?? "").includes("paymentId")
  )
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await pv.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await pv.getByRole("button", { name: "Payer 1 USD" }).click();
await pv.getByTestId("payment-pending").waitFor({ timeout: 8000 });
check(
  "Paiement en attente : bouton « Confirmer le paiement de test (aucun argent réel) » (mode test)",
  (await pv
    .getByRole("button", { name: "Confirmer le paiement de test (aucun argent réel)" })
    .count()) === 1,
);
await pv.getByRole("button", { name: "Confirmer le paiement de test (aucun argent réel)" }).click();
await pv
  .getByTestId("payment-confirmed")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Confirmation : « Paiement confirmé. » — « Votre paiement de 1 USD a bien été enregistré. »",
  ((await pv.getByTestId("payment-confirmed").textContent()) ?? "").includes(
    "Votre paiement de 1 USD a bien été enregistré.",
  ),
);
const p = pay("v").split("|");
check(
  "Paiement « réussi » en base, avec référence du prestataire et date de confirmation",
  p[0] === "succeeded" && p[1].startsWith("test-") && p[2] === "true",
  pay("v"),
);
check(
  "Montant et devise inchangés (100 cents, USD)",
  sql(`select amount || currency from public.payments where user_id='${id.v}'`) === "100USD",
);
check(
  "Aucun déblocage encore créé (activation : étape 7.7) — envoi toujours refusé",
  sql(`select count(*) from public.conversation_unlocks where conversation_id='${cA}'`) === "0" &&
    (await send("v", cA, "Après paiement")).text.includes("free_limit_reached"),
);
const replay = await fetch(captured.url, {
  method: "POST",
  headers: Object.fromEntries(
    Object.entries(captured.headers).filter(
      ([k]) => !["host", "content-length", "connection"].includes(k),
    ),
  ),
  body: captured.body,
}).then((x) => x.text());
check(
  "Rejouer la confirmation : refusée (« n'est plus en attente »), rien ne change",
  replay.includes("n'est plus en attente") && pay("v").split("|")[1] === p[1],
);

// B. Un membre ne peut pas confirmer lui-même
const pidA = (await startPayment("a", cA)).json;
let r = await api("a", "rpc/confirm_payment", "POST", {
  _payment_id: pidA,
  _provider: "test",
  _provider_transaction_id: "x",
  _amount: 100,
  _currency: "USD",
});
check(
  "Membre appelant confirm_payment directement : refusé",
  [401, 403, 404].includes(r.status) && pay("a").startsWith("pending"),
  String(r.status),
);
r = await api(null, "rpc/confirm_payment", "POST", {
  _payment_id: pidA,
  _provider: "test",
  _provider_transaction_id: "x",
  _amount: 100,
  _currency: "USD",
});
check(
  "Visiteur : refusé",
  [401, 403, 404].includes(r.status) && pay("a").startsWith("pending"),
  String(r.status),
);
const otherBody = captured.body.replace(
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  pidA,
);
const stolen = await fetch(captured.url, {
  method: "POST",
  headers: Object.fromEntries(
    Object.entries(captured.headers).filter(
      ([k]) => !["host", "content-length", "connection"].includes(k),
    ),
  ),
  body: otherBody,
}).then((x) => x.text());
check(
  "Paul confirme le paiement de Grace via le serveur de l'application : refusé (« introuvable »)",
  stolen.includes("introuvable") && pay("a").startsWith("pending"),
);

// C. Contrôles de la fonction serveur (rôle service)
r = await service("confirm_payment", {
  _payment_id: pidA,
  _provider: "test",
  _provider_transaction_id: "",
  _amount: 100,
  _currency: "USD",
});
check(
  "Référence de transaction absente : refusé",
  r.text.includes("payment_reference_missing") && pay("a").startsWith("pending"),
);
r = await service("confirm_payment", {
  _payment_id: pidA,
  _provider: "stripe",
  _provider_transaction_id: "tx-1",
  _amount: 100,
  _currency: "USD",
});
check(
  "Autre prestataire que celui du paiement : refusé",
  r.text.includes("payment_not_found") && pay("a").startsWith("pending"),
);
r = await service("confirm_payment", {
  _payment_id: pidA,
  _provider: "test",
  _provider_transaction_id: p[1],
  _amount: 100,
  _currency: "USD",
});
check(
  "Référence déjà utilisée par un autre paiement : refusé",
  r.status >= 400 && pay("a").startsWith("pending"),
  r.text.slice(0, 80),
);
r = await service("confirm_payment", {
  _payment_id: pidA,
  _provider: "test",
  _provider_transaction_id: "tx-montant",
  _amount: 1,
  _currency: "USD",
});
check(
  "Montant confirmé différent (1 cent) : paiement marqué « échoué » (motif enregistré), jamais « réussi »",
  r.text.includes("failed") &&
    sql(
      `select status || ':' || (metadata->>'failure') from public.payments where id='${pidA}'`,
    ) === "failed:amount_mismatch",
);
const pidB = (await startPayment("b", cB)).json;
r = await service("confirm_payment", {
  _payment_id: pidB,
  _provider: "test",
  _provider_transaction_id: "tx-devise",
  _amount: 100,
  _currency: "EUR",
});
check(
  "Devise confirmée différente (EUR) : « échoué »",
  r.text.includes("failed") && pay("b").startsWith("failed"),
);
const pidB2 = (await startPayment("b", cB)).json;
r = await service("confirm_payment", {
  _payment_id: pidB2,
  _provider: "test",
  _provider_transaction_id: "tx-ok",
  _amount: 100,
  _currency: "usd",
});
check(
  "Confirmation correcte par le serveur : « réussi »",
  r.text.includes("succeeded") && pay("b").startsWith("succeeded|tx-ok"),
);
r = await service("confirm_payment", {
  _payment_id: pidB2,
  _provider: "test",
  _provider_transaction_id: "tx-ok",
  _amount: 100,
  _currency: "USD",
});
check(
  "Même confirmation répétée par le prestataire : acceptée sans rien changer",
  r.text.includes("succeeded") && pay("b").startsWith("succeeded|tx-ok"),
);
r = await service("confirm_payment", {
  _payment_id: pidB2,
  _provider: "test",
  _provider_transaction_id: "tx-autre",
  _amount: 100,
  _currency: "USD",
});
check(
  "Seconde confirmation avec une autre référence : refusée",
  r.text.includes("payment_already_confirmed") && pay("b").startsWith("succeeded|tx-ok"),
);
check(
  "Paiement échoué : ne peut plus être confirmé",
  (
    await service("confirm_payment", {
      _payment_id: pidA,
      _provider: "test",
      _provider_transaction_id: "tx-2",
      _amount: 100,
      _currency: "USD",
    })
  ).text.includes("payment_not_pending"),
);

// D. Sans mode test, pas de confirmation par l'application
const srv = spawn("node", ["docs/verification/outils/serveur-local.mjs"], {
  env: {
    ...process.env,
    SUPABASE_URL: API,
    SUPABASE_PUBLISHABLE_KEY: KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    PAYMENT_PROVIDER: "",
    PORT: "4174",
  },
  stdio: "ignore",
});
for (let i = 0; i < 40; i++) {
  try {
    await fetch("http://127.0.0.1:4174/");
    break;
  } catch {
    await new Promise((res) => setTimeout(res, 250));
  }
}
const pidC = (await startPayment("a", cA)).json;
const noTest = await fetch(captured.url.replace(":4173", ":4174"), {
  method: "POST",
  // Même requête que l'application, envoyée à la bonne adresse (le serveur refuse les
  // requêtes venant d'une autre origine).
  headers: Object.fromEntries(
    Object.entries(captured.headers)
      .filter(([k]) => !["host", "content-length", "connection"].includes(k))
      .map(([k, v]) => [k, ["origin", "referer"].includes(k) ? v.replace(":4173", ":4174") : v]),
  ),
  body: captured.body.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/, pidC),
}).then((x) => x.text());
srv.kill();
check(
  "Serveur sans mode test : confirmation de test refusée",
  noTest.includes("n'existe qu'en mode test") &&
    sql(`select status from public.payments where id='${pidC}'`) === "pending",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u76-%@example.test';");
check(
  "Nettoyage : comptes, conversations et paiements supprimés",
  sql("select count(*) from auth.users where email like 'test-u76-%'") === "0" &&
    sql(
      `select count(*) from public.payments where metadata->>'conversation_id' in ('${cA}','${cB}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
