// YONA — Phase 5 / Étape 5.3 — Vérification du deuxième message gratuit.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-5/etape-5.3-deuxieme-message-gratuit.mjs
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
sql("delete from auth.users where email like 'test-q53-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ53!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q53-${tag}-${stamp}@example.test`;
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

// A. Deuxième message depuis l'application (après rechargement, au clavier)
const pv = await login("v");
await openConv(pv, cA);
await pv.getByLabel(/^Votre message à /).fill("Premier message");
await pv.getByRole("button", { name: "Envoyer le message" }).click();
await waitCount(cA, 1);
check("Premier message : compteur de Paul à 1", used(cA, "v") === "1");
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
await pv.getByLabel(/^Votre message à /).fill("Deuxième message");
await pv.getByLabel(/^Votre message à /).focus();
await pv.keyboard.press("Control+Enter");
await waitCount(cA, 2);
check(
  "Deuxième message (après rechargement, Ctrl+Entrée) : autorisé et enregistré",
  count(cA) === "2",
);
check("Compteur de Paul : 1 → 2", used(cA, "v") === "2");
check(
  "Les deux messages sont délivrés, à son nom, dans l'ordre",
  sql(
    `select string_agg(content, '|' order by created_at) from public.messages where conversation_id='${cA}' and sender_id='${id.v}' and status='delivered'`,
  ) === "Premier message|Deuxième message",
);
await pv
  .getByText("Deuxième message")
  .first()
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Deuxième message affiché dans le fil",
  (await pv.getByText("Deuxième message").count()) >= 1,
);

// B. Échange et indépendance
let r = await send("a", cA, "Réponse de Grace");
check(
  "Réponse de Grace entre-temps : son compteur à 1, celui de Paul reste 2",
  r.status === 200 && used(cA, "a") === "1" && used(cA, "v") === "2",
);
r = await send("a", cA, "Deuxième de Grace");
check(
  "Deuxième message de Grace : autorisé, son compteur à 2",
  r.status === 200 && used(cA, "a") === "2",
);
await send("v", cB, "Premier à Ruth");
check(
  "Conversation avec Ruth : compteur séparé (1)",
  used(cB, "v") === "1" && used(cA, "v") === "2",
);
r = await send("v", cB, "   ");
check(
  "Tentative refusée (vide) après le 1er : compteur toujours 1",
  r.text.includes("message_empty") && used(cB, "v") === "1",
);
r = await send("v", cB, "Deuxième à Ruth");
check(
  "Puis deuxième message valide : autorisé, compteur à 2",
  r.status === 200 && used(cB, "v") === "2",
);

// C. Deux premiers messages envoyés en même temps
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.c}','${id.a}'), ('${id.a}','${id.c}');`,
);
const cC = conv("c", "a");
const burst = await Promise.all([send("c", cC, "Simultané A"), send("c", cC, "Simultané B")]);
check(
  "1er et 2e message partis en même temps : tous deux autorisés, compteur exact (2)",
  burst.every((x) => x.status === 200) && count(cC) === "2" && used(cC, "c") === "2",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q53-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q53-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}','${cC}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
