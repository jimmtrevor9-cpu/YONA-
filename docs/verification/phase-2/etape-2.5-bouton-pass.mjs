// YONA — Phase 2 / Étape 2.5 — Vérification du bouton Pass (page Découverte).
// Depuis l'étape 2.6, chaque Pass est enregistré en base (type « pass »).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.5-bouton-pass.mjs
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
sql("delete from auth.users where email like 'test-pass-%@example.test';");
const stamp = Date.now();
const PWD = "TestPass!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-pass-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Pass${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male"),
  w: mk("w", "male"),
  a: mk("a", "female"),
  b: mk("b", "female"),
  c: mk("c", "female"),
  d: mk("d", "female"),
};
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.d}');`);
const likesOfV = () =>
  sql(`select count(*) from public.likes where sender_id='${id.v}' and kind='like'`);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag, width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  return page;
}
const page = await login("v");
const card = (tag) => page.locator("article").filter({ hasText: `Pass${tag} ` });
const pass = (tag) => card(tag).getByRole("button", { name: /^Passer le profil/ });
const names = async (p = page) =>
  (await p.locator("article h3").allTextContents())
    .map((t) => t.split(" ·")[0].trim())
    .sort()
    .join(",");

// A. Affichage
check(
  "Cartes proposées : A, B, C, D (+ W)",
  (await names()) === "Passa,Passb,Passc,Passd,Passw",
  await names(),
);
check(
  "Bouton « Passer » sur chaque carte non aimée, avec libellé accessible",
  (await pass("a").count()) === 1 &&
    (await pass("a").textContent())?.trim() === "Passer" &&
    (await pass("a").getAttribute("aria-label")) === "Passer le profil de Passa",
);
const footer = await card("a").locator("button").allTextContents();
check(
  "Ordre : « Passer » puis « Like », sur la même ligne",
  footer.map((t) => t.trim()).join(",") === "Passer,Like",
  footer.join(","),
);
check(
  "Profil déjà aimé (D) : pas de bouton « Passer », seulement « Aimé »",
  (await pass("d").count()) === 0 &&
    (await card("d").getByRole("button").textContent())?.trim() === "Aimé",
);
const box = await pass("a").boundingBox();
check("Zone de toucher suffisante (≥ 36 px de haut)", (box?.height ?? 0) >= 36, `${box?.height}px`);

// B. Clic
await pass("a").click();
await page.waitForTimeout(300);
check(
  "Clic sur « Passer » : la carte de A disparaît, les autres restent",
  (await names()) === "Passb,Passc,Passd,Passw",
  await names(),
);
check("Aucun Like créé par un Pass", likesOfV() === "1");

// C. Clavier
await pass("b").focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
check("Clavier (Entrée) : B passée", (await names()) === "Passc,Passd,Passw", await names());

// D. Pendant l'envoi d'un Like, « Passer » est désactivé sur cette carte
await page.route("**/_serverFn/**", async (route) => {
  await new Promise((r) => setTimeout(r, 1200));
  await route.continue();
});
await card("c")
  .getByRole("button", { name: /^Liker/ })
  .click();
await page.waitForTimeout(200);
check(
  "Pendant l'envoi d'un Like : « Passer » désactivé sur la carte",
  await pass("c").isDisabled(),
);
for (let i = 0; i < 40 && (await pass("c").count()) > 0; i++) await page.waitForTimeout(100);
await page.unroute("**/_serverFn/**");
check(
  "Like envoyé : « Passer » disparaît de la carte aimée",
  (await pass("c").count()) === 0 && likesOfV() === "2",
);

// E. Tout passer → message de liste vide
await pass("w").click();
await page.waitForTimeout(300);
check(
  "Profils restants : seulement les aimés (C, D)",
  (await names()) === "Passc,Passd",
  await names(),
);
sql(`delete from public.likes where sender_id='${id.v}';`);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
for (const t of ["a", "b", "c", "d", "w"]) await pass(t).click();
await page.waitForTimeout(300);
check(
  "Tous les profils passés : message « Aucun profil… » affiché",
  (await page.locator("article").count()) === 0 &&
    (await page
      .getByText("Aucun profil ne correspond à vos préférences pour le moment.")
      .isVisible()),
);

// F. Portée
for (
  let i = 0;
  i < 50 &&
  sql(`select count(*) from public.likes where sender_id='${id.v}' and kind='pass'`) !== "5";
  i++
)
  await page.waitForTimeout(100);
check(
  "Les 5 Pass sont enregistrés en base (depuis l'étape 2.6)",
  sql(`select count(*) from public.likes where sender_id='${id.v}' and kind='pass'`) === "5",
);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
check(
  "Après rechargement, les profils passés réapparaissent (exclusion = étape 2.7)",
  (await names()) === "Passa,Passb,Passc,Passd,Passw",
);
const other = await login("w");
check(
  "Un autre membre n'est pas affecté par les Pass de V",
  (await names(other)).includes("Passa"),
);

// G. Recherche et petit écran
await page.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
check(
  "Page Recherche inchangée (aucun bouton sur les cartes)",
  (await page.locator("article button").count()) === 0,
);
const small = await login("v", 320);
const smallBox = await small.locator("article").first().locator("button").allTextContents();
check(
  "Petit écran (320 px) : « Passer » et « Like » tiennent sur la carte, sans débordement",
  smallBox.length === 2 &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-pass-%@example.test';");
check(
  "Nettoyage : comptes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-pass-%'") === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
