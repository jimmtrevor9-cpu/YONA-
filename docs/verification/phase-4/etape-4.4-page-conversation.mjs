// YONA — Phase 4 / Étape 4.4 — Vérification de la page d'une conversation (/messages/<id>).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.4-page-conversation.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
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
sql("delete from auth.users where email like 'test-pconv-%@example.test';");
const stamp = Date.now();
const PWD = "TestPconv!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-pconv-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Pcpaul"),
  a: mk("a", "female", "Pcgrace"),
  b: mk("b", "female", "Pcruth"),
  d: mk("d", "female", "Pcmarie"),
  e: mk("e", "female", "Pcsarah"),
  c: mk("c", "male", "Pctiers"),
};
for (const t of ["a", "b", "d", "e"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (t) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id.v}'::uuid,'${id[t]}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id[t]}'::uuid)`,
  );
const matchOf = (t) => sql(`select match_id from public.conversations where id='${conv(t)}'`);
const cA = conv("a");

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag, width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  return page;
}
const settle = async (page) => {
  await page.getByTestId("conversation-page").waitFor({ timeout: 8000 });
  for (
    let i = 0;
    i < 60 && (await page.locator("[data-testid=conversation-page] .animate-pulse").count()) > 0;
    i++
  )
    await page.waitForTimeout(100);
  await page.waitForTimeout(400);
};
const unavailable = (page) =>
  page
    .getByTestId("conversation-unavailable")
    .isVisible()
    .catch(() => false);

// A. Depuis la liste
const pv = await login("v");
await pv.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1200);
await pv.getByRole("link", { name: "Ouvrir la conversation avec Pcgrace" }).click();
await pv.waitForURL(new RegExp(`/messages/${cA}$`), { timeout: 5000 }).catch(() => {});
await settle(pv);
check(
  "Clic sur Grace dans « Messages » → /messages/<identifiant de la conversation>",
  pv.url().endsWith(`/messages/${cA}`),
  pv.url(),
);
check(
  "En-tête et bandeau : prénom de la personne",
  (await pv.locator("header h1").textContent())?.trim() === "Pcgrace" &&
    ((await pv.getByTestId("conversation-page").textContent()) ?? "").includes("Pcgrace"),
);
check(
  "Zone de conversation présente (« Début de votre conversation avec … »)",
  await pv
    .getByTestId("conversation-thread")
    .getByText("Début de votre conversation avec Pcgrace.")
    .isVisible(),
);
check(
  "Onglet « Messages » signalé comme page courante",
  (await pv
    .getByRole("link", { name: "Messages", exact: true })
    .last()
    .getAttribute("aria-current")) === "page" ||
    (await pv.locator("nav a[aria-current=page]").textContent())?.trim() === "Messages",
);

// B. Navigation
await pv.getByRole("link", { name: "Voir son profil" }).click();
await pv.waitForURL(new RegExp(`/matches/${matchOf("a")}$`), { timeout: 5000 }).catch(() => {});
check(
  "« Voir son profil » → profil du Match (/matches/<id>)",
  pv.url().endsWith(`/matches/${matchOf("a")}`),
  pv.url(),
);
await pv.goBack({ waitUntil: "networkidle" });
await settle(pv);
check("Retour du navigateur : revient à la conversation", pv.url().endsWith(`/messages/${cA}`));
await pv.reload({ waitUntil: "networkidle" });
await settle(pv);
check(
  "Rechargement : conversation toujours affichée",
  (await pv.getByTestId("conversation-thread").count()) === 1,
);
await pv.getByRole("link", { name: "Messages" }).first().click();
await pv.waitForURL(/\/messages$/, { timeout: 5000 });
check("Lien « Messages » : retour à la liste", pv.url().endsWith("/messages"));

// C. Accès refusés
const pa = await login("a");
await pa.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await settle(pa);
check(
  "Grace ouvre la même conversation : elle voit Paul",
  ((await pa.getByTestId("conversation-page").textContent()) ?? "").includes("Pcpaul"),
);
const pc = await login("c");
await pc.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await settle(pc);
check(
  "Un tiers qui connaît l'adresse : « Cette conversation n'est pas disponible. »",
  await unavailable(pc),
);
for (const [label, path] of [
  ["Identifiant inexistant", "/messages/00000000-0000-4000-8000-000000000000"],
  ["Adresse mal formée", "/messages/abc"],
]) {
  await pv.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await settle(pv);
  check(
    `${label} : non disponible + « Retour à mes messages »`,
    (await unavailable(pv)) &&
      (await pv.getByRole("link", { name: "Retour à mes messages" }).count()) === 1,
  );
}
sql(`update public.conversations set status='closed' where id='${conv("b")}';
     update public.matches set status='unmatched' where id='${matchOf("d")}';
     update public.profiles set visibility='hidden' where user_id='${id.e}';`);
for (const [label, t] of [
  ["Conversation fermée", "b"],
  ["Match défait", "d"],
  ["Profil de l'autre masqué", "e"],
]) {
  await pv.goto(`${BASE}/messages/${conv(t)}`, { waitUntil: "networkidle" });
  await settle(pv);
  check(`${label} : non disponible`, await unavailable(pv));
}
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.a}','${id.v}');`);
await pv.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await settle(pv);
check("Grace a bloqué Paul : non disponible", await unavailable(pv));
sql(`delete from public.blocks where blocker_id='${id.a}';`);

// D. Sans connexion, petit écran
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await anon.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check("Sans connexion : renvoi vers /login", anon.url().endsWith("/login"));
const small = await login("v", 320);
await small.goto(`${BASE}/messages/${cA}`, { waitUntil: "networkidle" });
await settle(small);
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-pconv-%@example.test';");
check(
  "Nettoyage : comptes et conversations de test supprimés",
  sql("select count(*) from auth.users where email like 'test-pconv-%'") === "0" &&
    sql(`select count(*) from public.conversations where id='${cA}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
