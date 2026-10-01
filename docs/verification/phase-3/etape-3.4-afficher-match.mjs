// YONA — Phase 3 / Étape 3.4 — Vérification : affichage du nouveau Match (page Découverte).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.4-afficher-match.mjs
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
sql("delete from auth.users where email like 'test-affmatch-%@example.test';");
const stamp = Date.now();
const PWD = "TestAffMatch!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-affmatch-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Affpaul"),
  b: mk("b", "female", "Affgrace"),
  c: mk("c", "female", "Affruth"),
  d: mk("d", "female", "Affmarie"),
  e: mk("e", "female", "Affsarah"),
  h: mk("h", "female", "Affanne"),
};
// B, C, D et E ont déjà aimé V ; H non.
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.b}','${id.v}'), ('${id.c}','${id.v}'), ('${id.d}','${id.v}'), ('${id.e}','${id.v}');`,
);
const matches = () =>
  sql(`select count(*) from public.matches where '${id.v}' in (user_1_id,user_2_id)`);

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 760 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails.v);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  return page;
}
const page = await login();
const dialog = page.getByTestId("match-dialog");
const likeBtn = (name) =>
  page
    .locator("article")
    .filter({ hasText: `${name} ` })
    .getByRole("button", { name: /^(Liker le profil|Profil de .* aimé)/ });
const waitDialog = async (visible) => {
  for (let i = 0; i < 60 && (await dialog.isVisible()) !== visible; i++)
    await page.waitForTimeout(100);
  return dialog.isVisible();
};
const toastText = async () => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 40 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return t;
};

// A. Like réciproque → annonce du Match
await likeBtn("Affgrace").click();
check("V aime Grace (qui l'avait aimé) : la fenêtre « Match » s'ouvre", await waitDialog(true));
check(
  "Titre « C'est un Match ! », étiquette « Nouveau Match »",
  (await dialog.getByRole("heading").textContent())?.trim() === "C'est un Match !" &&
    (await dialog.getByText("Nouveau Match").isVisible()),
);
check(
  "Le prénom de la personne est affiché",
  (await dialog.textContent())?.includes("Vous et Affgrace vous êtes aimés mutuellement."),
);
check(
  "Fenêtre accessible (rôle « dialog », titre relié)",
  (await page.getByRole("dialog", { name: "C'est un Match !" }).count()) === 1,
);
check(
  "Pas de message « Like envoyé. » en plus",
  (await page.locator("[data-sonner-toast]").count()) === 0,
);
check("Le Match existe bien en base", matches() === "1");
await dialog.getByRole("button", { name: "Continuer à découvrir" }).click();
check("« Continuer à découvrir » ferme la fenêtre", !(await waitDialog(false)));
check(
  "La carte de Grace affiche « Aimé »",
  (await likeBtn("Affgrace").textContent())?.trim() === "Aimé",
);

// B. Autres façons de fermer
await likeBtn("Affruth").click();
await waitDialog(true);
check(
  "2e Match (Ruth) : la fenêtre affiche Ruth",
  (await dialog.textContent())?.includes("Vous et Affruth"),
);
await dialog.getByRole("button", { name: "Fermer" }).click();
check("Bouton croix « Fermer » : fenêtre fermée", !(await waitDialog(false)));
await likeBtn("Affmarie").click();
await waitDialog(true);
await page.keyboard.press("Escape");
check("Touche Échap : fenêtre fermée", !(await waitDialog(false)));

// C. Like sans retour → message habituel, pas de fenêtre
await likeBtn("Affanne").click();
const t = await toastText();
check(
  "Like sans retour (Anne) : « Like envoyé. », pas de fenêtre Match",
  t === "Like envoyé." && !(await dialog.isVisible()),
  t,
);

// D. Match déjà existant (créé ailleurs entre-temps) → pas de nouvelle annonce
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.e}');`);
await likeBtn("Affsarah").click();
const t2 = await toastText();
check(
  "Match déjà existant : « Vous aimez déjà ce profil. », pas de 2e annonce",
  t2 === "Vous aimez déjà ce profil." && !(await dialog.isVisible()),
  t2,
);
check("En base : 4 Matchs (Grace, Ruth, Marie, Sarah), aucun avec Anne", matches() === "4");

// E. Petit écran
const small = await login(320);
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.h}','${id.v}');`);
sql(
  `update public.likes set status='withdrawn' where sender_id='${id.v}' and receiver_id='${id.h}';`,
);
await small.reload({ waitUntil: "networkidle" });
await small.waitForTimeout(1200);
await small
  .locator("article")
  .filter({ hasText: "Affanne " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
const sd = small.getByTestId("match-dialog");
for (let i = 0; i < 60 && !(await sd.isVisible()); i++) await small.waitForTimeout(100);
const box = await sd.boundingBox();
check(
  "Petit écran (320 px) : la fenêtre tient entièrement à l'écran",
  (await sd.isVisible()) &&
    box &&
    box.x >= 0 &&
    box.x + box.width <= 320 &&
    box.y >= 0 &&
    box.y + box.height <= 760,
  box ? `${Math.round(box.x)},${Math.round(box.width)}` : "",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-affmatch-%@example.test';");
check(
  "Nettoyage : comptes, Likes et Matchs de test supprimés",
  sql("select count(*) from auth.users where email like 'test-affmatch-%'") === "0" &&
    matches() === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
