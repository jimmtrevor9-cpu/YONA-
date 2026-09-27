// YONA — Phase 4 / Étape 4.8 — Vérification de l'enregistrement des messages d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.8-enregistrer-message.mjs
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
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-emsg-%@example.test';");
const stamp = Date.now();
const PWD = "TestEmsg!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-emsg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Empaul"),
  a: mk("a", "female", "Emgrace"),
  b: mk("b", "female", "Emruth"),
  c: mk("c", "male", "Emtiers"),
  d: mk("d", "female", "Emmarie"),
  e: mk("e", "female", "Emsarah"),
  f: mk("f", "female", "Emanne"),
  g: mk("g", "female", "Emleah"),
  h: mk("h", "female", "Emeve"),
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
const clearToasts = async (page) => {
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
};
const count = (c, extra = "") =>
  sql(`select count(*) from public.messages where conversation_id='${c}' ${extra}`);
const waitCount = async (c, n) => {
  for (let i = 0; i < 60 && count(c) !== String(n); i++)
    await new Promise((r) => setTimeout(r, 100));
  return count(c);
};
const sendVia = async (page, text, how = "click") => {
  await field(page).fill(text);
  if (how === "click") await button(page).click();
  else {
    await field(page).focus();
    await page.keyboard.press("Control+Enter");
  }
};

// A. Envoi nominal
const pv = await login("v");
await openConv(pv, cA);
const before = sql("select now()");
await sendVia(pv, "Bonjour Grace !");
check("Clic sur Envoyer : 1 message enregistré", (await waitCount(cA, 1)) === "1");
const row = sql(
  `select sender_id='${id.v}', status, moderation_status, content, created_at >= '${before}'::timestamptz and created_at <= now() from public.messages where conversation_id='${cA}'`,
);
check(
  "Auteur = personne connectée ; statut « délivré » ; date fixée par le serveur",
  row === "t|delivered|clean|Bonjour Grace !|t",
  row,
);
check(
  "Date du dernier message de la conversation mise à jour",
  sql(
    `select c.last_message_at = m.created_at from public.conversations c join public.messages m on m.conversation_id=c.id where c.id='${cA}'`,
  ) === "t",
);
for (let i = 0; i < 30 && (await field(pv).inputValue()) !== ""; i++) await pv.waitForTimeout(100);
check(
  "Champ vidé après l'envoi ; curseur dans le champ",
  (await field(pv).inputValue()) === "" &&
    (await pv.evaluate(() => document.activeElement?.id === "message-input")),
);
await pv
  .getByText("Bonjour Grace !")
  .first()
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Message affiché dans le fil, côté expéditeur",
  (await pv
    .locator("ol[aria-label=Messages] > li[data-from=me]")
    .filter({ hasText: "Bonjour Grace !" })
    .count()) === 1,
);
await sendVia(pv, "   \n  Deux lignes\n  de texte  \n\n ");
await waitCount(cA, 2);
check(
  "Espaces et retours à la ligne de début / fin retirés ; lignes internes conservées",
  sql(
    `select content from public.messages where conversation_id='${cA}' order by created_at desc limit 1`,
  ) === "Deux lignes\n  de texte",
);
await sendVia(pv, "Envoyé au clavier", "keyboard");
check("Ctrl+Entrée : message enregistré", (await waitCount(cA, 3)) === "3");
await sendVia(pv, "é".repeat(4000));
check(
  "4 000 caractères (limite) : enregistré en entier",
  (await waitCount(cA, 4)) === "4" &&
    sql(`select max(char_length(content)) from public.messages where conversation_id='${cA}'`) ===
      "4000",
);
await field(pv).fill("Un seul envoi");
await button(pv).dblclick();
await pv.waitForTimeout(1500);
check("Double clic : un seul message", count(cA, "and content='Un seul envoi'") === "1");
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check(
  "Rechargement : messages toujours là, champ vide (brouillon effacé)",
  (await pv.locator("ol[aria-label=Messages] > li").count()) === 5 &&
    (await field(pv).inputValue()) === "",
);

// B. L'autre personne
const pa = await login("a");
await pa.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await pa.waitForTimeout(1200);
const firstRow = (
  (await pa.locator("[aria-label='Liste de vos conversations'] li").first().textContent()) ?? ""
).trim();
check(
  "Grace : la conversation avec Paul montre le dernier message",
  firstRow.includes("Emp") && firstRow.includes("Un seul envoi"),
  firstRow.slice(0, 80),
);
await openConv(pa, cA);
check(
  "Grace voit les messages de Paul (côté gauche)",
  (await pa.locator("ol[aria-label=Messages] > li[data-from=other]").count()) === 5,
);
await sendVia(pa, "Bonjour Paul !");
await waitCount(cA, 6);
check(
  "Grace répond : message enregistré à son nom",
  sql(
    `select count(*) from public.messages where conversation_id='${cA}' and sender_id='${id.a}' and content='Bonjour Paul !'`,
  ) === "1",
);

