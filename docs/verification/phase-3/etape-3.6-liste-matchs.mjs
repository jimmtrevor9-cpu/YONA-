// YONA — Phase 3 / Étape 3.6 — Vérification de l'affichage des Matchs (page /matches).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.6-liste-matchs.mjs
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
sql("delete from auth.users where email like 'test-lmatch-%@example.test';");
const stamp = Date.now();
const PWD = "TestLmatch!2026";
const emails = {};
const mk = (tag, gender, name, city = "Douala", birth = "1992-04-04") => {
  const e = `test-lmatch-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='${birth}', city='${city}', country='Cameroun' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Lmpaul"),
  c: mk("c", "male", "Lmtiers"),
  a: mk("a", "female", "Lmgrace", "Yaoundé", "1990-01-01"),
  b: mk("b", "female", "Lmruth"),
  d: mk("d", "female", "Lmmarie"),
  e: mk("e", "female", "Lmsarah"),
  f: mk("f", "female", "Lmanne"),
  g: mk("g", "female", "Lmleah"),
  h: mk("h", "female", "Lmeve"),
  n: mk("n", "female", "Lmnouvelle"),
  l: mk("l", "female", "Lmmaximilienne-Bérénice-Antoinette"),
};
const matchPair = (x, y) =>
  sql(`insert into public.likes (sender_id, receiver_id) values ('${id[x]}','${id[y]}');
       insert into public.likes (sender_id, receiver_id) values ('${id[y]}','${id[x]}');`);

// Photos : A a une photo principale validée ; B une photo en attente
const token = async (t) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: emails[t], password: PWD }),
      })
    ).json()
  ).access_token;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const paths = {};
for (const t of ["a", "b"]) {
  const tk = await token(t);
  paths[t] = `${id[t]}/lm-${stamp}.png`;
  await fetch(`${API}/storage/v1/object/photos/${paths[t]}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${tk}`, "content-type": "image/png" },
    body: png,
  });
  sql(`insert into public.photos (user_id, storage_path) values ('${id[t]}','${paths[t]}');`);
  paths[`${t}tok`] = tk;
}
sql(`update public.photos set status='approved' where storage_path='${paths.a}';`);

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
const openMatches = async (page) => {
  await page.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
  await page.getByTestId("matches-page").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
};
const names = async (page) =>
  (await page.locator("[aria-label='Liste de vos Matchs'] h2").allTextContents()).map((t) =>
    t.split(" ·")[0].trim(),
  );

// A. Aucun Match
const pv = await login("v");
await openMatches(pv);
check(
  "Sans Match : message explicatif et bouton « Découvrir des profils »",
  (await pv.getByText("Vous n'avez pas encore de Match.").isVisible()) &&
    (await pv.getByRole("link", { name: "Découvrir des profils" }).getAttribute("href")) ===
      "/discover",
);

// B. Matchs affichés, du plus récent au plus ancien
for (const t of ["a", "b", "d", "e", "f", "g", "h"]) matchPair("v", t);
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.c}');`); // sens unique
await openMatches(pv);
let list = await names(pv);
check(
  "7 Matchs affichés, du plus récent au plus ancien",
  list.join(",") === "Lmeve,Lmleah,Lmanne,Lmsarah,Lmmarie,Lmruth,Lmgrace",
  list.join(","),
);
const grace = pv.locator("li").filter({ hasText: "Lmgrace" });
check(
  "Carte : prénom, âge, ville et pays",
  (await grace.textContent())?.includes("Lmgrace · ") &&
    (await grace.textContent())?.includes("Yaoundé, Cameroun"),
);
check(
  "Carte : date du Match en français",
  /Match le \d{1,2} [a-zéû]+ \d{4}/.test((await grace.textContent()) ?? ""),
);
const img = grace.locator("img");
check(
  "Photo principale validée affichée (lien temporaire du stockage privé)",
  (await img.count()) === 1 &&
    ((await img.getAttribute("src")) ?? "").includes("/storage/v1/object/sign/photos/"),
);
const ruth = pv.locator("li").filter({ hasText: "Lmruth" });
check(
  "Photo encore en attente : non affichée, initiale à la place",
  (await ruth.locator("img").count()) === 0 && (await ruth.textContent())?.trim().startsWith("L"),
);

