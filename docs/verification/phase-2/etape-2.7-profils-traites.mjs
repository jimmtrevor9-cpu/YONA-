// YONA — Phase 2 / Étape 2.7 — Vérification : les profils déjà aimés ou passés ne sont plus proposés.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.7-profils-traites.mjs
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
sql("delete from auth.users where email like 'test-traite-%@example.test';");
const stamp = Date.now();
const PWD = "TestTraite!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-traite-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Traite${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = { v: mk("v", "male"), w: mk("w", "male") };
for (const t of ["a", "b", "c", "d", "e"]) id[t] = mk(t, "female");
// V et W ne cherchent que des femmes (les deux hommes ne se voient pas entre eux)
sql(
  `update public.preferences set preferred_gender='female' where user_id in ('${id.v}','${id.w}');`,
);
const tag = Object.fromEntries(Object.entries(id).map(([k, v]) => [v, k]));

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
const tok = { v: await token("v"), w: await token("w") };
const feed = async (t, limit) => {
  const r = await fetch(`${API}/rest/v1/rpc/discover_profiles`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${tok[t]}`, "content-type": "application/json" },
    body: JSON.stringify(limit ? { _limit: limit } : {}),
  });
  const rows = await r.json();
  return rows
    .map((x) => tag[x.user_id] ?? "?")
    .sort()
    .join(",");
};

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(t) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[t]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  return page;
}
const cards = async (p) =>
  (await p.locator("article h3").allTextContents())
    .map((t) => t.split(" ·")[0].trim().replace("Traite", ""))
    .sort()
    .join(",");
const reload = async (p) => {
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1200);
};
const row = (s, r) =>
  sql(
    `select kind||'/'||status from public.likes where sender_id='${id[s]}' and receiver_id='${id[r]}'`,
  );

const page = await login("v");
check(
  "Au départ : A, B, C, D, E proposées",
  (await cards(page)) === "a,b,c,d,e",
  await cards(page),
);

// A. Like et Pass par la page
await page
  .locator("article")
  .filter({ hasText: "Traitea " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
for (let i = 0; i < 50 && row("v", "a") !== "like/active"; i++) await page.waitForTimeout(100);
check(
  "Juste après le Like : la carte de A reste affichée en « Aimé »",
  (await cards(page)).includes("a"),
);
await page
  .locator("article")
  .filter({ hasText: "Traiteb " })
  .getByRole("button", { name: /^Passer le profil/ })
  .click();
for (let i = 0; i < 50 && row("v", "b") !== "pass/active"; i++) await page.waitForTimeout(100);
await reload(page);
check(
  "Après rechargement : A (aimée) et B (passée) ne sont plus proposées",
  (await cards(page)) === "c,d,e",
  await cards(page),
);
check(
  "Serveur : A et B exclues de la découverte de V",
  (await feed("v")) === "c,d,e",
  await feed("v"),
);

// B. Persistance (nouvelle session)
const again = await login("v");
check(
  "Nouvelle session : A et B toujours absentes",
  (await cards(again)) === "c,d,e",
  await cards(again),
);

// C. Ce qui ne doit PAS exclure
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.c}','${id.v}');
     insert into public.likes (sender_id, receiver_id, kind) values ('${id.d}','${id.v}','pass');`);
check(
  "Likes / Pass reçus par V (C l'aime, D l'a passé) : C et D restent proposées",
  (await feed("v")) === "c,d,e",
);
check(
  "Un autre membre (W) voit toujours A et B",
  (await feed("w")) === "a,b,c,d,e",
  await feed("w"),
);
await again.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await again.waitForTimeout(1200);
check(
  "Page Recherche (recherche explicite) : A et B toujours trouvables",
  /a.*b/.test(await cards(again)),
  await cards(again),
);

// D. Retour d'un profil
sql(
  `update public.likes set status='withdrawn' where sender_id='${id.v}' and receiver_id='${id.a}';`,
);
check("Like retiré : A de nouveau proposée", (await feed("v")) === "a,c,d,e", await feed("v"));
sql(`update public.profiles set visibility='hidden' where user_id='${id.b}';
     update public.profiles set visibility='visible' where user_id='${id.b}';`);
check(
  "B masquée puis réaffichée : toujours exclue (le Pass reste valable)",
  !(await feed("v")).includes("b"),
);

// E. Limite appliquée après l'exclusion ; nouveau profil ; tout traité
check(
  "Limite 1 : le 1er profil non traité est renvoyé (pas une liste vide)",
  (await feed("v", 1)).length === 1 && (await feed("v", 1)) !== "b",
);
const f = mk("f", "female");
tag[f] = "f";
check("Nouveau profil F : proposé automatiquement", (await feed("v")).includes("f"));
sql(
  `insert into public.likes (sender_id, receiver_id, kind) select '${id.v}', unnest(array['${id.a}','${id.c}','${id.d}','${id.e}','${f}']::uuid[]), 'pass' on conflict (sender_id, receiver_id) do update set kind='pass', status='active';`,
);
check("Tous les profils traités : découverte vide, sans erreur", (await feed("v")) === "");
await reload(page);
check(
  "Page : message « Aucun profil ne correspond… » quand tout est traité",
  (await page.locator("article").count()) === 0 &&
    (await page
      .getByText("Aucun profil ne correspond à vos préférences pour le moment.")
      .isVisible()),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-traite-%@example.test';");
check(
  "Nettoyage : comptes, Likes et Pass de test supprimés",
  sql("select count(*) from auth.users where email like 'test-traite-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
