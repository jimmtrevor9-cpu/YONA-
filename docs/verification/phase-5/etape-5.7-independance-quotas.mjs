// YONA — Phase 5 / Étape 5.7 — Vérification de l'indépendance des quotas.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-5/etape-5.7-independance-quotas.mjs
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
sql("delete from auth.users where email like 'test-q57-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ57!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q57-${tag}-${stamp}@example.test`;
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
  d: mk("d", "female", "Qmarie"),
};
// Marie a un Match avec Paul (sa suppression de compte ne doit rien changer pour lui).
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.d}'), ('${id.d}','${id.v}');`,
);
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

const sendN = async (tag, c, n, prefix) => {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(await send(tag, c, `${prefix} ${i}`));
  return out;
};
const refusedLimit = (r) => r.text.includes("free_limit_reached");

// A. Deux participants : chacun ses 3 messages
let rs = await sendN("v", cA, 3, "Paul");
check(
  "Paul envoie 3 messages à Grace : acceptés",
  rs.every((r) => r.status === 200) && used(cA, "v") === "3",
);
check("Compteur de Grace inchangé par les messages de Paul (0)", used(cA, "a") === "0");
check("4e message de Paul refusé", refusedLimit(await send("v", cA, "Paul 4")));
rs = await sendN("a", cA, 3, "Grace");
check(
  "Grace garde ses 3 messages malgré le blocage de Paul",
  rs.every((r) => r.status === 200) && used(cA, "a") === "3",
);
check("Puis le 4e de Grace est refusé (elle aussi)", refusedLimit(await send("a", cA, "Grace 4")));
check("Paul reste à 3 (les messages de Grace ne changent rien pour lui)", used(cA, "v") === "3");

// B. Conversations indépendantes
rs = await sendN("v", cB, 3, "À Ruth");
check(
  "Paul bloqué avec Grace mais 3 messages acceptés avec Ruth",
  rs.every((r) => r.status === 200) && used(cB, "v") === "3",
);
check("Compteur de Ruth inchangé (0)", used(cB, "b") === "0");
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.c}'), ('${id.c}','${id.v}');`,
);
const cC = conv("v", "c");
check("Nouveau Match ensuite : nouvelle conversation, Paul repart à 0", used(cC, "v") === "0");
check(
  "… et peut y écrire",
  (await send("v", cC, "Nouveau Match")).status === 200 && used(cC, "v") === "1",
);

// C. Envois simultanés des deux côtés
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.b}','${id.c}'), ('${id.c}','${id.b}');`,
);
const cD = conv("b", "c");
const both = await Promise.all([
  ...[1, 2, 3].map((i) => send("b", cD, `Ruth ${i}`)),
  ...[1, 2, 3].map((i) => send("c", cD, `Tiers ${i}`)),
]);
check(
  "Les deux participants envoient 3 messages au même moment : 6 acceptés, 3 + 3",
  both.every((r) => r.status === 200) &&
    used(cD, "b") === "3" &&
    used(cD, "c") === "3" &&
    count(cD) === "6",
);
const fourth = await Promise.all([send("b", cD, "Ruth 4"), send("c", cD, "Tiers 4")]);
check("Puis le 4e de chacun est refusé", fourth.every(refusedLimit) && count(cD) === "6");

// D. Événements sans effet sur les quotas
const snapshot = () =>
  sql(
    `select string_agg(conversation_id::text || user_id::text || free_messages_used, ',' order by conversation_id, user_id) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}','${cC}','${cD}')`,
  );
const before = snapshot();
const matchA = sql(`select match_id from public.conversations where id='${cA}'`);
sql(
  `update public.matches set status='unmatched' where id='${matchA}'; update public.conversations set status='closed' where id='${cA}';`,
);
sql(`update public.matches set status='active' where id='${matchA}';`);
check(
  "Match défait puis refait : compteurs conservés (Paul et Grace toujours à 3)",
  snapshot() === before && refusedLimit(await send("v", cA, "Après rematch")),
);
sql(
  `insert into public.blocks (blocker_id, blocked_id) values ('${id.a}','${id.v}'); delete from public.blocks where blocker_id='${id.a}';`,
);
sql(
  `update public.profiles set visibility='hidden' where user_id='${id.b}'; update public.profiles set visibility='visible' where user_id='${id.b}';`,
);
check(
  "Blocage puis déblocage, profil masqué puis visible : compteurs inchangés",
  snapshot() === before,
);
sql(
  `update public.messages set status='deleted' where conversation_id='${cA}' and sender_id='${id.v}';`,
);
check(
  "Messages supprimés : aucun message rendu (compteur toujours 3, envoi refusé)",
  used(cA, "v") === "3" && refusedLimit(await send("v", cA, "Après suppression")),
);
check(
  "Ancien compteur partagé de la conversation : jamais modifié par les envois (0)",
  sql(
    `select max(free_messages_used) from public.conversations where id in ('${cA}','${cB}','${cC}','${cD}')`,
  ) === "0",
);
const cM = conv("v", "d");
sql(`delete from auth.users where id='${id.d}'`);
check(
  "Suppression du compte de Marie (Match de Paul) : compteurs des autres conversations inchangés",
  snapshot() === before &&
    sql(`select count(*) from public.conversation_user_usage where conversation_id='${cM}'`) ===
      "0",
);

// E. Affichage
const pv = await login("v");
await openConv(pv, cA);
const qA = await waitQuota(
  pv,
  "Vous avez utilisé vos 3 messages gratuits dans cette conversation.",
);
await openConv(pv, cC);
const qC = await waitQuota(pv, "2 messages gratuits restants dans cette conversation");
check(
  "Paul voit « utilisé vos 3 » avec Grace et « 2 restants » avec le nouveau Match",
  qA.startsWith("Vous avez utilisé") && qC.startsWith("2 messages"),
  `${qA} | ${qC}`,
);
const pc = await login("c");
await openConv(pc, cC);
check(
  "L'autre personne de ce Match voit ses propres 3 messages restants",
  (await waitQuota(pc, "3 messages gratuits restants dans cette conversation")).startsWith(
    "3 messages",
  ),
);
let r = await api("v", "rpc/get_message_quota", "POST", { _conversation_id: cD });
check(
  "Paul ne peut pas lire le quota d'une conversation qui n'est pas la sienne",
  r.text.includes("conversation_unavailable"),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q57-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q57-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}','${cC}','${cD}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