// C. Ce qui n'apparaît pas
check("Like à sens unique : pas dans la liste", !list.includes("Lmtiers"));
sql(`update public.matches set status='unmatched' where '${id.d}' in (user_1_id,user_2_id);
     update public.matches set status='blocked' where '${id.e}' in (user_1_id,user_2_id);
     update public.profiles set visibility='hidden' where user_id='${id.f}';
     update public.users set status='suspended' where id='${id.g}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.h}','${id.v}');`);
await openMatches(pv);
list = await names(pv);
check(
  "Match défait, Match bloqué, profil masqué, compte suspendu, blocage : non affichés",
  list.join(",") === "Lmruth,Lmgrace",
  list.join(","),
);

// D. L'autre côté et les tiers
const pa = await login("a");
await openMatches(pa);
check("Grace voit Paul dans ses Matchs", (await names(pa)).join(",") === "Lmpaul");
const pc = await login("c");
await openMatches(pc);
check(
  "Un tiers (aimé sans retour) n'a aucun Match",
  (await names(pc)).length === 0 &&
    (await pc.getByText("Vous n'avez pas encore de Match.").isVisible()),
);

// E. Nouveau Match depuis Découvrir → visible tout de suite dans l'onglet Matchs
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.n}','${id.v}');`);
await pv.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1200);
await pv
  .locator("article")
  .filter({ hasText: "Lmnouvelle " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
await pv.getByTestId("match-dialog").waitFor({ timeout: 5000 });
await pv.getByRole("button", { name: "Continuer à découvrir" }).click();
await pv.getByRole("link", { name: "Matchs" }).click();
await pv.waitForURL(/\/matches$/);
await pv.waitForTimeout(1500);
check(
  "Nouveau Match fait dans Découvrir : en tête de la liste, sans recharger",
  (await names(pv))[0] === "Lmnouvelle",
  (await names(pv)).join(","),
);

// F. Persistance, suppression, erreur, petit écran
matchPair("v", "l");
const small = await login("v", 320);
await openMatches(small);
check("Nouvelle session : les Matchs sont toujours là", (await names(small)).length === 4);
check(
  "Petit écran (320 px) : prénom très long raccourci, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
// (le fichier photo de Ruth est retiré d'abord : la suppression de compte n'efface pas
// encore les fichiers — point traité avec la suppression de compte, Phase 20)
await fetch(`${API}/storage/v1/object/photos/${paths.b}`, {
  method: "DELETE",
  headers: { apikey: KEY, authorization: `Bearer ${paths.btok}` },
});
sql(`delete from auth.users where id='${id.b}';`);
await openMatches(small);
check(
  "Compte de Ruth supprimé : elle disparaît de la liste",
  !(await names(small)).includes("Lmruth"),
);
await small.route("**/rest/v1/matches*", (r) => r.abort());
await small.reload({ waitUntil: "networkidle" });
// Deux niveaux de nouvelles tentatives automatiques (client base + page) : ~35 s avant l'erreur.
for (
  let i = 0;
  i < 600 &&
  !(await small
    .getByText("Vos Matchs n'ont pas pu être chargés.")
    .isVisible()
    .catch(() => false));
  i++
)
  await small.waitForTimeout(100);
check(
  "Panne réseau : message « Vos Matchs n'ont pas pu être chargés… »",
  await small
    .getByText("Vos Matchs n'ont pas pu être chargés.")
    .isVisible()
    .catch(() => false),
);
await small.unroute("**/rest/v1/matches*");
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
await fetch(`${API}/storage/v1/object/photos/${paths.a}`, {
  method: "DELETE",
  headers: { apikey: KEY, authorization: `Bearer ${paths.atok}` },
});
sql("delete from auth.users where email like 'test-lmatch-%@example.test';");
check(
  "Nettoyage : comptes, Likes, Matchs et photos de test supprimés",
  sql("select count(*) from auth.users where email like 'test-lmatch-%'") === "0" &&
    sql(`select count(*) from storage.objects where name like '${id.a}/%'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