// C. Refus pendant la visite (texte conservé, rien d'enregistré)
const cases = [
  [
    "Conversation fermée",
    "b",
    `update public.conversations set status='closed' where id='${conv("b")}'`,
  ],
  [
    "Match défait",
    "d",
    `update public.matches set status='unmatched' where id=(select match_id from public.conversations where id='${conv("d")}')`,
  ],
  [
    "Blocage par l'autre personne",
    "e",
    `insert into public.blocks (blocker_id, blocked_id) values ('${id.e}','${id.v}')`,
  ],
  [
    "Profil de l'autre masqué",
    "f",
    `update public.profiles set visibility='hidden' where user_id='${id.f}'`,
  ],
];
for (const [label, t, change] of cases) {
  const c = conv(t);
  await openConv(pv, c);
  await field(pv).fill(`Message vers ${t}`);
  sql(change);
  await button(pv).click();
  const msg = await toastText(pv);
  await pv.waitForTimeout(300);
  check(
    `${label} pendant la visite : « Cette conversation n'est plus disponible. », rien d'enregistré`,
    msg.includes("Cette conversation n'est plus disponible.") && count(c) === "0",
    msg,
  );
  await clearToasts(pv);
}
check(
  "… puis la page affiche « Cette conversation n'est pas disponible. »",
  await pv.getByTestId("conversation-unavailable").isVisible(),
);
const cG = conv("g");
await openConv(pv, cG);
await field(pv).fill("Texte à garder");
await pv.route("**/_serverFn/**", (r) => r.abort());
await button(pv).click();
const netMsg = await toastText(pv);
check(
  "Panne réseau : message clair, texte conservé, rien d'enregistré",
  netMsg.includes("n'a pas pu être envoyé") &&
    (await field(pv).inputValue()) === "Texte à garder" &&
    count(cG) === "0",
  netMsg,
);
await pv.unroute("**/_serverFn/**");
await clearToasts(pv);
await button(pv).click();
check("Réseau revenu : nouvel essai réussi", (await waitCount(cG, 1)) === "1");

// D. Appels directs au serveur de l'application (rejeu de l'appel capturé)
const replay = async (conversationId, content, withAuth = true) => {
  const headers = Object.fromEntries(
    Object.entries(captured.headers).filter(
      ([k]) =>
        !["host", "content-length", "connection"].includes(k) &&
        (withAuth || k !== "authorization"),
    ),
  );
  const original = JSON.parse(captured.body);
  const body = JSON.stringify(original)
    .replace(cA, conversationId)
    .replace(/Bonjour Grace !/, content);
  const res = await fetch(captured.url, { method: "POST", headers, body });
  return { status: res.status, text: await res.text() };
};
check("Appel du serveur capturé", !!captured && captured.body.includes("Bonjour Grace !"));
let r = await replay(cA, "Sans connexion", false);
check(
  "Serveur sans connexion : refusé, rien d'enregistré",
  (r.status >= 400 || r.text.includes("Unauthorized")) &&
    count(cA, "and content='Sans connexion'") === "0",
  `HTTP ${r.status}`,
);
r = await replay(cA.toUpperCase(), "Identifiant en majuscules");
check(
  "Identifiant de conversation en MAJUSCULES : accepté (même conversation)",
  count(cA, "and content='Identifiant en majuscules'") === "1",
);
r = await replay(cA, "   ");
check(
  "Serveur : message vide → « Écrivez un message… »",
  r.text.includes("Écrivez un message avant de l'envoyer."),
);
r = await replay(cA, "x".repeat(4001));
check(
  "Serveur : 4 001 caractères → refusé",
  r.text.includes("dépasse 4 000 caractères") && count(cA, "and char_length(content)=4001") === "0",
);
r = await replay("00000000-0000-4000-8000-000000000000", "Inexistante");
check(
  "Serveur : conversation inexistante → « plus disponible »",
  r.text.includes("Cette conversation n'est plus disponible."),
);
const burst = await Promise.all(Array.from({ length: 5 }, (_, i) => replay(cA, `Rafale ${i}`)));
check(
  "5 envois simultanés : 5 messages, date du dernier message = le plus récent",
  burst.every((x) => x.status === 200) &&
    count(cA, "and content like 'Rafale %'") === "5" &&
    sql(
      `select c.last_message_at = (select max(created_at) from public.messages where conversation_id=c.id) from public.conversations c where c.id='${cA}'`,
    ) === "t",
);

