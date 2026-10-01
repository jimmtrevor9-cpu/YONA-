// YONA — Phase 5 / Étape 5.6 — Vérification de l'affichage des messages restants.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-5/etape-5.6-messages-restants.mjs
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
sql("delete from auth.users where email like 'test-q56-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ56!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q56-${tag}-${stamp}@example.test`;
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

// A. Décompte affiché
const pv = await login("v");
await openConv(pv, cA);
check(
  "Ouverture : « 3 messages gratuits restants dans cette conversation »",
  (await waitQuota(pv, L3)) === L3,
);
check(
  "Texte lié au champ pour les lecteurs d'écran",
  ((await field(pv).getAttribute("aria-describedby")) ?? "").includes(
    (await pv.getByTestId("message-quota").getAttribute("id")) ?? "§",
  ),
);
await field(pv).fill("Message 1");
await button(pv).click();
check("Après le 1er message : « 2 messages gratuits restants… »", (await waitQuota(pv, L2)) === L2);
await field(pv).fill("Message 2");
await button(pv).click();
check("Après le 2e : « 1 message gratuit restant… » (singulier)", (await waitQuota(pv, L1)) === L1);
await field(pv).fill("Message 3");
await button(pv).click();
check(
  "Après le 3e : « Vous avez utilisé vos 3 messages gratuits… »",
  (await waitQuota(pv, L0)) === L0,
);
check(
  "À 0 : message en rouge, champ et bouton désactivés, texte d'aide adapté",
  ((await pv.getByTestId("message-quota").getAttribute("class")) ?? "").includes(
    "text-destructive",
  ) &&
    (await field(pv).isDisabled()) &&
    (await button(pv).isDisabled()) &&
    (await field(pv).getAttribute("placeholder")) === "Messages gratuits utilisés",
);
check("Compteur serveur cohérent (3 utilisés)", used(cA, "v") === "3" && count(cA) === "3");

// B. Persistance, autre appareil, autre personne, autre conversation
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check(
  "Après rechargement : toujours « utilisé vos 3 messages » et champ fermé",
  (await waitQuota(pv, L0)) === L0 && (await field(pv).isDisabled()),
);
const pv2 = await login("v");
await openConv(pv2, cA);
check("Autre appareil : même décompte (gardé par le serveur)", (await waitQuota(pv2, L0)) === L0);
const pa = await login("a");
await openConv(pa, cA);
check(
  "Grace : ses propres 3 messages restants (indépendant de Paul)",
  (await waitQuota(pa, L3)) === L3 && (await field(pa).isEnabled()),
);
await openConv(pv, cB);
check("Paul, autre conversation : « 3 restants »", (await waitQuota(pv, L3)) === L3);

// C. Refus après un envoi depuis un autre onglet
await openConv(pv, cB);
await send("v", cB, "Depuis ailleurs 1");
await send("v", cB, "Depuis ailleurs 2");
await send("v", cB, "Depuis ailleurs 3");
await field(pv).fill("Onglet resté ouvert");
await button(pv).click();
await pv.waitForTimeout(1500);
check(
  "Onglet resté ouvert sur « 3 restants » : envoi refusé par le serveur, puis décompte mis à jour (0)",
  (await waitQuota(pv, L0)) === L0 &&
    count(cB) === "3" &&
    (await field(pv).inputValue()) === "Onglet resté ouvert",
);

// D. Sécurité
let r = await api("c", "rpc/get_message_quota", "POST", { _conversation_id: cA });
check(
  "Un tiers ne peut pas lire le quota de la conversation",
  r.text.includes("conversation_unavailable"),
);
r = await api(null, "rpc/get_message_quota", "POST", { _conversation_id: cA });
check("Sans connexion : refusé", r.status >= 400, String(r.status));
r = await api("a", "rpc/get_message_quota", "POST", { _conversation_id: cA });
check(
  "Chacun ne lit que son propre quota (Grace : 0 utilisé)",
  r.json?.[0]?.used === 0 && r.json?.[0]?.remaining === 3,
);

// E. Petit écran
const small = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
small.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await small.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await small.fill("#email", emails.v);
await small.fill("#password", PWD);
await small.click("button[type=submit]");
await small.waitForURL(/\/discover$/, { timeout: 8000 });
await openConv(small, cA);
await waitQuota(small, L0);
check(
  "Petit écran (320 px) : message lisible, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q56-%@example.test';");
check(
  "Nettoyage : comptes, conversations, messages et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q56-%'") === "0" &&
    sql(
      `select count(*) from public.conversation_user_usage where conversation_id in ('${cA}','${cB}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
