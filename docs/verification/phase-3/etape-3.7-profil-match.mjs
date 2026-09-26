// YONA — Phase 3 / Étape 3.7 — Vérification : ouvrir le profil depuis un Match (/matches/<id>).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.7-profil-match.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
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
sql("delete from auth.users where email like 'test-pmatch-%@example.test';");
const stamp = Date.now();
const PWD = "TestPmatch!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-pmatch-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04', city='Douala', country='Cameroun' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Pmpaul"),
  a: mk("a", "female", "Pmgrace"),
  b: mk("b", "female", "Pmruth"),
  c: mk("c", "male", "Pmtiers"),
};
sql(`update public.profiles set city='Yaoundé', profession='Infirmière', bio='Chrétienne engagée, j''aime la louange.' where user_id='${id.a}';
     update public.christian_profiles set denomination='Évangélique', church_attendance='Chaque semaine', faith_importance='Essentielle', faith_commitment='Servante à l''église', prayer_practice='Chaque jour', marriage_vision='Une alliance pour la vie', christian_values=array['Fidélité','Pardon'] where user_id='${id.a}';
     update public.preferences set relationship_goal='SECRET-objectif', family_project='SECRET-projet' where user_id='${id.a}';`);
const pair = (x, y) =>
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id[x]}','${id[y]}'), ('${id[y]}','${id[x]}');`,
  );
