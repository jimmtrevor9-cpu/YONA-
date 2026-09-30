// YONA — Phase 5 / Étape 7.5 — Vérification de l'écran de paiement.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-7/etape-7.5-ecran-paiement.mjs
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
sql("delete from auth.users where email like 'test-u75-%@example.test';");
const stamp = Date.now();
const PWD = "TestU75!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-u75-${tag}-${stamp}@example.test`;
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

const payments = (tag) =>
  sql(
    `select count(*) || '|' || coalesce(string_agg(status || ':' || amount || ':' || currency || ':' || type || ':' || provider, ','), '') from public.payments where user_id='${id[tag]}'`,
  );
for (let i = 1; i <= 3; i++) await send("v", cA, `Message ${i}`);

// A. Depuis l'offre vers l'écran de paiement
const pv = await login("v");
await openConv(pv, cA);
await waitOffer(pv, true);
await offer(pv).getByRole("link", { name: "Débloquer la conversation pour 1 USD" }).click();
await pv.waitForURL(new RegExp(`/messages/${cA}/debloquer$`), { timeout: 8000 }).catch(() => {});
check(
  "Bouton de l'offre actif : ouvre /messages/<id>/debloquer",
  pv.url().endsWith(`/messages/${cA}/debloquer`),
  pv.url(),
);
await pv.getByTestId("unlock-payment-page").waitFor({ timeout: 8000 });
for (
  let i = 0;
  i < 60 && (await pv.locator("[data-testid=unlock-payment-page] .animate-pulse").count()) > 0;
  i++
)
  await pv.waitForTimeout(100);
const page = ((await pv.getByTestId("unlock-payment-page").textContent()) ?? "").replace(
  /\s+/g,
  " ",
);
check(
  "Titre de page et en-tête « Débloquer la conversation »",
  (await pv.title()).startsWith("Débloquer la conversation") &&
    ((await pv.locator("header h1").textContent()) ?? "").includes("Débloquer la conversation"),
);
check(
  "Récapitulatif : « Conversation avec Qgrace »",
  page.includes("Conversation avec") && page.includes("Qgrace"),
);
check(
  "Prix : 1 USD",
  ((await pv.getByTestId("payment-price").textContent()) ?? "").trim() === "1 USD",
);
check(
  "Inclus : messages illimités 3 jours, paiement unique sans abonnement, activation à la confirmation",
  page.includes("Messages illimités dans cette conversation pendant 3 jours") &&
    page.includes("Paiement unique, sans abonnement ni renouvellement automatique") &&
    page.includes("Activation dès la confirmation du paiement"),
);
check(
  "Mode test clairement signalé : « aucun paiement réel »",
  ((await pv.getByTestId("payment-test-mode").textContent()) ?? "").includes(
    "Mode test : aucun paiement réel ne sera effectué.",
  ),
);
check(
  "« Le montant est fixé et vérifié par le serveur. »",
  page.includes("Le montant est fixé et vérifié par le serveur."),
);

// B. Démarrer le paiement
check("Aucun paiement avant le clic", payments("v").startsWith("0|"));
await pv.getByRole("button", { name: "Payer 1 USD" }).click();
await pv
  .getByTestId("payment-pending")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Clic « Payer 1 USD » : « Paiement créé, en attente de confirmation. »",
  ((await pv.getByTestId("payment-pending").textContent()) ?? "").includes(
    "Paiement créé, en attente de confirmation.",
  ),
);
check(
  "Paiement enregistré « en attente » : 100 cents, USD, déblocage, prestataire test (fixés par le serveur)",
  payments("v") === "1|pending:100:USD:conversation_unlock:test",
  payments("v"),
);
check(
  "Paiement lié à la conversation ; rien n'est débloqué ni confirmé",
  sql(`select metadata->>'conversation_id' from public.payments where user_id='${id.v}'`) === cA &&
    sql(`select count(*) from public.conversation_unlocks where conversation_id='${cA}'`) === "0" &&
    (await send("v", cA, "Toujours bloqué")).text.includes("free_limit_reached"),
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByRole("button", { name: "Payer 1 USD" }).click();
await pv
  .getByTestId("payment-pending")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Nouveau clic dans l'heure : même paiement réutilisé (pas de doublon)",
  payments("v").startsWith("1|"),
  payments("v"),
);

