// YONA — Phase 4 / Étape 4.9 — Vérification de l'affichage du nouveau message (envoi et réception en direct) d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.9-nouveau-message.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-nmsg-%@example.test';");
const stamp = Date.now();
const PWD = "TestNmsg!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-nmsg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Nmpaul"),
  a: mk("a", "female", "Nmgrace"),
  b: mk("b", "female", "Nmruth"),
  c: mk("c", "male", "Nmtiers"),
  d: mk("d", "female", "Nmmarie"),
  e: mk("e", "female", "Nmsarah"),
  f: mk("f", "female", "Nmanne"),
  g: mk("g", "female", "Nmleah"),
  h: mk("h", "female", "Nmeve"),
};
for (const t of ["a", "b", "d", "e", "f", "g", "h"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (t) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id.v}'::uuid,'${id[t]}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id[t]}'::uuid)`,
  );
const cA = conv("a");
const cB = conv("b");
const countMessages = () =>
  sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
const writes = [];
let captured = null; // premier appel du serveur « envoyer un message »
async function login(tag, width = 390, context = null) {
  const ctx = context ?? (await browser.newContext({ viewport: { width, height: 800 } }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/messages") && r.method() !== "GET") writes.push(r.method());
    if (r.url().includes("/_serverFn/") && r.method() === "POST" && !captured)
      captured = { url: r.url(), headers: r.headers(), body: r.postData() };
  });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  return page;
}
const openConv = async (page, c) => {
  await page.goto(`${BASE}/messages/${c}`, { waitUntil: "networkidle" });
  await page.getByTestId("conversation-page").waitFor({ timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator(".animate-pulse").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(500);
};
const field = (page) => page.getByLabel(/^Votre message à /);

const button = (page) =>
  page.getByRole("button", { name: /^(Envoyer le message|Envoi du message…)$/ });
const toastText = async (page) => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 100 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
};
const items = (page) => page.locator("ol[aria-label=Messages] > li");
const bubble = (page, text) => items(page).filter({ hasText: text });
const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};
const insert = (c, from, content, status = "delivered") =>
  sql(
    `insert into public.messages (conversation_id, sender_id, content, status) values ('${c}','${id[from]}','${content}','${status}');`,
  );

// A. Côté expéditeur : affichage immédiat
const pv = await login("v");
await openConv(pv, cA);
const pa = await login("a");
await openConv(pa, cA);
await pa.waitForTimeout(1500); // abonnement en direct établi
// Réponse du serveur retardée de 2 s pour observer l'état « Envoi… ».
await pv.route("**/_serverFn/**", async (r) => {
  await new Promise((res) => setTimeout(res, 2000));
  await r.continue();
});
await field(pv).fill("Bonjour Grace !");
await button(pv).click();
await pv.waitForTimeout(300);
check(
  "Envoi : le message apparaît tout de suite, marqué « Envoi… », champ déjà vidé",
  (await bubble(pv, "Bonjour Grace !").count()) === 1 &&
    ((await bubble(pv, "Bonjour Grace !").textContent()) ?? "").includes("Envoi…") &&
    (await field(pv).inputValue()) === "",
);
check(
  "Pendant l'envoi : message à droite (côté expéditeur)",
  (await bubble(pv, "Bonjour Grace !").getAttribute("data-from")) === "me",
);
const confirmed = await waitFor(
  async () =>
    (await bubble(pv, "Bonjour Grace !").count()) === 1 &&
    !((await bubble(pv, "Bonjour Grace !").textContent()) ?? "").includes("Envoi…"),
);
check("Après l'enregistrement : « Envoi… » disparaît, heure affichée", confirmed);
await pv.unroute("**/_serverFn/**");
await pv.waitForTimeout(1500);
check(
  "Pas de doublon (réponse du serveur + réception en direct) : 1 seule bulle",
  (await bubble(pv, "Bonjour Grace !").count()) === 1,
);
check(
  "Dernier message visible en bas de l'écran",
  await pv.evaluate(() => {
    const lis = document.querySelectorAll("ol[aria-label=Messages] > li");
    const r = lis[lis.length - 1].getBoundingClientRect();
    return r.bottom <= innerHeight && r.top >= 0;
  }),
);

// B. Côté destinataire : réception en direct
const received = await waitFor(async () => (await bubble(pa, "Bonjour Grace !").count()) === 1);
check("Grace (page ouverte) reçoit le message sans recharger", received);
check(
  "… à gauche, avec l'heure",
  (await bubble(pa, "Bonjour Grace !").getAttribute("data-from")) === "other" &&
    /\d{2}:\d{2}/.test((await bubble(pa, "Bonjour Grace !").textContent()) ?? ""),
);
for (let i = 1; i <= 5; i++) {
  await field(pv).fill(`Rafale ${i}`);
  await button(pv).click();
  await waitFor(async () => (await field(pv).inputValue()) === "");
  await waitFor(async () => (await bubble(pv, `Rafale ${i}`).count()) === 1);
}
await waitFor(async () => (await bubble(pa, "Rafale 5").count()) === 1);
const order = (await items(pa).allTextContents())
  .map((t) => t.match(/Rafale \d/)?.[0])
  .filter(Boolean);
check(
  "5 messages à la suite : reçus dans l'ordre, sans doublon",
  order.join(",") === "Rafale 1,Rafale 2,Rafale 3,Rafale 4,Rafale 5",
  order.join(","),
);
await field(pa).fill("Bonjour Paul !");
await button(pa).click();
check(
  "Réponse de Grace reçue en direct par Paul",
  await waitFor(async () => (await bubble(pv, "Bonjour Paul !").count()) === 1),
);

