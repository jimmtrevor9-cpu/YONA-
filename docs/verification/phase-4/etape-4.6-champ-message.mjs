// YONA — Phase 4 / Étape 4.6 — Vérification du champ de message d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.6-champ-message.mjs
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
sql("delete from auth.users where email like 'test-cmsg-%@example.test';");
const stamp = Date.now();
const PWD = "TestCmsg!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-cmsg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Cmpaul"),
  a: mk("a", "female", "Cmgrace"),
  b: mk("b", "female", "Cmruth"),
  c: mk("c", "male", "Cmtiers"),
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

// A. Présence et saisie
const pv = await login("v");
await openConv(pv, cA);
check(
  "Champ présent, vide, avec son intitulé « Votre message à Cmgrace »",
  (await field(pv).count()) === 1 && (await field(pv).inputValue()) === "",
);
check(
  "Texte d'aide « Écrivez à Cmgrace… »",
  (await field(pv).getAttribute("placeholder")) === "Écrivez à Cmgrace…",
);
const layout = await pv.evaluate(() => {
  const f = document.querySelector("[data-testid=message-composer]").getBoundingClientRect();
  const nav = document.querySelector("nav").getBoundingClientRect();
  const lis = document.querySelectorAll("ol[aria-label=Messages] > li");
  const last = lis[lis.length - 1].getBoundingClientRect();
  return {
    fTop: f.top,
    fBottom: f.bottom,
    navTop: nav.top,
    lastBottom: last.bottom,
    h: innerHeight,
  };
});
check(
  "Champ visible en bas de l'écran, au-dessus de la barre de navigation",
  layout.fTop > layout.h / 2 && layout.fBottom <= layout.navTop + 0.5,
  JSON.stringify(layout),
);
check(
  "Ouverture : dernier message visible juste au-dessus du champ (non masqué)",
  layout.lastBottom <= layout.fTop + 0.5 && layout.lastBottom > 0,
);
await pv.evaluate(() => window.scrollTo(0, 0));
await pv.waitForTimeout(200);
const topLayout = await pv.evaluate(() => {
  const f = document.querySelector("[data-testid=message-composer]").getBoundingClientRect();
  const nav = document.querySelector("nav").getBoundingClientRect();
  return { fTop: f.top, fBottom: f.bottom, navTop: nav.top };
});
check(
  "En remontant dans l'historique : le champ reste accessible en bas",
  topLayout.fBottom <= topLayout.navTop + 0.5 && topLayout.fTop > 400,
  JSON.stringify(topLayout),
);
await field(pv).click();
const h1 = await field(pv).evaluate((el) => el.offsetHeight);
await pv.keyboard.type("Bonjour Grace !");
await pv.keyboard.press("Enter");
await pv.keyboard.type("Comment vas-tu ?");
check(
  "Saisie au clavier ; Entrée ajoute une ligne",
  (await field(pv).inputValue()) === "Bonjour Grace !\nComment vas-tu ?",
);
await pv.keyboard.press("Enter");
await pv.keyboard.press("Enter");
await pv.keyboard.type("Ligne 4");
const h2 = await field(pv).evaluate((el) => el.offsetHeight);
await field(pv).fill("x\n".repeat(30));
const h3 = await field(pv).evaluate((el) => el.offsetHeight);
check(
  "Le champ s'agrandit avec le texte, puis plafonne (défilement)",
  h2 > h1 && h3 <= 160 && h3 > h2,
  `${h1} → ${h2} → ${h3}`,
);
await pv.waitForTimeout(600);
check(
  "Aucun message envoyé ni enregistré par la saisie (pas d'envoi avant l'étape 4.7)",
  countMessages() === "30" && writes.length === 0,
);