// C. Protections serveur
let r = await api("v", "payments", "POST", {
  user_id: id.v,
  type: "conversation_unlock",
  amount: 1,
  currency: "USD",
  provider: "test",
  status: "succeeded",
});
check(
  "Créer soi-même un paiement (ex. 1 cent « réussi ») : refusé",
  [401, 403].includes(r.status) && payments("v").startsWith("1|"),
  String(r.status),
);
r = await api("v", `payments?user_id=eq.${id.v}`, "PATCH", { status: "succeeded" });
check(
  "Passer soi-même son paiement à « réussi » : refusé",
  [401, 403].includes(r.status) && payments("v") === "1|pending:100:USD:conversation_unlock:test",
  String(r.status),
);
r = await api("v", "conversation_unlocks", "POST", {
  conversation_id: cA,
  paid_by_user_id: id.v,
  status: "active",
});
check(
  "Créer soi-même un déblocage : refusé",
  [401, 403].includes(r.status) && sql(`select count(*) from public.conversation_unlocks`) === "0",
  String(r.status),
);
r = await api("v", "rpc/start_conversation_unlock_payment", "POST", {
  _conversation_id: cA,
  _provider: "paypal",
});
check("Prestataire non autorisé : refusé", r.text.includes("payment_provider_unavailable"));
r = await api("c", "rpc/start_conversation_unlock_payment", "POST", {
  _conversation_id: cA,
  _provider: "test",
});
check(
  "Personne extérieure : refusée (conversation indisponible)",
  r.text.includes("conversation_unavailable") && payments("c").startsWith("0|"),
);
r = await api(null, "rpc/start_conversation_unlock_payment", "POST", {
  _conversation_id: cA,
  _provider: "test",
});
check("Sans connexion : refusé", r.status >= 400, String(r.status));
r = await api("v", "payments?select=id", "GET");
const rG = await api("a", `payments?select=id&user_id=eq.${id.v}`, "GET");
check(
  "Chacun ne voit que ses propres paiements",
  Array.isArray(r.json) && r.json.length === 1 && Array.isArray(rG.json) && rG.json.length === 0,
);

// D. Accès à l'écran
const pc = await login("c");
await pc.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await pc
  .getByTestId("unlock-unavailable")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Personne extérieure sur l'écran : « Cette conversation n'est pas disponible. »",
  (await pc.getByTestId("unlock-unavailable").count()) === 1,
);
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await anon.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check("Sans connexion : renvoi vers /login", anon.url().endsWith("/login"));
await pv.getByRole("link", { name: "Retour à la conversation" }).click();
await pv.waitForURL(new RegExp(`/messages/${cA}$`), { timeout: 8000 }).catch(() => {});
check("« Retour à la conversation »", pv.url().endsWith(`/messages/${cA}`));

// E. Serveur sans prestataire configuré (situation réelle tant qu'aucun n'est choisi)
const srv = spawn("node", ["docs/verification/outils/serveur-local.mjs"], {
  env: {
    ...process.env,
    SUPABASE_URL: API,
    SUPABASE_PUBLISHABLE_KEY: KEY,
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
const pn = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
pn.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await pn.goto("http://127.0.0.1:4174/login", { waitUntil: "networkidle" });
await pn.fill("#email", emails.v);
await pn.fill("#password", PWD);
await pn.click("button[type=submit]");
await pn.waitForURL(/\/discover$/, { timeout: 8000 });
await pn.goto(`http://127.0.0.1:4174/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await pn
  .getByTestId("payment-not-available")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "Sans prestataire : « Le paiement en ligne n'est pas encore disponible. », aucun bouton Payer, pas de mode test",
  ((await pn.getByTestId("payment-not-available").textContent()) ?? "").includes(
    "Le paiement en ligne n'est pas encore disponible.",
  ) &&
    (await pn.getByRole("button", { name: /^Payer/ }).count()) === 0 &&
    (await pn.getByTestId("payment-test-mode").count()) === 0,
);
srv.kill();

// F. Petit écran
const small = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
small.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await small.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await small.fill("#email", emails.v);
await small.fill("#password", PWD);
await small.click("button[type=submit]");
await small.waitForURL(/\/discover$/, { timeout: 8000 });
await small.goto(`${BASE}/messages/${cA}/debloquer`, { waitUntil: "networkidle" });
await small.getByTestId("payment-price").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-u75-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et paiements supprimés",
  sql("select count(*) from auth.users where email like 'test-u75-%'") === "0" &&
    sql(
      `select count(*) from public.payments where metadata->>'conversation_id' in ('${cA}','${cB}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
