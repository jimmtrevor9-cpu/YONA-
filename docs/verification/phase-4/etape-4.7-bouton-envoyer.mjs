// YONA — Phase 4 / Étape 4.7 — Vérification du bouton Envoyer d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.7-bouton-envoyer.mjs
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
sql("delete from auth.users where email like 'test-bmsg-%@example.test';");
const stamp = Date.now();
const PWD = "TestBmsg!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-bmsg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Bmpaul"),
  a: mk("a", "female", "Bmgrace"),
  b: mk("b", "female", "Bmruth"),
  c: mk("c", "male", "Bmtiers"),
};
for (const t of ["a", "b"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (t) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id.v}'::uuid,'${id[t]}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id[t]}'::uuid)`,
  );
const cA = conv("a");
const cB = conv("b");
const values = [];
for (let i = 0; i < 30; i++)
  values.push(
    `('${cA}', '${id[i % 2 ? "v" : "a"]}', 'Message numéro ${i + 1}', now() - interval '${60 - i} minutes')`,
  );
sql(
  `insert into public.messages (conversation_id, sender_id, content, created_at) values ${values.join(",")};`,
);
const countMessages = () =>
  sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
const writes = [];
async function login(tag, width = 390, context = null) {
  const ctx = context ?? (await browser.newContext({ viewport: { width, height: 800 } }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  page.on("request", (r) => {
    if (r.url().includes("/rest/v1/messages") && r.method() !== "GET") writes.push(r.method());
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

const button = (page) => page.getByRole("button", { name: /^(Envoyer le message|Envoi du message…)$/ });
const infoToast = (page) =>
  page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "L'envoi des messages n'est pas encore activé." });
const waitToast = async (page) => {
  for (let i = 0; i < 30 && (await infoToast(page).count()) === 0; i++)
    await page.waitForTimeout(100);
  return (await infoToast(page).count()) > 0;
};
const clearToasts = async (page) => {
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
};

// A. Présence et état du bouton
const pv = await login("v");
await openConv(pv, cA);
check(
  "Bouton « Envoyer le message » présent à côté du champ",
  (await button(pv).count()) === 1 &&
    (await pv.getByTestId("message-composer").getByRole("button").count()) === 1,
);
const pos = await pv.evaluate(() => {
  const f = document.getElementById("message-input").getBoundingClientRect();
  const b = [
    ...document.querySelectorAll("[data-testid=message-composer] button"),
  ][0].getBoundingClientRect();
  return {
    fRight: f.right,
    bLeft: b.left,
    bBottom: b.bottom,
    fBottom: f.bottom,
    w: b.width,
    h: b.height,
  };
});
check(
  "Bouton à droite du champ, aligné en bas, taille tactile (≥ 40 px)",
  pos.bLeft >= pos.fRight && Math.abs(pos.bBottom - pos.fBottom) < 1 && pos.w >= 40 && pos.h >= 40,
  JSON.stringify(pos),
);
check("Champ vide : bouton désactivé", await button(pv).isDisabled());
await field(pv).fill("   \n\n   ");
check(
  "Seulement des espaces / retours à la ligne : bouton désactivé",
  await button(pv).isDisabled(),
);
await field(pv).fill("Bonjour Grace !");
check("Texte saisi : bouton activé", await button(pv).isEnabled());
await field(pv).fill("");
check("Texte effacé : bouton de nouveau désactivé", await button(pv).isDisabled());
await field(pv).fill("a".repeat(4000));
check("Texte de 4 000 caractères (limite) : bouton activé", await button(pv).isEnabled());

// B. Clic, clavier, protections
await field(pv).fill("Bonjour Grace !\nComment vas-tu ?");
await button(pv).click();
check(
  "Clic : message clair « L'envoi des messages n'est pas encore activé. Votre texte est conservé. »",
  await waitToast(pv),
);
check(
  "Après le clic : texte conservé, rien d'enregistré",
  (await field(pv).inputValue()) === "Bonjour Grace !\nComment vas-tu ?" &&
    countMessages() === "30" &&
    writes.length === 0,
);
check(
  "Après le clic : le curseur revient dans le champ",
  await pv.evaluate(() => document.activeElement?.id === "message-input"),
);
await clearToasts(pv);
await field(pv).focus();
await pv.keyboard.press("Enter");
check(
  "Entrée seule : nouvelle ligne, pas d'envoi",
  (await field(pv).inputValue()) === "Bonjour Grace !\nComment vas-tu ?\n" &&
    (await infoToast(pv).count()) === 0,
);
await pv.keyboard.press("Control+Enter");
check("Ctrl+Entrée : envoi déclenché (même message)", await waitToast(pv));
check(
  "Ctrl+Entrée n'ajoute pas de ligne",
  (await field(pv).inputValue()) === "Bonjour Grace !\nComment vas-tu ?\n",
);
await clearToasts(pv);
await field(pv).fill("");
await field(pv).focus();
await pv.keyboard.press("Control+Enter");
await pv.waitForTimeout(800);
check("Ctrl+Entrée sur un champ vide : rien ne se passe", (await infoToast(pv).count()) === 0);
await field(pv).fill("Double clic");
await button(pv).dblclick();
await pv.waitForTimeout(800);
check(
  "Double clic : une seule action",
  (await infoToast(pv).count()) === 1,
  String(await infoToast(pv).count()),
);
await clearToasts(pv);
check(
  "Titre d'aide « Envoyer (Ctrl+Entrée) »",
  (await button(pv).getAttribute("title")) === "Envoyer (Ctrl+Entrée)",
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check(
  "Rechargement : texte toujours là, bouton activé",
  (await field(pv).inputValue()) === "Double clic" && (await button(pv).isEnabled()),
);
let reached = false;
await field(pv).focus();
await pv.keyboard.press("Tab");
reached = await pv.evaluate(
  () => document.activeElement?.getAttribute("aria-label") === "Envoyer le message",
);
check("Touche Tab depuis le champ : focus sur le bouton", reached);
await pv.keyboard.press("Enter");
check("Entrée sur le bouton : envoi déclenché", await waitToast(pv));
await clearToasts(pv);

// C. Accès et sécurité
const pc = await login("c");
await openConv(pc, cA);
check(
  "Conversation non disponible : aucun bouton Envoyer",
  (await pc.getByTestId("conversation-unavailable").isVisible()) &&
    (await button(pc).count()) === 0,
);
const token = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: emails.v, password: PWD }),
    })
  ).json()
).access_token;
const direct = await fetch(`${API}/rest/v1/messages`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ conversation_id: cA, sender_id: id.v, content: "Écrit en direct" }),
});
check(
  "Écriture directe dans la base toujours refusée (enregistrement sécurisé : étape 4.8)",
  direct.status === 401 || direct.status === 403,
  String(direct.status),
);

// D. Petit écran
const small = await login("v", 320);
await openConv(small, cB);
await field(small).fill("Motextrêmementlongsansaucunespace".repeat(20));
const sm = await small.evaluate(() => {
  const b = [
    ...document.querySelectorAll("[data-testid=message-composer] button"),
  ][0].getBoundingClientRect();
  return {
    right: b.right,
    w: innerWidth,
    overflow: document.documentElement.scrollWidth > innerWidth,
  };
});
check(
  "Petit écran (320 px) avec texte très long : bouton visible, sans débordement",
  !sm.overflow && sm.right <= sm.w,
  JSON.stringify(sm),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
check(
  "Aucun message enregistré pendant tout le test",
  writes.length === 0 && countMessages() === "30",
);
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-bmsg-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-bmsg-%'") === "0" &&
    countMessages() === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
