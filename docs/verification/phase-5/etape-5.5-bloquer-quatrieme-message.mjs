// YONA — Phase 5 / Étape 5.5 — Vérification du blocage du quatrième message.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-5/etape-5.5-bloquer-quatrieme-message.mjs
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
sql("delete from auth.users where email like 'test-q55-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ55!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q55-${tag}-${stamp}@example.test`;
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

// A. Quatrième message depuis l'application
const pv = await login("v");
await openConv(pv, cA);
for (let i = 1; i <= 2; i++) {
  await field(pv).fill(`Message ${i}`);
  await button(pv).click();
  await waitCount(cA, i);
}
// Depuis l'étape 5.6, le champ se ferme à 0 message restant : le 3e message part d'un
// autre appareil, la page de Paul (qui affiche encore 1 restant) tente donc un 4e envoi
// que seul le serveur peut refuser.
await send("v", cA, "Message 3 (autre appareil)");
check("3 messages envoyés : compteur de Paul à 3", used(cA, "v") === "3" && count(cA) === "3");
const lastAt = sql(`select last_message_at from public.conversations where id='${cA}'`);
const pa = await login("a");
await openConv(pa, cA);
await field(pv).fill("Quatrième message");
await button(pv).click();
const msg = await toastText(pv);
check(
  "4ᵉ message : refusé avec « Vous avez utilisé vos 3 messages gratuits… »",
  msg.includes(LIMIT_MSG),
  msg,
);
await pv.waitForTimeout(800);
check(
  "Message non enregistré (ni délivré, ni stocké) ; compteur toujours 3",
  count(cA) === "3" &&
    sql(`select count(*) from public.messages where content='Quatrième message'`) === "0" &&
    used(cA, "v") === "3",
);
check(
  "Le message provisoire disparaît du fil ; le texte revient dans le champ",
  (await pv
    .locator("ol[aria-label=Messages] > li")
    .filter({ hasText: "Quatrième message" })
    .count()) === 0 && (await field(pv).inputValue()) === "Quatrième message",
);
check(
  "Date du dernier message de la conversation inchangée",
  sql(`select last_message_at from public.conversations where id='${cA}'`) === lastAt,
);
await pa.waitForTimeout(1500);
check(
  "Grace ne reçoit rien : elle voit toujours 3 messages (pas 4)",
  (await pa.getByText("Quatrième message").count()) === 0 &&
    (await api("a", `messages?select=id&conversation_id=eq.${cA}`)).json?.length === 3,
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check(
  "Après rechargement : toujours 3 messages ; champ fermé (décompte à 0, étape 5.6)",
  (await pv.locator("ol[aria-label=Messages] > li[data-from=me]").count()) === 3 &&
    (await field(pv).isDisabled()),
);
await pv.getByTestId("message-composer").evaluate((f) => f.requestSubmit());
await pv.waitForTimeout(800);
const msg2 = await pv
  .locator("[data-sonner-toast]")
  .filter({ hasText: "Votre message n'a pas été envoyé" })
  .count();
check(
  "Envoi forcé du formulaire fermé : rien ne part (aucun appel, aucun message)",
  msg2 === 0 && count(cA) === "3",
);

// B. Appels directs
let r = await send("v", cA, "Appel direct");
check(
  "Appel direct à la base : refus « free_limit_reached »",
  r.text.includes("free_limit_reached") && count(cA) === "3",
);
const tries = await Promise.all(
  Array.from({ length: 5 }, (_, i) => send("v", cA, `Insistance ${i}`)),
);
check(
  "5 essais de plus en même temps : tous refusés, compteur 3",
  tries.every((x) => x.text.includes("free_limit_reached")) &&
    count(cA) === "3" &&
    used(cA, "v") === "3",
);
r = await send("a", cA, "Grace peut écrire");
check("Grace (0 message utilisé) peut toujours écrire", r.status === 200 && used(cA, "a") === "1");
r = await send("v", cB, "Paul écrit à Ruth");
check(
  "Paul peut toujours écrire dans une autre conversation",
  r.status === 200 && used(cB, "v") === "1",
);
sql(`update public.conversations set status='closed' where id='${cA}'`);
r = await send("v", cA, "Fermée et quota atteint");
check(
  "Conversation fermée ET quota atteint : « conversation indisponible » (prioritaire)",
  r.text.includes("conversation_unavailable"),
);
sql(`update public.conversations set status='open' where id='${cA}'`);

// C. Envois simultanés depuis 0
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.c}','${id.a}'), ('${id.a}','${id.c}');`,
);
const cC = conv("c", "a");
const burst = await Promise.all(
  Array.from({ length: 6 }, (_, i) => send("c", cC, `Simultané ${i}`)),
);
const okCount = burst.filter((x) => x.status === 200).length;
const refused = burst.filter((x) => x.text.includes("free_limit_reached")).length;
check(
  "6 messages partis en même temps : exactement 3 acceptés, 3 refusés, compteur 3",
  okCount === 3 && refused === 3 && count(cC) === "3" && used(cC, "c") === "3",
  `${okCount} acceptés / ${refused} refusés`,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q55-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q55-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}','${cC}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
