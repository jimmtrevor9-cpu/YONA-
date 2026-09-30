// YONA — Phase 1 / Étape 1.15 — Vérification de l'éligibilité à la découverte (serveur + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.15-eligibilite-decouverte.mjs
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
sql("delete from auth.users where email like 'test-elig-%@example.test';");
const stamp = Date.now();
const PWD = "TestElig!2026";
const emails = {};
/** gender = null → inscription sans profil finalisé ; birth = expression SQL. */
const mk = (tag, gender, birth = "date '1991-03-03'") => {
  const e = `test-elig-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Elig${tag}"}',now(),now(),'','','','');` +
      (gender
        ? `update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date=${birth} from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  V: mk("v", "male"), // membre qui découvre : cherche une femme de 25 à 40 ans
  F1: mk("f1", "female"), // 35 ans → proposée
  F2: mk("f2", "female", "date '1981-01-01'"), // 45 ans → hors tranche
  F3: mk("f3", "female", "(current_date - interval '25 years')::date"), // 25 ans aujourd'hui → proposée
  F4: mk("f4", "female", "(current_date - interval '25 years' + interval '1 day')::date"), // 24 ans → non
  F5: mk("f5", "female", "(current_date - interval '41 years')::date"), // 41 ans aujourd'hui → non
  F6: mk("f6", "female", "(current_date - interval '41 years' + interval '1 day')::date"), // 40 ans → oui
  M1: mk("m1", "male"), // homme → hors sexe recherché
  FH: mk("fh", "female"), // profil masqué
  FB: mk("fb", "female"), // a bloqué V
  FS: mk("fs", "female"), // compte suspendu
  N: mk("n", null), // non finalisé
  S: mk("s", "male"), // profil suspendu
  AS: mk("as", "male"), // compte suspendu
  HD: mk("hd", "male"), // a masqué son profil
};
sql(`update public.preferences set preferred_gender='female', min_age=25, max_age=40 where user_id='${id.V}';
     update public.profiles set visibility='hidden' where user_id='${id.FH}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.FB}','${id.V}');
     update public.users set status='suspended' where id in ('${id.FS}','${id.AS}');
     update public.profiles set status='suspended' where user_id='${id.S}';
     update public.profiles set status='hidden' where user_id='${id.HD}';
     update public.christian_profiles set denomination='Évangélique' where user_id='${id.F1}';`);
// Ordre des mises à jour (une transaction chacune) : F3, puis F6, puis F1 (la plus récente).
for (const k of ["F3", "F6", "F1"])
  sql(`update public.profiles set bio='Bio ${k}' where user_id='${id[k]}';`);
const name = Object.fromEntries(Object.entries(id).map(([k, v]) => [v, k]));

async function token(tag) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: emails[tag], password: PWD }),
  });
  return (await r.json()).access_token;
}
const tok = {};
for (const t of ["v", "f1", "n", "s", "as", "hd"]) tok[t] = await token(t);
const headers = (t) => ({
  apikey: KEY,
  ...(t ? { authorization: `Bearer ${tok[t]}` } : {}),
  "content-type": "application/json",
});
async function feed(t, limit) {
  const r = await fetch(`${API}/rest/v1/rpc/discover_profiles`, {
    method: "POST",
    headers: headers(t),
    body: JSON.stringify(limit === undefined ? {} : { _limit: limit }),
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, rows: Array.isArray(json) ? json : [] };
}
const names = (rows) => rows.map((r) => name[r.user_id] ?? "?").join(",");
const get = async (t, path) =>
  (await (await fetch(`${API}/rest/v1/${path}`, { headers: headers(t) })).json()) ?? [];

// Photo validée de F1 (pour vérifier photos et fichiers)
const photoPath = `${id.F1}/elig-${stamp}.png`;
const up = await fetch(`${API}/storage/v1/object/photos/${photoPath}`, {
  method: "POST",
  headers: { ...headers("f1"), "content-type": "image/png" },
  body: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
sql(`insert into public.photos (user_id, storage_path) values ('${id.F1}','${photoPath}');
     update public.photos set status='approved' where storage_path='${photoPath}';`);
check("Préparation : photo de F1 envoyée et validée", up.status === 200, `HTTP ${up.status}`);
/** Ce qu'un membre peut lire de F1 : profil, foi, photo, fichier. */
async function readsF1(t) {
  const p = await get(t, `profiles?select=user_id&user_id=eq.${id.F1}`);
  const c = await get(t, `christian_profiles?select=user_id&user_id=eq.${id.F1}`);
  const ph = await get(t, `photos?select=id&user_id=eq.${id.F1}`);
  const s = await fetch(`${API}/storage/v1/object/sign/photos/${photoPath}`, {
    method: "POST",
    headers: headers(t),
    body: JSON.stringify({ expiresIn: 60 }),
  });
  return [p.length, c.length, ph.length, s.status === 200 ? 1 : 0].join("");
}

// ---------- A. Profils proposés ----------
let f = await feed("v");
check("Découverte de V : réponse du serveur", f.status === 200, `HTTP ${f.status}`);
check(
  "Seuls les profils éligibles et conformes aux préférences sont proposés",
  names(f.rows) === "F1,F6,F3",
  names(f.rows),
);
check("Soi-même exclu", !f.rows.some((r) => r.user_id === id.V));
check("Sexe non recherché exclu (homme)", !f.rows.some((r) => r.user_id === id.M1));
check(
  "Tranche d'âge 25–40 : 45 ans exclu, 24 ans exclu, 41 ans exclu",
  ![id.F2, id.F4, id.F5].some((u) => f.rows.some((r) => r.user_id === u)),
);
check(
  "Bornes incluses : 25 ans (aujourd'hui) et 40 ans (veille des 41 ans) proposés",
  [id.F3, id.F6].every((u) => f.rows.some((r) => r.user_id === u)),
);
check(
  "Exclus : profil masqué, membre qui a bloqué V, compte suspendu",
  ![id.FH, id.FB, id.FS].some((u) => f.rows.some((r) => r.user_id === u)),
);
check("Ordre : profils mis à jour le plus récemment d'abord", names(f.rows) === "F1,F6,F3");
check(
  "Données renvoyées limitées à la carte (pas d'email, de statut…)",
  Object.keys(f.rows[0] ?? {})
    .sort()
    .join(",") === "bio,birth_date,city,country,first_name,gender,interests,user_id",
);

// Préférences modifiées par V → prises en compte
await fetch(`${API}/rest/v1/preferences?user_id=eq.${id.V}`, {
  method: "PATCH",
  headers: headers("v"),
  body: JSON.stringify({ preferred_gender: null, min_age: 18, max_age: 99 }),
});
f = await feed("v");
check(
  "Préférences élargies (tout sexe, 18–99) : homme et 45 ans proposés, exclusions de sécurité maintenues",
  [id.M1, id.F2, id.F4, id.F5].every((u) => f.rows.some((r) => r.user_id === u)) &&
    ![id.FH, id.FB, id.FS, id.N, id.S, id.AS, id.HD, id.V].some((u) =>
      f.rows.some((r) => r.user_id === u),
    ),
  `${f.rows.length} profils`,
);
check("Limite : _limit=1 → 1 profil", (await feed("v", 1)).rows.length === 1);
check("Limite : _limit=1000 → 50 au maximum", (await feed("v", 1000)).rows.length <= 50);

// Nouveau profil éligible → proposé automatiquement
const F7 = mk("f7", "female");
name[F7] = "F7";
f = await feed("v");
check("Nouveau profil éligible : proposé automatiquement, en tête", f.rows[0]?.user_id === F7);

// Aucun profil correspondant → liste vide sans erreur
sql(
  `update public.preferences set preferred_gender='female', min_age=90, max_age=99 where user_id='${id.V}';`,
);
f = await feed("v");
check(
  "Aucun profil correspondant : liste vide, sans erreur",
  f.status === 200 && f.rows.length === 0,
);
sql(
  `update public.preferences set preferred_gender='female', min_age=25, max_age=40 where user_id='${id.V}';`,
);

// ---------- B. Qui peut parcourir ----------
check(
  "Membre éligible : lit le profil, la foi, la photo et le fichier de F1",
  (await readsF1("v")) === "1111",
);
for (const [t, label] of [
  ["n", "Profil non finalisé"],
  ["s", "Profil suspendu"],
  ["as", "Compte suspendu (profil actif)"],
]) {
  const r = await feed(t);
  check(
    `${label} : découverte vide, et aucun accès direct aux profils, à la foi, aux photos, aux fichiers`,
    r.status === 200 && r.rows.length === 0 && (await readsF1(t)) === "0000",
    `${r.rows.length} profils · accès ${await readsF1(t)}`,
  );
}
check(
  "Profil masqué par son propriétaire : peut quand même découvrir",
  (await feed("hd")).rows.length > 0 && (await readsF1("hd")) === "1111",
);
check(
  "Le membre non finalisé lit toujours son propre profil",
  (await get("n", `profiles?select=status&user_id=eq.${id.N}`))[0]?.status === "incomplete",
);
const anon = await feed(null);
check("Visiteur non connecté : découverte refusée", anon.status === 401, `HTTP ${anon.status}`);

// ---------- C. Page /discover ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(discover|onboarding)$/, { timeout: 8000 });
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  return page;
}
const cards = async (page) =>
  (await page.locator("article h3").allTextContents()).map((t) => t.split(" ·")[0].trim());

const pv = await login("v");
let c = await cards(pv);
check(
  "Page : V voit exactement les cartes éligibles",
  c.join(",") === `Eligf7,Eligf1,Eligf6,Eligf3`,
  c.join(","),
);
check(
  "Page : aucun message d'inéligibilité pour V",
  (await pv.getByTestId("discover-ineligible").count()) === 0,
);

sql(`update public.preferences set min_age=90, max_age=99 where user_id='${id.V}';`);
await pv.reload({ waitUntil: "networkidle" });
await pv.waitForTimeout(1000);
check(
  "Page : aucun profil correspondant → message explicatif",
  await pv.getByText("Aucun profil ne correspond à vos préférences pour le moment.").isVisible(),
);
sql(`update public.preferences set min_age=25, max_age=40 where user_id='${id.V}';`);

const pn = await login("n");
check(
  "Page : non finalisé → « Finalisez votre profil… » + Continuer, aucune carte",
  (await pn.getByTestId("discover-ineligible").textContent())?.includes(
    "Finalisez votre profil pour découvrir les autres membres.",
  ) && (await cards(pn)).length === 0,
);
await pn.getByRole("link", { name: "Continuer" }).click();
await pn.waitForURL(/\/onboarding$/, { timeout: 5000 }).catch(() => {});
check("Page : « Continuer » mène à la création du profil", pn.url().endsWith("/onboarding"));

const ps = await login("s");
check(
  "Page : profil suspendu → message « suspendu », aucune carte",
  (await ps.getByTestId("discover-ineligible").textContent())?.includes("suspendu") &&
    (await cards(ps)).length === 0,
);

await pv.setViewportSize({ width: 320, height: 700 });
await pv.reload({ waitUntil: "networkidle" });
await pv.waitForTimeout(800);
check(
  "Affichage sur petit écran (320 px) sans débordement",
  !(await pv.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
await fetch(`${API}/storage/v1/object/photos/${photoPath}`, {
  method: "DELETE",
  headers: { apikey: KEY, authorization: `Bearer ${tok.f1}` },
});
sql("delete from auth.users where email like 'test-elig-%@example.test';");
check(
  "Nettoyage : comptes et fichiers de test supprimés",
  sql("select count(*) from auth.users where email like 'test-elig-%'") === "0" &&
    sql(`select count(*) from storage.objects where name like '${id.F1}/%'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