// B. Limite de longueur
await field(pv).fill("a".repeat(3000));
check(
  "Sous 3 500 caractères : pas de compteur",
  (await pv
    .getByTestId("message-composer")
    .getByText(/ \/ 4 000/)
    .count()) === 0,
);
await field(pv).fill("a".repeat(3600));
const counter = pv.getByTestId("message-composer").locator("p");
check(
  "À partir de 3 500 caractères : compteur « 3 600 / 4 000 »",
  (await counter.textContent())?.replace(/\s/g, " ") === "3 600 / 4 000",
  await counter.textContent(),
);
await field(pv).fill("");
await field(pv).focus();
await pv.keyboard.insertText("b".repeat(4200));
check(
  "Collage de 4 200 caractères : limité à 4 000, « limite atteinte » en rouge",
  (await field(pv).inputValue()).length === 4000 &&
    (await counter.textContent())
      ?.replace(/\s/g, " ")
      .includes("4 000 / 4 000 — limite atteinte") &&
    (await counter.getAttribute("class")).includes("text-destructive"),
);
check(
  "Compteur annoncé aux lecteurs d'écran (lié au champ)",
  // Depuis l'étape 5.6, le champ est aussi lié au décompte des messages restants.
  ((await field(pv).getAttribute("aria-describedby")) ?? "")
    .split(" ")
    .includes((await counter.getAttribute("id")) ?? "§"),
);

// C. Brouillon
await field(pv).fill("Brouillon pour Grace\navec deux lignes");
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check(
  "Rechargement : le brouillon est conservé",
  (await field(pv).inputValue()) === "Brouillon pour Grace\navec deux lignes",
);
await openConv(pv, cB);
check(
  "Autre conversation : champ vide (brouillon propre à chaque conversation)",
  (await field(pv).inputValue()) === "" &&
    (await field(pv).getAttribute("placeholder")) === "Écrivez à Cmruth…",
);
await pv.getByRole("link", { name: "Messages" }).first().click();
await pv.waitForURL(/\/messages$/);
await pv.getByRole("link", { name: "Ouvrir la conversation avec Cmgrace" }).click();
await pv.getByTestId("message-composer").waitFor();
await pv.waitForTimeout(500);
check(
  "Navigation dans l'application puis retour : brouillon toujours là",
  (await field(pv).inputValue()) === "Brouillon pour Grace\navec deux lignes",
);
const pv2 = await login("v");
await openConv(pv2, cA);
check(
  "Nouvelle session (autre onglet / appareil) : brouillon non partagé",
  (await field(pv2).inputValue()) === "",
);
await field(pv).fill("");
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cA);
check("Texte effacé : plus de brouillon après rechargement", (await field(pv).inputValue()) === "");
const pa = await login("a");
await openConv(pa, cA);
check(
  "Grace a son propre champ (« Votre message à Cmpaul »), vide",
  (await pa.getByLabel("Votre message à Cmpaul").inputValue()) === "",
);

// D. Accès et sécurité
const pc = await login("c");
await openConv(pc, cA);
check(
  "Conversation non disponible (tiers) : aucun champ de message",
  (await pc.getByTestId("conversation-unavailable").isVisible()) &&
    (await pc.getByTestId("message-composer").count()) === 0,
);
await pv.goto(`${BASE}/messages/abc`, { waitUntil: "networkidle" });
await pv.getByTestId("conversation-unavailable").waitFor({ timeout: 8000 });
check(
  "Adresse mal formée : aucun champ de message",
  (await pv.getByTestId("message-composer").count()) === 0,
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
  "Écriture directe dans la base toujours refusée (l'envoi sécurisé est l'étape 4.8)",
  direct.status === 401 || direct.status === 403,
  String(direct.status),
);

// E. Clavier, petit écran
await openConv(pv, cA);
let reached = false;
for (let i = 0; i < 40 && !reached; i++) {
  await pv.keyboard.press("Tab");
  reached = await pv.evaluate(() => document.activeElement?.id === "message-input");
}
check("Champ atteignable à la touche Tab", reached);
const small = await login("v", 320);
await openConv(small, cA);
await field(small).fill("Motextrêmementlongsansaucunespace".repeat(20));
check(
  "Petit écran (320 px) avec texte très long : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
check(
  "Aucun envoi de message pendant tout le test",
  writes.length === 0 && countMessages() === "30",
);
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-cmsg-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-cmsg-%'") === "0" &&
    countMessages() === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
