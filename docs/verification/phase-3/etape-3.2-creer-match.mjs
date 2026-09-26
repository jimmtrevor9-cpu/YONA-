// YONA — Phase 3 / Étape 3.2 — Vérification : création du Match (base + serveur + page).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.2-creer-match.mjs
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
sql("delete from auth.users where email like 'test-match-%@example.test';");
const stamp = Date.now();
const PWD = "TestMatch!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-match-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Match${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = { v: mk("v", "male"), c: mk("c", "male") };
for (const t of ["a", "b", "d", "e", "g", "h"]) id[t] = mk(t, "female");
// 10 paires pour les Likes croisés simultanés
const pairs = [];
for (let i = 0; i < 10; i++)
  pairs.push([mk(`p${i}m`, "male"), mk(`p${i}f`, "female"), `p${i}m`, `p${i}f`]);

const tok = {};
for (const t of Object.keys(emails))
  tok[t] = (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: emails[t], password: PWD }),
      })
    ).json()
  ).access_token;
const headers = (t) => ({
  apikey: KEY,
  ...(t ? { authorization: `Bearer ${tok[t]}` } : {}),
  "content-type": "application/json",
  prefer: "return=representation",
});
const likeApi = (s, sId, rId, kind = "like") =>
  fetch(`${API}/rest/v1/likes`, {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({ sender_id: sId, receiver_id: rId, kind }),
  }).then((x) => x.status);
const matchOf = (x, y) =>
  sql(
    `select coalesce((select id||'|'||status||'|'||(user_1_id<user_2_id)||'|'||(created_at > now() - interval '1 minute') from public.matches where user_1_id=least('${x}'::uuid,'${y}'::uuid) and user_2_id=greatest('${x}'::uuid,'${y}'::uuid)),'aucun')`,
  );
const nMatches = (x) =>
  sql(`select count(*) from public.matches where '${x}' in (user_1_id, user_2_id)`);

// ---------- A. Base : création ----------
await likeApi("v", id.v, id.a);
check("Like à sens unique (V → A) : aucun Match", matchOf(id.v, id.a) === "aucun");
await likeApi("a", id.a, id.v);
const mva = matchOf(id.v, id.a);
check("A aime V en retour : Match créé automatiquement", mva !== "aucun", mva);
check("Match : actif, paire ordonnée, daté de maintenant", mva.endsWith("|active|true|true"), mva);

await likeApi("d", id.d, id.v, "pass");
await likeApi("v", id.v, id.d);
check("D a passé V, V aime D : aucun Match", matchOf(id.v, id.d) === "aucun");
sql(`update public.likes set kind='like' where sender_id='${id.d}' and receiver_id='${id.v}';`);
check("D change d'avis (Pass → Like) : Match créé", matchOf(id.v, id.d) !== "aucun");

sql(`insert into public.likes (sender_id, receiver_id) values ('${id.e}','${id.v}');
     insert into public.likes (sender_id, receiver_id, status) values ('${id.v}','${id.e}','withdrawn');`);
check("Like de V retiré : aucun Match", matchOf(id.v, id.e) === "aucun");
sql(`update public.likes set status='active' where sender_id='${id.v}' and receiver_id='${id.e}';`);
check("V réactive son Like : Match créé", matchOf(id.v, id.e) !== "aucun");

sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.g}','${id.v}');
     insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.g}'), ('${id.g}','${id.v}');`);
check(
  "Likes croisés mais blocage entre eux (écriture serveur) : aucun Match",
  matchOf(id.v, id.g) === "aucun",
);

// Likes croisés envoyés au même instant, 10 paires
await Promise.all(pairs.flatMap(([m, f, tm, tf]) => [likeApi(tm, m, f), likeApi(tf, f, m)]));
const created = pairs
  .map(([m, f]) => (matchOf(m, f) === "aucun" ? 0 : 1))
  .reduce((a, b) => a + b, 0);
