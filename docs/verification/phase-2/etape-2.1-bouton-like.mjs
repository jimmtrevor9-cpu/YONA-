// YONA — Phase 2 / Étape 2.1 — Vérification du bouton Like (page Découverte).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.1-bouton-like.mjs
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
sql("delete from auth.users where email like 'test-like-%@example.test';");
const stamp = Date.now();
const PWD = "TestLike!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-like-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Like${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1991-01-01' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male"),
  a: mk("a", "female"),
  b: mk("b", "female"),
  c: mk("c", "female"),
  d: mk("d", "female"),
  e: mk("e", "female"),
};
const likes = (to) =>
  sql(
    `select count(*)||':'||coalesce(string_agg(kind||'/'||status,','),'') from public.likes where sender_id='${id.v}'${to ? ` and receiver_id='${id[to]}'` : ""}`,
  );

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
let serverFnUrl = "";
page.on("request", (r) => {
  if (r.url().includes("/_serverFn/") && r.method() === "POST") serverFnUrl = r.url();
});
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
// Attendre la disparition du message de bienvenue de la connexion
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.waitForTimeout(500);

const card = (tag) => page.locator("article").filter({ hasText: `Like${tag}` });
const button = (tag) => card(tag).getByRole("button");
const toast = async () => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 80 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return t;
};

// A. Affichage
const labels = await page.locator("article button").allTextContents();
check(
  "Un bouton « Like » sur chaque carte proposée",
  labels.length === 5 && labels.every((l) => l.trim() === "Like"),
  labels.join(","),
);
check(
  "Libellé accessible : « Liker le profil de … », non pressé",
  (await button("a").getAttribute("aria-label")) === "Liker le profil de Likea" &&
    (await button("a").getAttribute("aria-pressed")) === "false",
);
const box = await button("a").boundingBox();
check("Zone de toucher suffisante (≥ 36 px de haut)", (box?.height ?? 0) >= 36, `${box?.height}px`);

// B. Clic nominal
await button("a").click();
let t = await toast();
check("Clic : message « Like envoyé. »", t === "Like envoyé.", t);
check(
  "Bouton devenu « Aimé », désactivé, pressé",
  (await button("a").textContent())?.trim() === "Aimé" &&
    (await button("a").isDisabled()) &&
    (await button("a").getAttribute("aria-pressed")) === "true",
);
check(
  "Like enregistré sur le serveur (1 Like actif vers A)",
  likes("a") === "1:like/active",
  likes("a"),
);
check("Les autres cartes restent « Like »", (await button("b").textContent())?.trim() === "Like");

// C. Pendant l'envoi + double clic
await page.route("**/_serverFn/**", async (route) => {
  await new Promise((r) => setTimeout(r, 1200));
  await route.continue();
});
await button("b").click();
await page.waitForTimeout(200);
check(
  "Pendant l'envoi : « Envoi… », bouton désactivé",
  (await button("b").textContent())?.trim() === "Envoi…" && (await button("b").isDisabled()),
);
await button("b")
  .click({ force: true })
  .catch(() => {});
await toast();
await page.unroute("**/_serverFn/**");
check("Double clic : un seul Like enregistré", likes("b") === "1:like/active", likes("b"));

// D. Clavier
await button("c").focus();
await page.keyboard.press("Enter");
t = await toast();
check("Clavier (Entrée) : Like envoyé", t === "Like envoyé." && likes("c") === "1:like/active");

// E. Persistance
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check(
  "Après rechargement : A, B, C « Aimé » ; D, E « Like »",
  (
    await Promise.all(
      ["a", "b", "c", "d", "e"].map(async (k) => (await button(k).textContent())?.trim()),
    )
  ).join(",") === "Aimé,Aimé,Aimé,Like,Like",
);

// F. Erreurs
sql(`update public.profiles set visibility='hidden' where user_id='${id.d}';`);
await button("d").click();
t = await toast();
check(
  "Profil devenu indisponible : « Ce profil n'est plus disponible. »",
  t === "Ce profil n'est plus disponible.",
  t,
);
await page.waitForTimeout(1000);
check(
  "… la carte disparaît et aucun Like n'est enregistré",
  (await card("d").count()) === 0 && likes("d") === "0:",
);

await page.route("**/_serverFn/**", (route) => route.abort());
await button("e").click();
t = await toast();
await page.unroute("**/_serverFn/**");
check(
  "Panne réseau : message « … Réessayez dans un instant. »",
  t.includes("Réessayez dans un instant"),
  t,
);
check(
  "… le bouton redevient « Like », utilisable, rien d'enregistré",
  (await button("e").textContent())?.trim() === "Like" &&
    !(await button("e").isDisabled()) &&
    likes("e") === "0:",
);

// G. Appel direct du serveur sans être connecté
const direct = await fetch(serverFnUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ data: { receiverId: id.e } }),
});
const body = await direct.text();
check(
  "Appel du serveur sans connexion : refusé, rien d'enregistré",
  serverFnUrl !== "" && (direct.status >= 400 || /Unauthorized/.test(body)) && likes("e") === "0:",
  `HTTP ${direct.status}`,
);
check(
  "Total : exactement 3 Likes enregistrés pour V",
  likes() === "3:like/active,like/active,like/active",
);

// H. Affichage
await page.setViewportSize({ width: 320, height: 700 });
await page.waitForTimeout(400);
check(
  "Petit écran (320 px) : pas de débordement",
  !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-like-%@example.test';");
check(
  "Nettoyage : comptes et Likes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-like-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
