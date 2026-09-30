// YONA — Phase 4 / Étape 4.3 — Vérification de la liste des conversations (page /messages).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.3-liste-conversations.mjs
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
sql("delete from auth.users where email like 'test-lconv-%@example.test';");
const stamp = Date.now();
const PWD = "TestLconv!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-lconv-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Lcpaul"),
  c: mk("c", "male", "Lctiers"),
  a: mk("a", "female", "Lcgrace"),
  b: mk("b", "female", "Lcruth"),
  d: mk("d", "female", "Lcmarie"),
  e: mk("e", "female", "Lcsarah"),
  f: mk("f", "female", "Lcanne"),
  g: mk("g", "female", "Lcleah"),
  h: mk("h", "female", "Lceve"),
  n: mk("n", "female", "Lcnouvelle"),
};
const pair = (x, y) =>
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id[x]}','${id[y]}'), ('${id[y]}','${id[x]}');`,
  );
const conv = (x, y) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const msg = (x, y, from, content, ago, status = "delivered") =>
  sql(
    `insert into public.messages (conversation_id, sender_id, content, status, created_at) values ('${conv(x, y)}','${id[from]}','${content}','${status}', now() - interval '${ago}');`,
  );

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag, width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
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
const open = async (page) => {
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.getByTestId("messages-page").waitFor({ timeout: 5000 });
  await page.waitForTimeout(1200);
};
const rows = async (page) =>
  (await page.locator("[aria-label='Liste de vos conversations'] li").allTextContents()).map((t) =>
    t.trim(),
  );
const names = async (page) =>
  (await page.locator("[aria-label='Liste de vos conversations'] h2").allTextContents()).map((t) =>
    t.trim(),
  );

// A. Aucune conversation
const pv = await login("v");
await open(pv);
check(
  "Sans conversation : message et bouton « Découvrir des profils »",
  (await pv.getByText("Vous n'avez pas encore de conversation.").isVisible()) &&
    (await pv.getByRole("link", { name: "Découvrir des profils" }).getAttribute("href")) ===
      "/discover",
);

// B. Conversations et aperçus
for (const t of ["a", "b", "d", "e", "f", "g", "h"]) pair("v", t);
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.c}');`);
sql(
  `update public.conversations set created_at = now() - interval '10 days' where '${id.v}' in (user_1_id,user_2_id);`,
);
msg("v", "a", "a", "Bonjour Paul, ravie de ce Match !", "5 minutes");
msg("v", "b", "v", "Merci pour ton message, à bientôt !", "2 days");
msg("v", "b", "b", "Un message plus ancien de Ruth", "3 days");
msg("v", "d", "d", "Message modéré de Marie", "1 minute", "blocked");
await open(pv);
let list = await names(pv);
check(
  "7 conversations, la plus récente activité d'abord (Grace, puis Ruth, puis les autres)",
  list.length === 7 && list[0] === "Lcgrace" && list[1] === "Lcruth",
  list.join(","),
);
const r = await rows(pv);
check("Aperçu du dernier message reçu", r[0].includes("Bonjour Paul, ravie de ce Match !"));
check(
  "Dernier message envoyé par soi : préfixe « Vous : »",
  r[1].includes("Vous : Merci pour ton message, à bientôt !") && !r[1].includes("plus ancien"),
);
check(
  "Aujourd'hui : heure affichée ; plus ancien : date courte",
  /\d{2}:\d{2}/.test(r[0]) && /\d{1,2} [a-zéû]+\.?/.test(r[1]),
);
const marie = r.find((x) => x.includes("Lcmarie")) ?? "";
check(
  "Message bloqué par la modération (de l'autre personne) : jamais montré en aperçu",
  !marie.includes("modéré") && marie.includes("Nouveau Match : dites bonjour à Lcmarie !"),
  marie,
);

// C. Ce qui n'apparaît pas
check("Like sans retour : pas de conversation", !list.includes("Lctiers"));
sql(`update public.conversations set status='closed' where id='${conv("v", "e")}';
     update public.matches set status='unmatched' where '${id.f}' in (user_1_id,user_2_id);
     update public.profiles set visibility='hidden' where user_id='${id.g}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.h}','${id.v}');`);
await open(pv);
list = await names(pv);
check(
  "Conversation fermée, Match défait, profil masqué, blocage : non affichés",
  list.join(",") === "Lcgrace,Lcruth,Lcmarie",
  list.join(","),
);

// D. L'autre côté, un tiers
const pa = await login("a");
await open(pa);
check(
  "Grace voit sa conversation avec Paul (avec son propre message en « Vous : »)",
  (await rows(pa))[0]?.includes("Vous : Bonjour Paul"),
);
const pc = await login("c");
await open(pc);
check("Un tiers n'a aucune conversation", (await names(pc)).length === 0);

// E. Nouveau Match → conversation visible tout de suite
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.n}','${id.v}');`);
await pv.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1200);
await pv
  .locator("article")
  .filter({ hasText: "Lcnouvelle " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
await pv.getByTestId("match-dialog").waitFor({ timeout: 5000 });
await pv.keyboard.press("Escape");
await pv.getByRole("link", { name: "Messages" }).click();
await pv.waitForURL(/\/messages$/);
await pv.waitForTimeout(1500);
check(
  "Nouveau Match fait dans Découvrir : conversation en tête, « dites bonjour »",
  (await rows(pv))[0]?.includes("Lcnouvelle") &&
    (await rows(pv))[0]?.includes("dites bonjour à Lcnouvelle"),
);

// F. Petit écran, message très long, erreur
msg("v", "a", "a", "Très long message ".repeat(80), "1 second");
const small = await login("v", 320);
await open(small);
check(
  "Petit écran (320 px), aperçu très long raccourci : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await small.route("**/rest/v1/conversations*", (x) => x.abort());
await small.reload({ waitUntil: "networkidle" });
// Nouvelles tentatives automatiques (client base + page) : jusqu'à ~35 s avant l'erreur.
for (
  let i = 0;
  i < 600 &&
  !(await small
    .getByText("Vos conversations n'ont pas pu être chargées.")
    .isVisible()
    .catch(() => false));
  i++
)
  await small.waitForTimeout(100);
check(
  "Panne réseau : message « Vos conversations n'ont pas pu être chargées… »",
  await small
    .getByText("Vos conversations n'ont pas pu être chargées.")
    .isVisible()
    .catch(() => false),
);
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-lconv-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-lconv-%'") === "0" &&
    sql(`select count(*) from public.conversations where '${id.v}' in (user_1_id,user_2_id)`) ===
      "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
