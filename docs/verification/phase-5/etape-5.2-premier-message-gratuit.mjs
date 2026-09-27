// YONA — Phase 5 / Étape 5.2 — Vérification du premier message gratuit.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-5/etape-5.2-premier-message-gratuit.mjs
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
sql("delete from auth.users where email like 'test-q52-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ52!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q52-${tag}-${stamp}@example.test`;
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

// A. Premier message depuis l'application
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
await page.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await page.getByTestId("message-composer").waitFor({ timeout: 8000 });
check("Avant tout message : compteur de Paul à 0", used(cA, "v") === "0");
await page.getByLabel(/^Votre message à /).fill("Premier message à Grace");
await page.getByRole("button", { name: "Envoyer le message" }).click();
for (let i = 0; i < 50 && count(cA) !== "1"; i++) await page.waitForTimeout(100);
check("Premier message envoyé depuis l'application : enregistré et délivré", count(cA) === "1");
check("Compteur de Paul : 0 → 1", used(cA, "v") === "1");
check("Compteur de Grace inchangé (0)", used(cA, "a") === "0");
check("Autre conversation de Paul inchangée (0)", used(cB, "v") === "0");
await page
  .getByText("Premier message à Grace")
  .first()
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Message affiché, aucune erreur",
  (await page.getByText("Premier message à Grace").count()) >= 1 && jsErrors.length === 0,
  jsErrors.join(" | "),
);

// B. Envois refusés : jamais comptés
let r = await send("b", cB, "   ");
check(
  "Message vide refusé : compteur de Ruth toujours 0",
  r.text.includes("message_empty") && used(cB, "b") === "0",
);
r = await send("b", cB, "x".repeat(4001));
check(
  "Message trop long refusé : pas compté",
  r.text.includes("message_too_long") && used(cB, "b") === "0",
);
r = await send("c", cB, "Intrus");
check(
  "Tiers refusé : aucun compteur créé ni modifié",
  r.text.includes("conversation_unavailable") &&
    sql(`select count(*) from public.conversation_user_usage where user_id='${id.c}'`) === "0",
);
sql(`update public.conversations set status='closed' where id='${cB}'`);
r = await send("b", cB, "Conversation fermée");
check(
  "Conversation fermée : refusé, pas compté",
  r.text.includes("conversation_unavailable") && used(cB, "b") === "0",
);
sql(`update public.conversations set status='open' where id='${cB}'`);
await page.route("**/_serverFn/**", (x) => x.abort());
await page.getByLabel(/^Votre message à /).fill("Envoi coupé");
await page.getByRole("button", { name: "Envoyer le message" }).click();
await page.waitForTimeout(1500);
check(
  "Panne réseau : message non parti, compteur inchangé (1)",
  used(cA, "v") === "1" && count(cA) === "1",
);
await page.unroute("**/_serverFn/**");

// C. Premier message de l'autre personne, compteur absent
r = await send("a", cA, "Premier message de Grace");
check(
  "Premier message de Grace : son compteur 0 → 1, celui de Paul inchangé (1)",
  r.status === 200 && used(cA, "a") === "1" && used(cA, "v") === "1",
);
sql(
  `delete from public.conversation_user_usage where conversation_id='${cB}' and user_id='${id.b}'`,
);
r = await send("b", cB, "Compteur absent");
check(
  "Compteur absent : créé puis compté (1), message enregistré",
  r.status === 200 && used(cB, "b") === "1" && count(cB) === "1",
);
const burst = await Promise.all([send("v", cB, "Simultané 1"), send("v", cB, "Simultané 2")]);
check(
  "2 envois simultanés : 2 messages, compteur exact (2)",
  burst.every((x) => x.status === 200) && used(cB, "v") === "2",
  used(cB, "v"),
);
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q52-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q52-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