// E. Base de données (appels directs)
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
const rpc = async (token, conversationId, content) => {
  const res = await fetch(`${API}/rest/v1/rpc/send_message`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ _conversation_id: conversationId, _content: content }),
  });
  return { status: res.status, text: await res.text() };
};
const tv = await tokenOf("v");
const tc = await tokenOf("c");
r = await rpc(tc, cA, "Intrus");
check(
  "Un tiers ne peut pas écrire dans la conversation",
  r.text.includes("conversation_unavailable") && count(cA, "and content='Intrus'") === "0",
);
r = await rpc(null, cA, "Anonyme");
check(
  "Sans connexion : fonction inaccessible",
  r.status >= 400 && count(cA, "and content='Anonyme'") === "0",
  `HTTP ${r.status}`,
);
r = await rpc(tv, cA, " \n\t ");
check("Base : message vide refusé", r.text.includes("message_empty"));
r = await rpc(tv, cA, "x".repeat(4001));
check("Base : 4 001 caractères refusé", r.text.includes("message_too_long"));
const cH = conv("h");
sql(`update public.conversations set status='locked' where id='${cH}'`);
r = await rpc(tv, cH, "Verrouillée");
check(
  "Conversation verrouillée : refusé",
  r.text.includes("conversation_unavailable") && count(cH) === "0",
);
sql(`update public.conversations set status='open' where id='${cH}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.v}','${id.h}')`);
r = await rpc(tv, cH, "Bloquée par moi");
check(
  "Blocage fait par l'expéditeur : refusé",
  r.text.includes("conversation_unavailable") && count(cH) === "0",
);
sql(`delete from public.blocks where blocker_id='${id.v}';
     update public.profiles set onboarding_completed_at=null where user_id='${id.v}'`);
r = await rpc(tv, cH, "Profil non finalisé");
check(
  "Expéditeur au profil non finalisé : refusé",
  r.text.includes("sender_not_allowed") && count(cH) === "0",
);
sql(`update public.profiles set onboarding_completed_at=now() where user_id='${id.v}';
     update public.users set status='suspended' where id='${id.v}'`);
r = await rpc(tv, cH, "Compte suspendu");
check(
  "Compte de l'expéditeur suspendu : refusé",
  r.text.includes("sender_not_allowed") && count(cH) === "0",
);
sql(`update public.users set status='active' where id='${id.v}'`);
r = await rpc(tv, cH, "Tout est rétabli");
check("Tout rétabli : envoi accepté", r.status === 200 && count(cH) === "1");
const direct = await fetch(`${API}/rest/v1/messages`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${tv}`, "Content-Type": "application/json" },
  body: JSON.stringify({ conversation_id: cA, sender_id: id.a, content: "Au nom de Grace" }),
});
check(
  "Écriture directe dans la table (au nom d'un autre) : refusée",
  direct.status === 401 || direct.status === 403,
  String(direct.status),
);
const mid = sql(
  `select id from public.messages where conversation_id='${cA}' and sender_id='${id.v}' limit 1`,
);
const upd = await fetch(`${API}/rest/v1/messages?id=eq.${mid}`, {
  method: "PATCH",
  headers: { apikey: KEY, Authorization: `Bearer ${tv}`, "Content-Type": "application/json" },
  body: JSON.stringify({ content: "Modifié", status: "delivered" }),
});
const del = await fetch(`${API}/rest/v1/messages?id=eq.${mid}`, {
  method: "DELETE",
  headers: { apikey: KEY, Authorization: `Bearer ${tv}` },
});
check(
  "Modification / suppression directe de son message : refusées",
  (upd.status === 401 || upd.status === 403) &&
    (del.status === 401 || del.status === 403) &&
    sql(`select count(*) from public.messages where id='${mid}' and content<>'Modifié'`) === "1",
  `${upd.status}/${del.status}`,
);

// F. Petit écran, erreurs JS
const small = await login("v", 320);
await openConv(small, cG);
await sendVia(small, "Depuis un petit écran");
check(
  "Petit écran (320 px) : envoi réussi, sans débordement",
  (await waitCount(cG, 2)) === "2" &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
check("Aucune écriture directe dans la table depuis l'application", writes.length === 0);
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-emsg-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-emsg-%'") === "0" &&
    sql(
      `select count(*) from public.messages where conversation_id in ('${cA}','${cG}','${cH}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
