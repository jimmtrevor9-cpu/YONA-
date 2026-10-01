// YONA — Phase 5 / Étape 6.7 — Vérification du blocage des messages contenant un numéro.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-6/etape-6.7-bloquer-message.mjs
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
sql("delete from auth.users where email like 'test-t67-%@example.test';");
const stamp = Date.now();
const PWD = "TestT67!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-t67-${tag}-${stamp}@example.test`;
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

const numeros = [
  "Appelle-moi au 06 12 34 56 78",
  "+237 699 88 77 66",
  "mon WhatsApp : zéro six douze trente-quatre cinquante-six soixante-dix-huit",
  "06.12.34.56.78",
  "(06) 12-34-56-78",
  "０６１２３４５６７８",
  "O6 l2 34 56 78",
];
const normaux = [
  "Bonjour Grace, ravi de ce Match !",
  "On se voit le 12/10/2026 à 14:30 ?",
  "J'ai 34 ans et deux enfants (5 et 7 ans).",
];

// A. Appels directs à la base
const before = count(cA);
let refused = 0;
for (const n of numeros) {
  const r = await send("v", cA, n);
  if (r.text.includes("phone_number_detected")) refused++;
}
check(
  `${numeros.length} messages avec numéro (formes variées) : tous refusés (phone_number_detected)`,
  refused === numeros.length,
  `${refused}/${numeros.length}`,
);
check(
  "Aucun de ces messages n'est enregistré (ni délivré, ni stocké)",
  count(cA) === before &&
    sql(
      `select count(*) from public.messages where content like '%12 34 56 78%' or content like '%699 88%'`,
    ) === "0",
);
check("Quota non consommé par les refus (compteur de Paul à 0)", used(cA, "v") === "0");
let accepted = 0;
for (const n of normaux) if ((await send("v", cA, n)).status === 200) accepted++;
check(
  "Messages ordinaires (date, heure, âges) : toujours acceptés",
  accepted === normaux.length && used(cA, "v") === "3",
);
let r = await send("c", cA, "06 12 34 56 78");
check(
  "Personne extérieure avec un numéro : refusée, rien d'enregistré",
  !r.text.includes('"id"') && count(cA) === "3",
);

// B. Depuis l'application
const pv = await login("v");
await openConv(pv, cB);
const pb = await login("b");
await openConv(pb, cB);
await field(pv).fill("Voici mon numéro : 06 12 34 56 78");
await button(pv).click();
const msg = await toastText(pv);
await pv.waitForTimeout(800);
check(
  "Envoi d'un numéro depuis l'application : refusé (message d'erreur affiché)",
  msg.length > 0,
  msg,
);
check(
  "Message retiré du fil, texte remis dans le champ, rien enregistré",
  (await pv
    .locator("ol[aria-label=Messages] > li")
    .filter({ hasText: "06 12 34 56 78" })
    .count()) === 0 &&
    (await field(pv).inputValue()) === "Voici mon numéro : 06 12 34 56 78" &&
    count(cB) === "0",
);
await pb.waitForTimeout(1500);
check("Ruth ne reçoit rien", (await pb.getByText("06 12 34 56 78").count()) === 0);
check("Quota de Paul intact (3 restants)", used(cB, "v") === "0");
await field(pv).fill("Finalement, écrivons-nous ici !");
await button(pv).click();
await waitCount(cB, 1);
check(
  "Message suivant sans numéro : envoyé normalement",
  count(cB) === "1" && used(cB, "v") === "1",
);

// C. Appel direct du serveur de l'application
let captured = null;
pv.on("request", (q) => {
  if (q.url().includes("/_serverFn/") && q.method() === "POST" && !captured)
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await field(pv).fill("Capture 1");
await button(pv).click();
await waitCount(cB, 2);
const replay = await fetch(captured.url, {
  method: "POST",
  headers: Object.fromEntries(
    Object.entries(captured.headers).filter(
      ([k]) => !["host", "content-length", "connection"].includes(k),
    ),
  ),
  body: captured.body.replace("Capture 1", "+33 6 12 34 56 78"),
}).then((x) => x.text());
check(
  "Appel direct du serveur de l'application avec un numéro : refusé, rien enregistré",
  count(cB) === "2" && !replay.includes('+33 6 12 34 56 78"'),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-t67-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-t67-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
