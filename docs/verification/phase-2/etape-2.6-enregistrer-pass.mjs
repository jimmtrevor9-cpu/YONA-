// YONA — Phase 2 / Étape 2.6 — Vérification de l'enregistrement du Pass (serveur + base + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.6-enregistrer-pass.mjs
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
sql("delete from auth.users where email like 'test-enrpass-%@example.test';");
const stamp = Date.now();
const PWD = "TestEnrPass!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-enrpass-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Enrpass${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const T = ["a", "b", "c", "d", "e", "f", "g", "h"];
const id = { v: mk("v", "male") };
for (const t of T) id[t] = mk(t, "female");
const row = (r) =>
  sql(
    `select kind||'/'||status from public.likes where sender_id='${id.v}' and receiver_id='${id[r]}'`,
  );
const rows = (r) =>
  sql(`select count(*) from public.likes where sender_id='${id.v}' and receiver_id='${id[r]}'`);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
let captured = null;
async function tab() {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  page.on("request", (q) => {
    if (q.url().includes("/_serverFn/") && q.method() === "POST" && !captured)
      captured = { url: q.url(), headers: q.headers(), body: q.postData() };
  });
  return page;
}
const quiet = async (p) => {
  for (let i = 0; i < 80 && (await p.locator("[data-sonner-toast]").count()) > 0; i++)
    await p.waitForTimeout(100);
};
const toast = async (p) => {
  const list = p.locator("[data-sonner-toast]");
  for (let i = 0; i < 80 && (await list.count()) === 0; i++) await p.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  await quiet(p);
  return t;
};
const page = await tab();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
await quiet(page);
await page.waitForTimeout(800);
const card = (p, t) => p.locator("article").filter({ hasText: `Enrpass${t} ` });
const passBtn = (p, t) => card(p, t).getByRole("button", { name: /^Passer le profil/ });
const likeBtn = (p, t) =>
  card(p, t).getByRole("button", { name: /^(Liker le profil|Profil de .* aimé)/ });
const waitRow = async (r, expected) => {
  for (let i = 0; i < 50 && row(r) !== expected; i++) await page.waitForTimeout(100);
  return row(r);
};

// A. Nominal
await passBtn(page, "a").click();
check("Clic « Passer » : carte retirée immédiatement", (await card(page, "a").count()) === 0);
check(
  "Pass enregistré en base (type « pass », actif)",
  (await waitRow("a", "pass/active")) === "pass/active",
  row("a"),
);
check(
  "Auteur = membre connecté, date fixée par le serveur",
  sql(
    `select count(*) from public.likes where sender_id='${id.v}' and receiver_id='${id.a}' and created_at > now() - interval '1 minute'`,
  ) === "1",
);
check(
  "Aucun message affiché pour un Pass réussi",
  (await page.locator("[data-sonner-toast]").count()) === 0,
);

// B. Persistance + pas de doublon
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
check("Après rechargement : le Pass est toujours en base", row("a") === "pass/active");
check(
  "(Le profil passé est encore proposé : exclusion = étape 2.7)",
  (await card(page, "a").count()) === 1,
);
await passBtn(page, "a").click();
await page.waitForTimeout(1200);
check(
  "2e Pass du même profil : pas de doublon, aucun message d'erreur",
  rows("a") === "1" && (await page.locator("[data-sonner-toast]").count()) === 0,
);

// C. Changer d'avis : Pass puis Like
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await likeBtn(page, "a").click();
const tl = await toast(page);
check(
  "Profil passé puis aimé : même ligne, devenue un Like",
  tl === "Like envoyé." && rows("a") === "1" && row("a") === "like/active",
  tl,
);

// D. Erreurs
sql(`update public.profiles set visibility='hidden' where user_id='${id.b}';`);
await passBtn(page, "b").click();
let t = await toast(page);
check(
  "Profil devenu indisponible : « Ce profil n'est plus disponible. », rien d'enregistré",
  t === "Ce profil n'est plus disponible." && rows("b") === "0",
  t,
);
await page.waitForTimeout(800);
check("… la carte ne revient pas", (await card(page, "b").count()) === 0);