pair("v", "a");
pair("v", "b");
const matchId = (x, y) =>
  sql(
    `select id from public.matches where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const mVA = matchId("v", "a");
const mVB = matchId("v", "b");

// Photos de A : 2 validées (principale + seconde) et 1 en attente
const tokA = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: emails.a, password: PWD }),
    })
  ).json()
).access_token;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const files = [];
for (const n of ["p1", "p2", "p3"]) {
  const path = `${id.a}/${n}-${stamp}.png`;
  files.push(path);
  await fetch(`${API}/storage/v1/object/photos/${path}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${tokA}`, "content-type": "image/png" },
    body: png,
  });
  sql(`insert into public.photos (user_id, storage_path) values ('${id.a}','${path}');`);
}
sql(
  `update public.photos set status='approved' where storage_path in ('${files[0]}','${files[1]}');`,
);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
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
  await page.getByTestId("match-profile").waitFor({ timeout: 8000 });
  for (
    let i = 0;
    i < 60 && (await page.locator("[data-testid=match-profile] .animate-pulse").count()) > 0;
    i++
  )
    await page.waitForTimeout(100);
  await page.waitForTimeout(400);
};
const unavailable = (page) =>
  page
    .getByTestId("match-profile-unavailable")
    .isVisible()
    .catch(() => false);

// A. Depuis la liste
const pv = await login("v");
const requests = [];
pv.on("request", (r) => requests.push(r.url()));
await pv.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1200);
await pv.getByRole("link", { name: "Voir le profil de Pmgrace" }).click();
await pv.waitForURL(new RegExp(`/matches/${mVA}$`), { timeout: 5000 }).catch(() => {});
await settle(pv);
check(
  "Clic sur Grace dans « Mes Matchs » → /matches/<identifiant du Match>",
  pv.url().endsWith(`/matches/${mVA}`),
  pv.url(),
);
const text = (await pv.getByTestId("match-profile").textContent()) ?? "";
check(
  "En-tête et titre : prénom, âge",
  (await pv.locator("header h1").textContent())?.trim() === "Pmgrace" &&
    /Pmgrace · \d+ ans/.test(text),
);
check(
  "Ville, pays, profession, date du Match",
  text.includes("Yaoundé, Cameroun") &&
    text.includes("Infirmière") &&
    /Match le \d{1,2} [a-zéû]+ \d{4}/.test(text),
);
check("Présentation affichée", text.includes("Chrétienne engagée, j'aime la louange."));
check(
  "Foi : dénomination, culte, place de la foi, pratique, prière, mariage, valeurs",
  [
    "Évangélique",
    "Chaque semaine",
    "Essentielle",
    "Servante à l'église",
    "Chaque jour",
    "Une alliance pour la vie",
    "Fidélité",
    "Pardon",
  ].every((s) => text.includes(s)),
);
check(
  "Préférences privées jamais affichées ni demandées",
  !text.includes("SECRET") && !requests.some((u) => u.includes("/rest/v1/preferences")),
);
check(
  "Seules les colonnes utiles sont demandées (pas de « select=* »)",
  requests.some((u) => u.includes("/rest/v1/profiles?select=first_name")) &&
    !requests.some((u) => /\/rest\/v1\/profiles\?select=\*/.test(u)),
);
const mainImg = pv.locator("section[aria-label=Photos] > div img");
const thumbs = pv.getByRole("button", { name: /^Afficher la photo/ });
check("Photos : 2 validées (la photo en attente n'apparaît pas)", (await thumbs.count()) === 2);
const firstSrc = await mainImg.getAttribute("src");
check("Photo principale affichée en premier", (firstSrc ?? "").includes(files[0].split("/")[1]));
await thumbs.nth(1).click();
check(
  "Clic sur la 2e vignette : la grande photo change",
  ((await mainImg.getAttribute("src")) ?? "").includes(files[1].split("/")[1]) &&
    (await thumbs.nth(1).getAttribute("aria-pressed")) === "true",
);

// B. Navigation
await pv.getByRole("link", { name: "Mes Matchs" }).first().click();
await pv.waitForURL(/\/matches$/, { timeout: 5000 });
check("Lien « Mes Matchs » : retour à la liste", pv.url().endsWith("/matches"));
await pv.goBack({ waitUntil: "networkidle" });
await settle(pv);
check(
  "Bouton Retour du navigateur puis rechargement : profil toujours affiché",
  pv.url().endsWith(`/matches/${mVA}`) &&
    ((await pv.getByTestId("match-profile").textContent()) ?? "").includes("Infirmière"),
);
await pv.goto(`${BASE}/matches/${mVB}`, { waitUntil: "networkidle" });
await settle(pv);
check(
  "Profil minimal (Ruth : sans photo, ni présentation, ni foi) : sans section vide",
  ((await pv.getByTestId("match-profile").textContent()) ?? "").includes("Pmruth") &&
    (await pv.locator("section[aria-label=Photos]").count()) === 0 &&
    !((await pv.getByTestId("match-profile").textContent()) ?? "").includes("Présentation"),
);

// C. Accès refusés
const pa = await login("a");
await pa.goto(`${BASE}/matches/${mVA}`, { waitUntil: "networkidle" });
await settle(pa);
check(
  "Grace ouvre le même Match : elle voit le profil de Paul",
  ((await pa.getByTestId("match-profile").textContent()) ?? "").includes("Pmpaul"),
);
const pc = await login("c");
await pc.goto(`${BASE}/matches/${mVA}`, { waitUntil: "networkidle" });
await settle(pc);
check(
  "Un tiers qui connaît l'adresse du Match : « Ce profil n'est pas disponible. »",
  await unavailable(pc),
);
for (const [label, path] of [
  ["Identifiant inexistant", "/matches/00000000-0000-4000-8000-000000000000"],
  ["Adresse mal formée", "/matches/abc"],
]) {
  await pv.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await settle(pv);
  check(
    `${label} : « Ce profil n'est pas disponible. » + retour aux Matchs`,
    (await unavailable(pv)) &&
      (await pv.getByRole("link", { name: "Retour à mes Matchs" }).count()) === 1,
  );
}
sql(`update public.profiles set visibility='hidden' where user_id='${id.b}';`);
await pv.goto(`${BASE}/matches/${mVB}`, { waitUntil: "networkidle" });
await settle(pv);
check("Ruth a masqué son profil : non disponible", await unavailable(pv));
sql(`update public.profiles set visibility='visible' where user_id='${id.b}';
     update public.matches set status='unmatched' where id='${mVB}';`);
await pv.goto(`${BASE}/matches/${mVB}`, { waitUntil: "networkidle" });
await settle(pv);
check("Match défait : non disponible", await unavailable(pv));
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.a}','${id.v}');`);
await pv.goto(`${BASE}/matches/${mVA}`, { waitUntil: "networkidle" });
await settle(pv);
check("Grace a bloqué Paul : non disponible", await unavailable(pv));
sql(`delete from public.blocks where blocker_id='${id.a}';`);

// D. Accès direct sans connexion, petit écran
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/matches/${mVA}`, { waitUntil: "networkidle" });
await anon.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
check("Sans connexion : renvoi vers /login", anon.url().endsWith("/login"));
const small = await login("v", 320);
await small.goto(`${BASE}/matches/${mVA}`, { waitUntil: "networkidle" });
await settle(small);
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
for (const path of files)
  await fetch(`${API}/storage/v1/object/photos/${path}`, {
    method: "DELETE",
    headers: { apikey: KEY, authorization: `Bearer ${tokA}` },
  });
sql("delete from auth.users where email like 'test-pmatch-%@example.test';");
check(
  "Nettoyage : comptes, Matchs et photos de test supprimés",
  sql("select count(*) from auth.users where email like 'test-pmatch-%'") === "0" &&
    sql(`select count(*) from storage.objects where name like '${id.a}/%'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
