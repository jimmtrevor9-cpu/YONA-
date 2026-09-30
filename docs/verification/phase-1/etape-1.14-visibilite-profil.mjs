// YONA — Phase 1 / Étape 1.14 — Vérification de la visibilité du profil (serveur + pages).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.14-visibilite-profil.mjs
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
sql("delete from auth.users where email like 'test-visib-%@example.test';");
const stamp = Date.now();
const PWD = "TestVisib!2026";
const mk = (tag, complete) => {
  const e = `test-visib-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Visib${tag}"}',now(),now(),'','','','');` +
      (complete
        ? `update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${complete}', birth_date='1991-03-03', city='Yaoundé' from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return e;
};
const V = mk("viewer", "male"); // membre qui regarde
const T = mk("target", "female"); // profil observé
const I = mk("incomplet", null); // inscription sans onboarding
const uid = (e) => sql(`select id from auth.users where email='${e}'`);
const [vId, tId, iId] = [uid(V), uid(T), uid(I)];
const profile = (id) =>
  sql(`select status||'|'||visibility from public.profiles where user_id='${id}'`);

async function token(email) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password: PWD }),
  });
  return (await r.json()).access_token;
}
const tok = { V: await token(V), T: await token(T), I: await token(I) };
async function rest(who, method, path, body) {
  const r = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      authorization: `Bearer ${tok[who]}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* réponse vide */
  }
  return { status: r.status, rows: Array.isArray(json) ? json : [], message: json?.message ?? "" };
}
const patchProfile = (who, id, body) => rest(who, "PATCH", `profiles?user_id=eq.${id}`, body);

// Profil chrétien, photo validée et fichier de T
sql(`update public.christian_profiles set denomination='Évangélique' where user_id='${tId}';`);
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const photoPath = `${tId}/visib-${stamp}.png`;
const up = await fetch(`${API}/storage/v1/object/photos/${photoPath}`, {
  method: "POST",
  headers: { apikey: KEY, authorization: `Bearer ${tok.T}`, "content-type": "image/png" },
  body: png,
});
sql(
  `insert into public.photos (user_id, storage_path) values ('${tId}','${photoPath}');
   update public.photos set status='approved' where storage_path='${photoPath}';`,
);
check("Préparation : fichier photo de T envoyé et validé", up.status === 200, `HTTP ${up.status}`);