await page.route("**/_serverFn/**", (route) => route.abort());
await passBtn(page, "c").click();
t = await toast(page);
await page.unroute("**/_serverFn/**");
check(
  "Panne réseau : « Le Pass n'a pas pu être enregistré… »",
  t.startsWith("Le Pass n'a pas pu être enregistré"),
  t,
);
check(
  "… la carte revient, rien d'enregistré",
  (await card(page, "c").count()) === 1 && rows("c") === "0",
);

// Deux onglets : aimé dans l'un, passé dans l'autre
const tab2 = await tab();
await tab2.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await tab2.waitForTimeout(1200);
await likeBtn(page, "d").click();
await toast(page);
await passBtn(tab2, "d").click();
t = await toast(tab2);
await tab2.waitForTimeout(800);
check(
  "Déjà aimé dans un autre onglet : « Vous aimez déjà ce profil. »",
  t === "Vous aimez déjà ce profil.",
  t,
);
check(
  "… la carte revient en « Aimé », le Like est conservé",
  (await likeBtn(tab2, "d").textContent())?.trim() === "Aimé" && row("d") === "like/active",
);

// Like retiré puis passé
sql(
  `insert into public.likes (sender_id, receiver_id, status) values ('${id.v}','${id.e}','withdrawn');`,
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await passBtn(page, "e").click();
check(
  "Like retiré puis passé : même ligne, devenue un Pass",
  (await waitRow("e", "pass/active")) === "pass/active" && rows("e") === "1",
);

// E. Appels directs au serveur (rejeu de l'appel capturé)
const replay = async (target, withAuth = true) => {
  const headers = Object.fromEntries(
    Object.entries(captured.headers).filter(
      ([k]) =>
        !["host", "content-length", "connection"].includes(k) &&
        (withAuth || k !== "authorization"),
    ),
  );
  const res = await fetch(captured.url, {
    method: "POST",
    headers,
    body: captured.body.replace(id.a, target),
  });
  return { status: res.status, text: await res.text() };
};
let r = await replay(id.v);
check(
  "Serveur : se passer soi-même → refusé avec message clair",
  r.text.includes("Vous ne pouvez pas passer votre propre profil."),
);
r = await replay(id.v.toUpperCase());
check(
  "… identifiant en MAJUSCULES → même refus",
  r.text.includes("Vous ne pouvez pas passer votre propre profil."),
);
r = await replay(id.f, false);
check(
  "Serveur sans connexion : refusé, rien d'enregistré",
  (r.status >= 400 || r.text.includes("Unauthorized")) && rows("f") === "0",
  `HTTP ${r.status}`,
);
const burst = await Promise.all(Array.from({ length: 5 }, () => replay(id.g)));
check(
  "5 Pass simultanés vers G : 1 seule ligne",
  burst.every((x) => x.status === 200) && rows("g") === "1" && row("g") === "pass/active",
  burst.map((x) => x.status).join(","),
);

// F. Base de données (écriture directe)
const tok = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: emails.v, password: PWD }),
    })
  ).json()
).access_token;
const direct = (body) =>
  fetch(`${API}/rest/v1/likes`, {
    method: "POST",
    headers: { apikey: KEY, authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((x) => x.status);
check(
  "API : Pass vers un profil masqué refusé",
  (await direct({ sender_id: id.v, receiver_id: id.b, kind: "pass" })) === 403 && rows("b") === "0",
);
check(
  "API : Pass au nom d'un autre membre refusé",
  (await direct({ sender_id: id.h, receiver_id: id.f, kind: "pass" })) === 403,
);
check(
  "API : 2e Pass vers G refusé (doublon)",
  (await direct({ sender_id: id.v, receiver_id: id.g, kind: "pass" })) === 409 && rows("g") === "1",
);
const tokA = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: emails.g, password: PWD }),
    })
  ).json()
).access_token;
const seen = await (
  await fetch(`${API}/rest/v1/likes?select=id`, {
    headers: { apikey: KEY, authorization: `Bearer ${tokA}` },
  })
).json();
check(
  "Confidentialité : la personne passée ne voit pas le Pass",
  Array.isArray(seen) && seen.length === 0,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-enrpass-%@example.test';");
check(
  "Nettoyage : comptes, Likes et Pass de test supprimés",
  sql("select count(*) from auth.users where email like 'test-enrpass-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
