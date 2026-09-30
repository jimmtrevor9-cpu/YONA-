// YONA — Phase 1 / Étape 1.10 — Vérification de la présentation (bio).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.10-presentation.mjs
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
sql("delete from auth.users where email like 'test-bio-%@example.test';");
const stamp = Date.now();
const PWD = "TestBio!2026";
const mk = (tag, gender) => {
  const e = `test-bio-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Bio${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1994-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return e;
};
const A = mk("a", "female");
const B = mk("b", "male");
const bioOf = (e) =>
  sql(
    `select coalesce(bio,'∅') from public.profiles p join public.users u on u.id=p.user_id where u.email='${e}'`,
  );

const browser = await chromium.launch();
const jsErrors = [];
let dialogs = 0;
async function login(email) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  return page;
}
const saveProfile = async (page) => {
  await page.getByRole("button", { name: "Enregistrer" }).click();
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 50 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return t;
};

// 1. Limite de saisie (onboarding et profil)
let page = await login(A);
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
check(
  "Onboarding : présentation limitée à 2000 caractères",
  (await page.getAttribute("#bio", "maxlength")) === "2000",
);
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
check(
  "Profil : présentation limitée à 2000 caractères",
  (await page.getAttribute("#bio", "maxlength")) === "2000",
);

// 2. Texte trop long collé → tronqué à 2000, enregistré sans erreur
await page.fill("#bio", "x".repeat(2100));
let t = await saveProfile(page);
check(
  "Texte de 2100 caractères → enregistré, limité à 2000",
  t.includes("Profil enregistré") && bioOf(A).length === 2000,
  `${t} / ${bioOf(A).length}`,
);

// 3. Texte riche : accents, emojis, retours à la ligne, espaces autour
const rich =
  "Je m'appelle Élise 🙏\nJ'aime la louange, la lecture et les randonnées.\n\n« Aimons-nous les uns les autres »";
await page.fill("#bio", `   ${rich}   `);
t = await saveProfile(page);
check(
  "Accents, emojis et retours à la ligne enregistrés tels quels (espaces autour retirés)",
  bioOf(A) === rich,
  JSON.stringify(bioOf(A)).slice(0, 80),
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
check(
  "Après rechargement : présentation affichée à l'identique",
  (await page.inputValue("#bio")) === rich,
);

// 4. Texte composé uniquement d'espaces → présentation vide
await page.fill("#bio", "   \n   ");
await saveProfile(page);
check("Espaces seulement → présentation vide", bioOf(A) === "∅");

// 5. Code HTML / script → affiché comme du texte, jamais exécuté
const evil = `<img src=x onerror="alert('piratage')"><script>alert('piratage')</script><b>gras</b>`;
await page.fill("#bio", evil);
await saveProfile(page);
check("Code HTML enregistré comme simple texte", bioOf(A) === evil);
await page.context().close();

// 6. Affichage chez un autre membre (découverte)
page = await login(B);
await page.waitForTimeout(1000);
const card = page.locator("article", { hasText: "Bioa" });
const cardText = (await card.textContent().catch(() => "")) ?? "";
check(
  "Un autre membre voit la présentation sur la carte de découverte",
  cardText.includes("<script>alert('piratage')</script>"),
  cardText.slice(0, 80),
);
check(
  "Aucun code exécuté (aucune alerte), aucune balise injectée",
  dialogs === 0 && (await card.locator("img, script, b").count()) === 0,
  `${dialogs} alerte(s)`,
);
await page.context().close();

// 7. Serveur : plus de 2000 caractères refusés même sans l'interface
const jwt = (
  await (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email: A, password: PWD }),
    })
  ).json()
).access_token;
const uid = sql(`select id from auth.users where email='${A}'`);
const r = await fetch(`${API}/rest/v1/profiles?user_id=eq.${uid}`, {
  method: "PATCH",
  headers: { apikey: KEY, authorization: `Bearer ${jwt}`, "content-type": "application/json" },
  body: JSON.stringify({ bio: "y".repeat(2001) }),
});
check("Serveur : présentation de 2001 caractères refusée", r.status >= 400, `HTTP ${r.status}`);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql("delete from auth.users where email like 'test-bio-%@example.test';");
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
