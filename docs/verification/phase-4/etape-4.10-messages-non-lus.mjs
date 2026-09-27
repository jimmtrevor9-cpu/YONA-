// YONA — Phase 4 / Étape 4.10 — Vérification des messages non lus d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.10-messages-non-lus.mjs
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
sql("delete from auth.users where email like 'test-unrd-%@example.test';");
const stamp = Date.now();
const PWD = "TestUnrd!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-unrd-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Unpaul"),
  a: mk("a", "female", "Ungrace"),
  b: mk("b", "female", "Unruth"),
  c: mk("c", "male", "Untiers"),
  d: mk("d", "female", "Unmarie"),
  e: mk("e", "female", "Unsarah"),
  f: mk("f", "female", "Unanne"),
  g: mk("g", "female", "Unleah"),
  h: mk("h", "female", "Uneve"),
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
const tok = {};
for (const t of ["v", "a", "b", "c", "d", "e", "f", "g", "h"]) tok[t] = await tokenOf(t);
const rpc = async (tag, fn, args = {}) => {
  const res = await fetch(`${API}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tag ? tok[tag] : KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
};
const send = (tag, c, content) =>
  rpc(tag, "send_message", { _conversation_id: c, _content: content });
const unreadOf = async (tag) => {
  const r = await rpc(tag, "get_unread_counts");
  return Object.fromEntries((r.json ?? []).map((x) => [x.conversation_id, x.unread]));
};
const cBc = conv("b");
const listRow = (page, name) =>
  page.getByRole("link", { name: `Ouvrir la conversation avec ${name}`, exact: true });
const rowBadge = async (page, name) => {
  const b = listRow(page, name).getByTestId("unread-count");
  return (await b.count()) ? ((await b.textContent()) ?? "").replace(/ —.*/, "").trim() : "";
};
const navBadge = async (page) => {
  const b = page.getByTestId("unread-total");
  return (await b.count()) ? ((await b.textContent()) ?? "").trim() : "";
};
const waitFor = async (fn, expected, tries = 80) => {
  let v;
  for (let i = 0; i < tries; i++) {
    v = await fn();
    if (v === expected) return v;
    await new Promise((r) => setTimeout(r, 100));
  }
  return v;
};
const openList = async (page) => {
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.getByTestId("messages-page").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1000);
};

// A. Compteurs
await send("a", cA, "Bonjour Paul");
await send("a", cA, "Tu vas bien ?");
await send("a", cA, "À bientôt");
sql(
  `insert into public.messages (conversation_id, sender_id, content, status) values ('${cA}','${id.a}','Retenu par la modération','blocked');`,
);
await send("v", cBc, "Bonjour Ruth");
const pv = await login("v");
await openList(pv);
check(
  "Grace : 3 non lus sur sa conversation",
  (await rowBadge(pv, "Ungrace")) === "3",
  await rowBadge(pv, "Ungrace"),
);
check(
  "Message retenu par la modération et ses propres messages : non comptés",
  (await rowBadge(pv, "Unruth")) === "" && (await unreadOf("v"))[cA] === 3,
);
check(
  "Conversation avec non-lus : aperçu en gras ; sans non-lu : normal",
  (await listRow(pv, "Ungrace").locator("p.font-semibold").count()) === 1 &&
    (await listRow(pv, "Unruth").locator("p.font-semibold").count()) === 0,
);
check(
  "Lecteurs d'écran : « 3 messages non lus » lié à la conversation",
  (await listRow(pv, "Ungrace").getAttribute("aria-describedby")) !== null &&
    ((await listRow(pv, "Ungrace").getByTestId("unread-count").textContent()) ?? "").includes(
      "3 messages non lus",
    ),
);
check("Barre du bas : pastille « 3 » sur Messages", (await navBadge(pv)) === "3");
check(
  "Barre du bas : « Messages, 3 messages non lus » pour les lecteurs d'écran",
  ((await pv.locator("nav a[href='/messages']").textContent()) ?? "").includes(
    "3 messages non lus",
  ),
);
await pv.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pv.waitForTimeout(800);
check("Pastille visible depuis les autres pages (Découvrir)", (await navBadge(pv)) === "3");

// B. En direct
await send("b", cBc, "Réponse de Ruth");
check(
  "Nouveau message reçu : pastille mise à jour sans recharger (4)",
  (await waitFor(() => navBadge(pv), "4")) === "4",
);
await openList(pv);
await send("b", cBc, "Encore Ruth");
check(
  "Sur « Messages » : compteur de Ruth mis à jour en direct (2)",
  (await waitFor(() => rowBadge(pv, "Unruth"), "2")) === "2",
);

// C. Lecture
await listRow(pv, "Ungrace").click();
await pv.getByTestId("conversation-thread").waitFor();
check(
  "Ouverture de la conversation : lue (pastille 4 → 2)",
  (await waitFor(() => navBadge(pv), "2")) === "2",
);
check(
  "Date de lecture enregistrée par le serveur",
  sql(
    `select count(*) from public.conversation_reads where conversation_id='${cA}' and user_id='${id.v}' and last_read_at <= now()`,
  ) === "1",
);
await send("a", cA, "Message pendant la lecture");
await pv
  .getByText("Message pendant la lecture")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
await pv.waitForTimeout(1500);
check(
  "Message reçu pendant que la conversation est ouverte : affiché et déjà lu",
  (await pv.getByText("Message pendant la lecture").count()) === 1 &&
    (await navBadge(pv)) === "2" &&
    !(cA in (await unreadOf("v"))),
);
await pv.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
});
await send("a", cA, "Message onglet caché");
await pv
  .getByText("Message onglet caché")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
await pv.waitForTimeout(1500);
check("Onglet en arrière-plan : le message reste non lu", (await unreadOf("v"))[cA] === 1);
await pv.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
});
await pv.waitForTimeout(1500);
check("Retour sur l'onglet : conversation marquée lue", !(cA in (await unreadOf("v"))));
await pv.getByRole("link", { name: "Messages" }).first().click();
await pv.waitForURL(/\/messages$/);
await pv.waitForTimeout(1000);
check(
  "Retour à la liste : Grace sans compteur, Ruth toujours 2",
  (await rowBadge(pv, "Ungrace")) === "" && (await rowBadge(pv, "Unruth")) === "2",
);

// D. Persistance, autre appareil, l'autre côté
const pv2 = await login("v");
await openList(pv2);
check(
  "Nouvelle session (autre appareil) : mêmes non-lus (gardés par le serveur)",
  (await rowBadge(pv2, "Unruth")) === "2" &&
    (await rowBadge(pv2, "Ungrace")) === "" &&
    (await navBadge(pv2)) === "2",
);
check(
  "Grace : Paul n'a pas encore écrit → aucun non-lu chez elle",
  Object.keys(await unreadOf("a")).length === 0,
);
await send("v", cA, "Réponse de Paul");
check(
  "Grace : 1 non-lu après la réponse de Paul (indépendant de Paul)",
  (await unreadOf("a"))[cA] === 1,
);
const values = [];
for (let i = 0; i < 120; i++)
  values.push(`('${conv("d")}','${id.d}','Message ${i}', now() - interval '${200 - i} seconds')`);
sql(
  `insert into public.messages (conversation_id, sender_id, content, created_at) values ${values.join(",")};`,
);
await openList(pv);
check(
  "120 non lus : pastille « 99+ »",
  (await rowBadge(pv, "Unmarie")) === "99+" && (await navBadge(pv)) === "99+",
);

// E. Conversations non affichées : non comptées
await send("e", conv("e"), "Message e");
await send("f", conv("f"), "Message f");
await send("g", conv("g"), "Message g");
await send("h", conv("h"), "Message h");
const beforeHide = await unreadOf("v");
sql(`update public.conversations set status='closed' where id='${conv("e")}';
     update public.matches set status='unmatched' where id=(select match_id from public.conversations where id='${conv("f")}');
     insert into public.blocks (blocker_id, blocked_id) values ('${id.v}','${id.g}');
     update public.profiles set visibility='hidden' where user_id='${id.h}';`);
const after = await unreadOf("v");
check(
  "Conversation fermée, Match défait, blocage, profil masqué : non comptés",
  [conv("e"), conv("f"), conv("g"), conv("h")].every((c) => beforeHide[c] === 1 && !(c in after)),
);

// F. Sécurité
let r = await rpc("c", "mark_conversation_read", { _conversation_id: cBc });
check(
  "Un tiers ne peut pas marquer la conversation comme lue",
  r.text.includes("conversation_unavailable"),
);
check("Un tiers n'a aucun non-lu", Object.keys(await unreadOf("c")).length === 0);
r = await rpc(null, "get_unread_counts");
const r2 = await rpc(null, "mark_conversation_read", { _conversation_id: cA });
check(
  "Sans connexion : fonctions inaccessibles",
  r.status >= 400 && r2.status >= 400,
  `${r.status}/${r2.status}`,
);
const hdr = { apikey: KEY, Authorization: `Bearer ${tok.v}`, "Content-Type": "application/json" };
const ins = await fetch(`${API}/rest/v1/conversation_reads`, {
  method: "POST",
  headers: hdr,
  body: JSON.stringify({
    conversation_id: cBc,
    user_id: id.v,
    last_read_at: "2999-01-01T00:00:00Z",
  }),
});
const upd = await fetch(`${API}/rest/v1/conversation_reads?user_id=eq.${id.v}`, {
  method: "PATCH",
  headers: hdr,
  body: JSON.stringify({ last_read_at: "2999-01-01T00:00:00Z" }),
});
check(
  "Écriture directe de la date de lecture : refusée (date du futur impossible)",
  [401, 403].includes(ins.status) &&
    [401, 403].includes(upd.status) &&
    sql(
      `select count(*) from public.conversation_reads where last_read_at > now() + interval '1 minute'`,
    ) === "0",
  `${ins.status}/${upd.status}`,
);
const otherReads = await fetch(
  `${API}/rest/v1/conversation_reads?select=user_id&user_id=eq.${id.a}`,
  { headers: hdr },
).then((x) => x.json());
check(
  "Les lectures des autres ne sont pas visibles",
  Array.isArray(otherReads) && otherReads.length === 0,
);
const t1 = sql(
  `select last_read_at from public.conversation_reads where conversation_id='${cA}' and user_id='${id.v}'`,
);
sql(
  `update public.conversation_reads set last_read_at = now() + interval '1 hour' where conversation_id='${cA}' and user_id='${id.v}'`,
);
await rpc("v", "mark_conversation_read", { _conversation_id: cA });
check(
  "La date de lecture ne recule jamais",
  sql(
    `select last_read_at > now() + interval '50 minutes' from public.conversation_reads where conversation_id='${cA}' and user_id='${id.v}'`,
  ) === "t",
  t1,
);

// G. Petit écran, erreurs
const small = await login("v", 320);
await openList(small);
check(
  "Petit écran (320 px) : pastilles visibles, sans débordement",
  (await navBadge(small)) === "99+" &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-unrd-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et lectures de test supprimés",
  sql("select count(*) from auth.users where email like 'test-unrd-%'") === "0" &&
    sql(`select count(*) from public.conversation_reads where conversation_id='${cA}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
