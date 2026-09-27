// YONA — Phase 5 / Étape 6.8 — Vérification de l'impossibilité de stocker un numéro.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-6/etape-6.8-empecher-stockage.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
sql("delete from auth.users where email like 'test-t68-%@example.test';");
const stamp = Date.now();
const PWD = "TestT68!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-t68-${tag}-${stamp}@example.test`;
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

const SERVICE_KEY = execFileSync("bash", [
  "-c",
  "cd /var/tmp/yona-local && /var/tmp/sbcli/node_modules/.bin/supabase status -o env 2>/dev/null | grep '^SERVICE_ROLE_KEY' | cut -d= -f2- | tr -d '\"'",
])
  .toString()
  .trim();
const PHONE = "Mon numéro : 06 12 34 56 78";

// A. Aucun chemin d'écriture ne peut stocker un numéro comme délivré
let e = sqlError(
  `insert into public.messages (conversation_id, sender_id, content) values ('${cA}','${id.v}','${PHONE}');`,
);
check(
  "Écriture directe par l'administrateur de la base : refusée (phone_number_detected)",
  e.includes("phone_number_detected") && count(cA) === "0",
);
const res = await fetch(`${API}/rest/v1/messages`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    conversation_id: cA,
    sender_id: id.v,
    content: "+237 699 88 77 66",
    status: "delivered",
  }),
});
const resText = await res.text();
check(
  "Écriture par le rôle service (serveur) : refusée",
  res.status >= 400 && resText.includes("phone_number_detected") && count(cA) === "0",
  String(res.status),
);
e = sqlError(
  `insert into public.messages (conversation_id, sender_id, content, contains_phone_number) values ('${cA}','${id.v}','Bonjour Grace', true);`,
);
check(
  "Indicateur « contient un numéro » calculé par le serveur (valeur fournie ignorée)",
  e === "" &&
    sql(
      `select contains_phone_number from public.messages where conversation_id='${cA}' and content='Bonjour Grace'`,
    ) === "f",
);
e = sqlError(
  `update public.messages set content='${PHONE}' where conversation_id='${cA}' and content='Bonjour Grace';`,
);
check(
  "Modifier un message délivré pour y mettre un numéro : refusé, contenu inchangé",
  e.includes("phone_number_detected") &&
    sql(
      `select count(*) from public.messages where conversation_id='${cA}' and content='Bonjour Grace'`,
    ) === "1",
);
e = sqlError(
  `insert into public.messages (conversation_id, sender_id, content, status, blocked_reason) values ('${cA}','${id.v}','Retenu : 06 12 34 56 78','blocked','phone_number_detected');`,
);
check(
  "Message retenu (statut « bloqué ») : accepté, indicateur calculé à vrai",
  e === "" &&
    sql(
      `select contains_phone_number from public.messages where conversation_id='${cA}' and status='blocked'`,
    ) === "t",
);
e = sqlError(
  `update public.messages set status='delivered' where conversation_id='${cA}' and status='blocked';`,
);
check(
  "Faire passer ce message retenu au statut « délivré » : refusé",
  e.includes("phone_number_detected") &&
    sql(
      `select status from public.messages where conversation_id='${cA}' and content like 'Retenu%'`,
    ) === "blocked",
);
e = sqlError(
  `update public.messages set content='Bonjour Grace, ça va ?' where conversation_id='${cA}' and content='Bonjour Grace';`,
);
check("Modification ordinaire d'un message sans numéro : toujours possible", e === "");

// B. Messages enregistrés avant la phase 6 (simulés) : plus délivrés
sql(`alter table public.messages disable trigger messages_block_phone_numbers;
     insert into public.messages (conversation_id, sender_id, content) values ('${cB}','${id.v}','Ancien message : 06.12.34.56.78'), ('${cB}','${id.v}','Ancien message sans numéro');
     alter table public.messages enable trigger messages_block_phone_numbers;`);
check(
  "Préparation : un ancien message avec numéro, encore « délivré »",
  sql(
    `select count(*) from public.messages where conversation_id='${cB}' and status='delivered'`,
  ) === "2",
);
execFileSync(
  "docker",
  ["exec", "-i", DB, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
  {
    input: readFileSync(
      new URL(
        "../../../supabase/migrations/20260928010000_phase6_empecher_stockage.sql",
        import.meta.url,
      ),
    ),
    stdio: ["pipe", "pipe", "pipe"],
  },
);
check(
  "Rattrapage : l'ancien message avec numéro devient « bloqué » (motif, modération « rejeté »)",
  sql(
    `select status || '/' || moderation_status || '/' || blocked_reason || '/' || contains_phone_number from public.messages where conversation_id='${cB}' and content like 'Ancien message : %'`,
  ) === "blocked/rejected/phone_number_detected/true",
);
check(
  "… l'ancien message sans numéro reste délivré",
  sql(
    `select status from public.messages where conversation_id='${cB}' and content='Ancien message sans numéro'`,
  ) === "delivered",
);
let r = await api("b", `messages?select=content&conversation_id=eq.${cB}`);
check(
  "Ruth ne voit plus l'ancien message avec numéro (API)",
  Array.isArray(r.json) && r.json.length === 1 && !JSON.stringify(r.json).includes("06.12"),
);
const pb = await login("b");
await openConv(pb, cB);
await pb.waitForTimeout(800);
check(
  "Ruth ne le voit pas dans l'application",
  (await pb.getByText("06.12.34.56.78").count()) === 0,
);
const pv = await login("v");
await openConv(pv, cB);
await pv.waitForTimeout(800);
const li = pv.locator("ol[aria-label=Messages] > li").filter({ hasText: "06.12.34.56.78" });
check(
  "Paul (l'auteur) le voit marqué « Non envoyé : bloqué par la modération »",
  (await li.count()) === 1 &&
    ((await li.textContent()) ?? "").includes("Non envoyé : bloqué par la modération"),
);
await pb.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await pb.getByTestId("messages-page").waitFor({ timeout: 5000 });
await pb.waitForTimeout(1200);
const row = (
  (await pb.locator("[aria-label='Liste de vos conversations'] li").first().textContent()) ?? ""
).trim();
check(
  "Liste des conversations de Ruth : aperçu = dernier message délivré, jamais le numéro",
  row.includes("Ancien message sans numéro") && !row.includes("06.12.34.56.78"),
  row.slice(0, 80),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-t68-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages supprimés",
  sql("select count(*) from auth.users where email like 'test-t68-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