const dup = sql(
  `select count(*) from (select user_1_id, user_2_id from public.matches group by 1,2 having count(*)>1) x`,
);
check(
  "10 paires de Likes croisés simultanés : 10 Matchs, aucun doublon",
  created === 10 && dup === "0",
  `${created}/10`,
);

// ---------- B. Protections ----------
let r = await fetch(`${API}/rest/v1/matches`, {
  method: "POST",
  headers: headers("c"),
  body: JSON.stringify({
    user_1_id: id.c < id.h ? id.c : id.h,
    user_2_id: id.c < id.h ? id.h : id.c,
  }),
});
check(
  "Un membre ne peut pas créer un Match lui-même",
  r.status === 401 || r.status === 403,
  `HTTP ${r.status}`,
);
const mvaId = mva.split("|")[0];
r = await fetch(`${API}/rest/v1/matches?id=eq.${mvaId}`, {
  method: "PATCH",
  headers: headers("v"),
  body: JSON.stringify({ status: "unmatched" }),
});
const r2 = await fetch(`${API}/rest/v1/matches?id=eq.${mvaId}`, {
  method: "DELETE",
  headers: headers("v"),
});
check(
  "… ni le modifier ni le supprimer",
  matchOf(id.v, id.a).includes("|active|") && r.status >= 400 && r2.status >= 400,
  `PATCH ${r.status} · DELETE ${r2.status}`,
);
const seen = async (t) =>
  (await (await fetch(`${API}/rest/v1/matches?select=id`, { headers: headers(t) })).json()).length;
check("V voit ses Matchs (A, D, E)", (await seen("v")) === 3, `${await seen("v")}`);
check(
  "A voit son Match avec V ; un tiers (C) n'en voit aucun",
  (await seen("a")) === 1 && (await seen("c")) === 0,
);

// ---------- C. Par la page ----------
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
const responses = [];
page.on("response", async (x) => {
  if (x.url().includes("/_serverFn/")) responses.push(await x.text());
});
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.waitForTimeout(600);
await likeApi("b", id.b, id.v);
await page
  .locator("article")
  .filter({ hasText: "Matchb " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
for (let i = 0; i < 60 && responses.length === 0; i++) await page.waitForTimeout(100);
await page.waitForTimeout(300);
const mvb = matchOf(id.v, id.b);
check("Page : V aime B (qui l'avait aimé) → Match créé", mvb !== "aucun", mvb);
check(
  "… la réponse du serveur contient l'identifiant de ce Match",
  mvb !== "aucun" && (responses[0] ?? "").includes(`"s":"${mvb.split("|")[0]}"`),
);
// Depuis l'étape 3.4, un Like réciproque ouvre la fenêtre « Match » : on la ferme.
for (let i = 0; i < 40 && !(await page.getByTestId("match-dialog").isVisible()); i++)
  await page.waitForTimeout(100);
await page.keyboard.press("Escape");
await page.getByTestId("match-dialog").waitFor({ state: "hidden", timeout: 5000 });
responses.length = 0;
await page
  .locator("article")
  .filter({ hasText: "Matchh " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
for (let i = 0; i < 60 && responses.length === 0; i++) await page.waitForTimeout(100);
check("Page : V aime H (sans retour) → aucun Match", matchOf(id.v, id.h) === "aucun");
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- D. Persistance, portée, suppression ----------
check("Persistance : le Match V–A est toujours là", matchOf(id.v, id.a) === mva);
check(
  "Aucune conversation créée à cette étape (étape 4.1)",
  sql(
    `select count(*) from public.conversations where match_id in (select id from public.matches where '${id.v}' in (user_1_id,user_2_id))`,
  ) === "0",
);
sql(`delete from auth.users where id='${id.a}';`);
check(
  "Compte de A supprimé : son Match disparaît aussi",
  matchOf(id.v, id.a) === "aucun" && nMatches(id.v) === "3",
);

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-match-%@example.test';");
check(
  "Nettoyage : comptes, Likes et Matchs de test supprimés",
  sql("select count(*) from auth.users where email like 'test-match-%'") === "0" &&
    nMatches(id.v) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