// C. Messages non destinés à l'affichage
insert(cA, "v", "Message modéré de Paul", "blocked");
await pv.waitForTimeout(3000);
check(
  "Message de Paul retenu par la modération : jamais reçu par Grace",
  (await bubble(pa, "Message modéré de Paul").count()) === 0,
);
check(
  "… mais affiché en direct chez Paul avec « Non envoyé »",
  (
    (await bubble(pv, "Message modéré de Paul")
      .textContent()
      .catch(() => "")) ?? ""
  ).includes("Non envoyé"),
);
insert(cA, "v", "Message supprimé", "deleted");
await pv.waitForTimeout(2000);
check(
  "Message supprimé : jamais affiché",
  (await bubble(pv, "Message supprimé").count()) === 0 &&
    (await bubble(pa, "Message supprimé").count()) === 0,
);

// D. Lecture de l'historique : pas de saut, bouton « Nouveau message »
const many = [];
for (let i = 0; i < 40; i++)
  many.push(`('${cA}', '${id.v}', 'Ancien ${i}', now() - interval '${2 * 60 - i} minutes')`);
sql(
  `insert into public.messages (conversation_id, sender_id, content, created_at) values ${many.join(",")};`,
);
await openConv(pa, cA);
await pa.waitForTimeout(1500);
await pa.evaluate(() => window.scrollTo(0, 0));
await pa.waitForTimeout(300);
insert(cA, "v", "Nouveau pendant la lecture");
await waitFor(async () => (await bubble(pa, "Nouveau pendant la lecture").count()) === 1);
await pa.waitForTimeout(400);
const pill = pa.getByRole("button", { name: "Nouveau message" });
check(
  "Grace relit l'historique : la page ne saute pas, bouton « Nouveau message » affiché",
  (await pa.evaluate(() => window.scrollY)) < 50 && (await pill.isVisible()),
  String(await pa.evaluate(() => window.scrollY)),
);
await pill.click();
await pa.waitForTimeout(400);
check(
  "Clic sur « Nouveau message » : descend au dernier message, bouton masqué",
  (await pa.evaluate(() => {
    const lis = document.querySelectorAll("ol[aria-label=Messages] > li");
    const r = lis[lis.length - 1].getBoundingClientRect();
    return r.bottom <= innerHeight;
  })) && (await pill.count()) === 0,
);
insert(cA, "v", "Nouveau en bas de page");
await waitFor(async () => (await bubble(pa, "Nouveau en bas de page").count()) === 1);
await pa.waitForTimeout(400);
check(
  "Grace déjà en bas : défilement automatique vers le nouveau message, pas de bouton",
  (await pa.evaluate(() => {
    const lis = document.querySelectorAll("ol[aria-label=Messages] > li");
    const r = lis[lis.length - 1].getBoundingClientRect();
    return r.bottom <= innerHeight && r.top >= 0;
  })) && (await pill.count()) === 0,
);

// E. Échec d'envoi : le message provisoire disparaît
await pv.route("**/_serverFn/**", (r) => r.abort());
await field(pv).fill("Échec d'envoi");
await button(pv).click();
const failMsg = await toastText(pv);
await pv.waitForTimeout(300);
check(
  "Échec : message provisoire retiré du fil, texte conservé, raison affichée",
  (await bubble(pv, "Échec d'envoi").count()) === 0 &&
    (await field(pv).inputValue()) === "Échec d'envoi" &&
    failMsg.includes("n'a pas pu être envoyé"),
  failMsg,
);
await pv.unroute("**/_serverFn/**");

// F. Sans connexion en direct : rattrapage automatique
const pb = await login("b");
await pb.routeWebSocket(/realtime/, (ws) => ws.close());
await openConv(pb, conv("b"));
insert(conv("b"), "v", "Reçu sans le direct");
check(
  "Connexion en direct impossible : le message arrive quand même (vérification toutes les 10 s)",
  await waitFor(async () => (await bubble(pb, "Reçu sans le direct").count()) === 1, 20000),
);

// G. Confidentialité de la diffusion en direct
const listen = async (tag, conversationId) => {
  const client = createClient(API, KEY, { auth: { persistSession: false } });
  await client.auth.signInWithPassword({ email: emails[tag], password: PWD });
  const got = [];
  const channel = client.channel(`test-${tag}-${Date.now()}`).on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (p) => got.push(p.new.content),
  );
  await new Promise((res) => channel.subscribe((s) => s === "SUBSCRIBED" && res()));
  return { client, got };
};
const spyC = await listen("c", cA);
const spyA = await listen("a", cA);
await new Promise((r) => setTimeout(r, 1500));
insert(cA, "v", "Secret pour Grace");
await waitFor(async () => spyA.got.includes("Secret pour Grace"));
await new Promise((r) => setTimeout(r, 1500));
check(
  "Diffusion en direct : Grace (participante) reçoit le message",
  spyA.got.includes("Secret pour Grace"),
);
check(
  "Diffusion en direct : un tiers abonné à la conversation ne reçoit rien",
  spyC.got.length === 0,
  spyC.got.join(","),
);
await spyC.client.removeAllChannels();
await spyA.client.removeAllChannels();

// H. Petit écran, erreurs
const small = await login("v", 320);
await openConv(small, cA);
await field(small).fill("Depuis un petit écran");
await button(small).click();
check(
  "Petit écran (320 px) : message affiché, sans débordement",
  (await waitFor(async () => (await bubble(small, "Depuis un petit écran").count()) === 1)) &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-nmsg-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-nmsg-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id='${cA}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