/** Ce que V voit de T : profil, profil chrétien, photo, fichier. */
async function seen(id = tId) {
  const p = await rest("V", "GET", `profiles?select=user_id&user_id=eq.${id}`);
  const c = await rest("V", "GET", `christian_profiles?select=user_id&user_id=eq.${id}`);
  const ph = await rest("V", "GET", `photos?select=id&user_id=eq.${id}`);
  const s = await fetch(`${API}/storage/v1/object/sign/photos/${photoPath}`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${tok.V}`, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  return [p.rows.length, c.rows.length, ph.rows.length, s.status === 200 ? 1 : 0].join("");
}

// ---------- A. Serveur : qui voit quoi ----------
check(
  "Profil actif et visible : V voit le profil, la foi, la photo et le fichier de T",
  (await seen()) === "1111",
  await seen(),
);
check(
  "Profil non finalisé : invisible pour V",
  (await rest("V", "GET", `profiles?select=user_id&user_id=eq.${iId}`)).rows.length === 0,
);
check(
  "Le membre voit toujours son propre profil, même non finalisé",
  (await rest("I", "GET", `profiles?select=status&user_id=eq.${iId}`)).rows[0]?.status ===
    "incomplete",
);

// ---------- B. Serveur : un profil incomplet ne peut pas se rendre visible ----------
let r = await patchProfile("I", iId, { status: "active" });
check(
  "Passer « actif » sans sexe ni date de naissance : refusé",
  r.status === 400 && r.message === "profile_incomplete" && profile(iId) === "incomplete|visible",
  `HTTP ${r.status} ${r.message}`,
);
r = await patchProfile("I", iId, { status: "active", gender: "female" });
check(
  "Passer « actif » sans date de naissance : refusé",
  r.status === 400 && profile(iId) === "incomplete|visible",
  `HTTP ${r.status}`,
);
r = await patchProfile("I", iId, {
  status: "active",
  first_name: "  ",
  gender: "female",
  birth_date: "1993-04-04",
});
check(
  "Passer « actif » avec un prénom vide : refusé",
  r.status === 400 && profile(iId) === "incomplete|visible",
  `HTTP ${r.status}`,
);
r = await patchProfile("I", iId, { status: "suspended" });
check(
  "Se mettre soi-même « suspendu » : refusé (403)",
  r.status === 403 &&
    r.message === "profile_status_forbidden" &&
    profile(iId) === "incomplete|visible",
  `HTTP ${r.status}`,
);
r = await patchProfile("I", iId, {
  status: "active",
  gender: "female",
  birth_date: "1993-04-04",
  onboarding_completed_at: new Date().toISOString(),
});
check(
  "Profil complet (prénom, sexe, date) : passage « actif » accepté",
  r.status === 200 && profile(iId) === "active|visible",
  `HTTP ${r.status}`,
);
check(
  "… et V le voit désormais",
  (await rest("V", "GET", `profiles?select=user_id&user_id=eq.${iId}`)).rows.length === 1,
);
r = await patchProfile("T", tId, { gender: null });
check(
  "Profil actif : effacer son sexe est refusé",
  r.status === 400 && sql(`select gender from public.profiles where user_id='${tId}'`) === "female",
  `HTTP ${r.status}`,
);
r = await patchProfile("T", tId, { birth_date: null });
check(
  "Profil actif : effacer sa date de naissance est refusé",
  r.status === 400,
  `HTTP ${r.status}`,
);

// ---------- C. Serveur : masquage, suspension, compte, blocage ----------
r = await patchProfile("T", tId, { visibility: "hidden" });
check(
  "T masque son profil (visibilité « masqué ») : enregistré",
  r.status === 200 && profile(tId) === "active|hidden",
);
check(
  "… V ne voit plus ni le profil, ni la foi, ni la photo, ni le fichier",
  (await seen()) === "0000",
  await seen(),
);
r = await patchProfile("T", tId, { visibility: "visible" });
check("T le rend de nouveau visible : V le revoit", r.status === 200 && (await seen()) === "1111");
await patchProfile("T", tId, { status: "hidden" });
check("Statut « masqué » : invisible pour V", (await seen()) === "0000");
await patchProfile("T", tId, { status: "active" });
check("Retour au statut « actif » : visible", (await seen()) === "1111");

sql(`update public.profiles set status='suspended' where user_id='${tId}';`);
check("Profil suspendu par la modération : invisible pour V", (await seen()) === "0000");
r = await patchProfile("T", tId, { status: "active" });
check(
  "T ne peut pas lever sa suspension lui-même",
  profile(tId) === "suspended|visible",
  `HTTP ${r.status}`,
);
sql(`update public.profiles set status='active' where user_id='${tId}';`);

sql(`update public.users set status='suspended' where id='${tId}';`);
check("Compte suspendu (profil pourtant actif) : invisible pour V", (await seen()) === "0000");
sql(`update public.users set status='active' where id='${tId}';`);

sql(`insert into public.blocks (blocker_id, blocked_id) values ('${tId}','${vId}');`);
check("T a bloqué V : V ne voit plus T", (await seen()) === "0000");
check(
  "… et T ne voit plus V",
  (await rest("T", "GET", `profiles?select=user_id&user_id=eq.${vId}`)).rows.length === 0,
);
sql(`delete from public.blocks where blocker_id='${tId}';`);
check("Blocage retiré : V revoit T", (await seen()) === "1111");

// ---------- D. Pages ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(email) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/(discover|onboarding)$/, { timeout: 8000 });
  return page;
}
const banner = async (page) => {
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.getByTestId("profile-visibility").waitFor({ timeout: 5000 });
  return (await page.getByTestId("profile-visibility").textContent())?.trim() ?? "";
};
const discoverHas = async (page, name) => {
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return page.locator("article h3", { hasText: name }).count();
};

const pv = await login(V);
check("Découverte : V voit la carte de T", (await discoverHas(pv, "Visibtarget")) > 0);
const pt = await login(T);
check(
  "Profil de T : « Votre profil est visible par les autres membres. »",
  (await banner(pt)) === "Votre profil est visible par les autres membres.",
);

await patchProfile("T", tId, { visibility: "hidden" });
check(
  "T masqué : la carte disparaît de la découverte de V",
  (await discoverHas(pv, "Visibtarget")) === 0,
);
check("Profil de T : message « masqué »", (await banner(pt)).startsWith("Votre profil est masqué"));
sql(`update public.profiles set status='suspended', visibility='visible' where user_id='${tId}';`);
check(
  "Profil de T suspendu : message « suspendu »",
  (await banner(pt)).startsWith("Votre profil est suspendu"),
);
sql(`update public.profiles set status='active' where user_id='${tId}';`);
check("T de nouveau visible : la carte revient pour V", (await discoverHas(pv, "Visibtarget")) > 0);

sql(
  `update public.profiles set status='incomplete', onboarding_completed_at=null where user_id='${iId}';`,
);
const pi = await login(I);
const bi = await banner(pi);
check(
  "Profil non finalisé : « … pas encore visible » + bouton Continuer",
  bi.includes("n'est pas encore visible") && bi.includes("Continuer"),
);
check(
  "Profil non finalisé : absent de la découverte de V",
  (await discoverHas(pv, "Visibincomplet")) === 0,
);

await pt.setViewportSize({ width: 320, height: 700 });
await banner(pt);
const overflow = await pt.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("Affichage sur petit écran (320 px) sans débordement", !overflow);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
await fetch(`${API}/storage/v1/object/photos/${photoPath}`, {
  method: "DELETE",
  headers: { apikey: KEY, authorization: `Bearer ${tok.T}` },
});
sql("delete from auth.users where email like 'test-visib-%@example.test';");
check(
  "Nettoyage : comptes et fichiers de test supprimés",
  sql("select count(*) from auth.users where email like 'test-visib-%'") === "0" &&
    sql(`select count(*) from storage.objects where name like '${tId}/%'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
