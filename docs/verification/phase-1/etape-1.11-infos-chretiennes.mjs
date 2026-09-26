// YONA — Phase 1 / Étape 1.11 — Vérification des informations chrétiennes.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.11-infos-chretiennes.mjs
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
sql("delete from auth.users where email like 'test-foi-%@example.test';");
const stamp = Date.now();
const PWD = "TestFoi!2026";
const mk = (tag, completed) => {
  const e = `test-foi-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Foi${tag}"}',now(),now(),'','','','');` +
      (completed
        ? `update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='male', birth_date='1990-01-01' from auth.users a where a.id=p.user_id and a.email='${e}';`
        : ""),
  );
  return e;
};
const A = mk("a", false);
const B = mk("b", true);
const faith = (e) =>
  sql(
    `select coalesce(denomination,'∅')||'|'||coalesce(church_attendance,'∅')||'|'||coalesce(faith_importance,'∅')||'|'||coalesce(faith_commitment,'∅')||'|'||coalesce(prayer_practice,'∅')||'|'||coalesce(marriage_vision,'∅')||'|'||array_to_string(christian_values,';') from public.christian_profiles c join public.users u on u.id=c.user_id where u.email='${e}'`,
  );
const token = async (e) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: e, password: PWD }),
      })
    ).json()
  ).access_token;

const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", A);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/onboarding$/, { timeout: 8000 });
await page.waitForTimeout(600);
await page.selectOption("#gender", "female");
await page.fill("#birthDate", "1995-03-03");
await page.getByRole("button", { name: "Continuer" }).click();

// 1. Étape « Votre foi » : les 7 informations du cahier des charges
const labels = await page.locator("section label").allTextContents();
check(
  "Étape « Votre foi » : dénomination, culte, place de la foi, pratique, prière, vision du mariage, valeurs",
  labels.length === 7 &&
    ["dénomination", "culte", "foi", "pratique", "prière", "mariage", "valeurs"].every((w) =>
      labels.join(" ").toLowerCase().includes(w),
    ),
  labels.join(" / "),
);
const max = async (id) => page.getAttribute(`#${id}`, "maxlength");
check(
  "Limites : réponses courtes 100 caractères, vision du mariage 1000",
  (await max("denomination")) === "100" &&
    (await max("churchAttendance")) === "100" &&
    (await max("faithImportance")) === "100" &&
    (await max("faithCommitment")) === "100" &&
    (await max("prayerPractice")) === "100" &&
    (await max("marriageVision")) === "1000",
);
check(
  "320 px : pas de défilement horizontal",
  await page.evaluate(() => document.documentElement.scrollWidth <= 390),
);

// 2. Saisie complète, avec valeurs en désordre (doublons, espaces, vides, trop longues, trop nombreuses)
await page.fill("#denomination", "Évangélique");
await page.fill("#churchAttendance", "Chaque dimanche");
await page.fill("#faithImportance", "Centrale");
await page.fill("#faithCommitment", "Groupe de maison");
await page.fill("#prayerPractice", "Chaque matin");
await page.fill("#marriageVision", "Une alliance devant Dieu.");
await page.fill(
  "#christianValues",
  ` Fidélité, pardon,  humilité, fidélité, , Prière, ${"L".repeat(60)}, v7, v8, v9, v10, v11, v12`,
);
await page.getByRole("button", { name: "Continuer" }).click();
await page.getByRole("button", { name: "Terminer" }).click();
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
const saved = faith(A);
check(
  "Les 7 informations sont enregistrées",
  saved.startsWith(
    "Évangélique|Chaque dimanche|Centrale|Groupe de maison|Chaque matin|Une alliance devant Dieu.|",
  ),
  saved.slice(0, 110),
);
const values = saved.split("|")[6].split(";");
check(
  "Valeurs : doublons et vides retirés, 40 caractères max, 10 au plus",
  values.length === 10 &&
    values[0] === "Fidélité" &&
    values[3] === "Prière" &&
    values[4] === "L".repeat(40) &&
    !values.includes("fidélité") &&
    values[9] === "v11" &&
    !values.includes("v12"),
  values.join(", ").slice(0, 110),
);

// 3. Réouverture : tout est pré-rempli
await page.goto(`${BASE}/onboarding`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "Onboarding rouvert : informations chrétiennes pré-remplies",
  (await page.inputValue("#faithCommitment")) === "Groupe de maison" &&
    (await page.inputValue("#prayerPractice")) === "Chaque matin" &&
    (await page.inputValue("#christianValues")).startsWith("Fidélité, pardon, humilité, Prière"),
  await page.inputValue("#christianValues"),
);

// 4. Visibilité : un autre membre voit ces informations d'un profil visible, pas d'un profil masqué
const jwtB = await token(B);
const readA = async () => {
  const uid = sql(`select id from auth.users where email='${A}'`);
  const r = await fetch(
    `${API}/rest/v1/christian_profiles?user_id=eq.${uid}&select=denomination,prayer_practice,christian_values`,
    { headers: { apikey: KEY, authorization: `Bearer ${jwtB}` } },
  );
  return r.json();
};
let seen = await readA();
check(
  "Un autre membre voit les informations chrétiennes d'un profil visible",
  seen.length === 1 && seen[0].prayer_practice === "Chaque matin",
);
sql(
  `update public.profiles p set visibility='hidden' from auth.users a where a.id=p.user_id and a.email='${A}'`,
);
seen = await readA();
check("… mais plus rien quand le profil est masqué", seen.length === 0);

// 5. Serveur : limites appliquées même sans l'interface
const jwtA = await token(A);
const uidA = sql(`select id from auth.users where email='${A}'`);
const patch = async (body) =>
  (
    await fetch(`${API}/rest/v1/christian_profiles?user_id=eq.${uidA}`, {
      method: "PATCH",
      headers: { apikey: KEY, authorization: `Bearer ${jwtA}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).status;
check(
  "Serveur : dénomination de 150 caractères refusée",
  (await patch({ denomination: "D".repeat(150) })) >= 400,
);
check(
  "Serveur : pratique de 150 caractères refusée",
  (await patch({ faith_commitment: "P".repeat(150) })) >= 400,
);
check(
  "Serveur : vision du mariage de 1500 caractères refusée",
  (await patch({ marriage_vision: "M".repeat(1500) })) >= 400,
);
check(
  "Serveur : 11 valeurs refusées",
  (await patch({ christian_values: Array.from({ length: 11 }, (_, i) => `v${i}`) })) >= 400,
);
check(
  "Serveur : valeur de 50 caractères refusée",
  (await patch({ christian_values: ["V".repeat(50)] })) >= 400,
);
check("Serveur : valeur vide refusée", (await patch({ christian_values: [""] })) >= 400);
check(
  "Serveur : modification valide acceptée",
  (await patch({ prayer_practice: "En famille" })) < 300,
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql("delete from auth.users where email like 'test-foi-%@example.test';");
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
