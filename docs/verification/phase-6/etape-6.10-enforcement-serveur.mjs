// YONA — Phase 5 / Étape 6.10 — Vérification de l'enforcement serveur de la protection des numéros.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-6/etape-6.10-enforcement-serveur.mjs
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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
sql("delete from auth.users where email like 'test-t610-%@example.test';");
const stamp = Date.now();
const PWD = "TestT610!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-t610-${tag}-${stamp}@example.test`;
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

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  execFileSync("bash", [
    "-c",
    "cd /var/tmp/yona-local && /var/tmp/sbcli/node_modules/.bin/supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY' | cut -d= -f2- | tr -d '\"'",
  ])
    .toString()
    .trim();
const PHONE = "Mon numéro : 06 12 34 56 78";

const PHONES = [
  "06 12 34 56 78",
  "+237 699 88 77 66",
  "zéro six douze trente-quatre cinquante-six soixante-dix-huit",
  "06.12.34.56.78",
];
const phoneRows = () =>
  sql(
    "select count(*) from public.messages where status='delivered' and public.contains_phone_number(content)",
  );
const tokenV = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: emails.v, password: PWD }),
    })
  ).json()
).access_token;
const rest = (path, method, body, token = tokenV, key = KEY) =>
  fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (x) => ({ status: x.status, text: await x.text() }));

// 1. Membre : écriture directe dans la table
let r = await rest("messages", "POST", {
  conversation_id: cA,
  sender_id: id.v,
  content: PHONES[0],
});
check(
  "Membre, création directe dans la table : refusée",
  [401, 403].includes(r.status),
  String(r.status),
);
await send("v", cA, "Message ordinaire");
const mid = sql(`select id from public.messages where conversation_id='${cA}' limit 1`);
r = await rest(`messages?id=eq.${mid}`, "PATCH", { content: PHONES[1] });
check(
  "Membre, modification directe de son message : refusée",
  [401, 403].includes(r.status) &&
    !sql(`select content from public.messages where id='${mid}'`).includes("699"),
  String(r.status),
);

// 2. Membre : fonction d'envoi de la base (appel direct)
let refused = 0;
for (const p of PHONES)
  if ((await send("v", cA, p)).text.includes("phone_number_detected")) refused++;
check("Membre, fonction d'envoi appelée directement : 4 formes refusées", refused === 4);

// 3. Membre : serveur de l'application (appel direct, sans l'interface)
const pv = await login("v");
let captured = null;
pv.on("request", (q) => {
  if (q.url().includes("/_serverFn/") && q.method() === "POST" && !captured)
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await openConv(pv, cA);
await field(pv).fill("Capture");
await button(pv).click();
for (let i = 0; i < 50 && !captured; i++) await pv.waitForTimeout(100);
let refusedFn = 0;
for (const p of PHONES) {
  const txt = await fetch(captured.url, {
    method: "POST",
    headers: Object.fromEntries(
      Object.entries(captured.headers).filter(
        ([k]) => !["host", "content-length", "connection"].includes(k),
      ),
    ),
    body: captured.body.replace("Capture", p),
  }).then((x) => x.text());
  if (txt.includes("numéro de téléphone")) refusedFn++;
}
check(
  "Membre, serveur de l'application appelé directement : 4 formes refusées avec l'explication",
  refusedFn === 4,
  `${refusedFn}/4`,
);

// 4. Interface : un numéro tapé est refusé
await field(pv).fill(`Mon numéro : ${PHONES[3]}`);
await button(pv).click();
await pv
  .getByTestId("message-notice")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Interface : refus expliqué à l'expéditeur",
  (await pv.getByTestId("message-notice").count()) === 1,
);

// 5. Rôle service et administrateur de la base
r = await rest(
  "messages",
  "POST",
  { conversation_id: cA, sender_id: id.v, content: PHONES[2], status: "delivered" },
  SERVICE_KEY,
  SERVICE_KEY,
);
check(
  "Rôle service (serveur) : création refusée",
  r.status >= 400 && r.text.includes("phone_number_detected"),
  String(r.status),
);
let e = sqlError(
  `insert into public.messages (conversation_id, sender_id, content) values ('${cA}','${id.v}','${PHONES[0]}');`,
);
check("Administrateur de la base : création refusée", e.includes("phone_number_detected"));
e = sqlError(`update public.messages set content='${PHONES[1]}' where id='${mid}';`);
check("Administrateur de la base : modification refusée", e.includes("phone_number_detected"));

// 6. Dernier verrou : règle de la table
e = sqlError(`alter table public.messages disable trigger messages_block_phone_numbers;
  insert into public.messages (conversation_id, sender_id, content, contains_phone_number) values ('${cA}','${id.v}','x', true);`);
sql("alter table public.messages enable trigger messages_block_phone_numbers;");
check(
  "Règle de la table : un message « délivré » marqué avec numéro est impossible, même déclencheur coupé",
  e.includes("messages_no_phone_number_delivered"),
);
check(
  "Déclencheur et règle bien actifs",
  sql("select tgenabled from pg_trigger where tgname='messages_block_phone_numbers'") === "O" &&
    sql("select count(*) from pg_constraint where conname='messages_no_phone_number_delivered'") ===
      "1",
);

// 7. Détection réservée au serveur ; ancien détecteur côté application supprimé
r = await rest("rpc/contains_phone_number", "POST", { _text: "0612345678" });
check(
  "Détecteur non appelable par un membre",
  [401, 403, 404].includes(r.status),
  String(r.status),
);
check(
  "Ancien détecteur côté application (plus faible, inutilisé) supprimé",
  !existsSync(new URL("../../../src/features/moderation/message-pipeline.ts", import.meta.url)),
);

// 8. Bilan : aucun message délivré contenant un numéro
check("Aucun message délivré contenant un numéro dans toute la base", phoneRows() === "0");
check(
  "Seuls les messages ordinaires ont été enregistrés (2)",
  count(cA) === "2" &&
    sql(
      `select string_agg(content, '|' order by created_at) from public.messages where conversation_id='${cA}'`,
    ) === "Message ordinaire|Capture",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-t610-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages supprimés",
  sql("select count(*) from auth.users where email like 'test-t610-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
