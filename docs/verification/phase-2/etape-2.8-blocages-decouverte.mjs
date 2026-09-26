// YONA — Phase 2 / Étape 2.8 — Vérification : les blocages sont respectés dans la découverte.
// (Il n'existe pas encore de bouton « Bloquer » : Phase 21. Les blocages sont créés via l'API,
// avec les droits du membre, comme le fera ce futur bouton.)
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-2/etape-2.8-blocages-decouverte.mjs
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
sql("delete from auth.users where email like 'test-bloc-%@example.test';");
const stamp = Date.now();
const PWD = "TestBloc!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-bloc-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Bloc${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
// V (homme) et W (homme) cherchent des femmes ; A, B, C, D femmes cherchent des hommes.
const id = { v: mk("v", "male"), w: mk("w", "male") };
for (const t of ["a", "b", "c", "d"]) id[t] = mk(t, "female");
sql(`update public.preferences set preferred_gender='female' where user_id in ('${id.v}','${id.w}');
     update public.preferences set preferred_gender='male' where user_id in ('${id.a}','${id.b}','${id.c}','${id.d}');`);
const tag = Object.fromEntries(Object.entries(id).map(([k, v]) => [v, k]));

const tok = {};
for (const t of Object.keys(id))
  tok[t] = (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: emails[t], password: PWD }),
      })
    ).json()
  ).access_token;
const api = async (t, method, path, body) => {
  const r = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      authorization: `Bearer ${tok[t]}`,
      "content-type": "application/json",
      prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => null);
  return { status: r.status, rows: Array.isArray(json) ? json : [] };
};
const feed = async (t) =>
  (await api(t, "POST", "rpc/discover_profiles", {})).rows
    .map((x) => tag[x.user_id] ?? "?")
    .sort()
    .join(",");
const block = (by, who) => api(by, "POST", "blocks", { blocker_id: id[by], blocked_id: id[who] });
const unblock = (by, who) =>
  api(by, "DELETE", `blocks?blocker_id=eq.${id[by]}&blocked_id=eq.${id[who]}`);
const row = (s, r) =>
  sql(
    `select coalesce((select kind||'/'||status from public.likes where sender_id='${id[s]}' and receiver_id='${id[r]}'),'aucun')`,
  );

// ---------- A. Serveur : exclusion dans les deux sens ----------
check(
  "Au départ : V voit A, B, C, D ; A voit V et W",
  (await feed("v")) === "a,b,c,d" && (await feed("a")) === "v,w",
);
let r = await block("v", "a");
check("V bloque A (avec ses propres droits) : enregistré", r.status === 201, `HTTP ${r.status}`);
check("V ne voit plus A dans sa découverte", (await feed("v")) === "b,c,d", await feed("v"));
check("A (bloquée) ne voit plus V dans la sienne", (await feed("a")) === "w", await feed("a"));
check(
  "Ni l'un ni l'autre ne peut lire le profil, la foi ou les photos de l'autre",
  (await api("v", "GET", `profiles?select=user_id&user_id=eq.${id.a}`)).rows.length === 0 &&
    (await api("a", "GET", `profiles?select=user_id&user_id=eq.${id.v}`)).rows.length === 0 &&
    (await api("v", "GET", `christian_profiles?select=user_id&user_id=eq.${id.a}`)).rows.length ===
      0 &&
    (await api("a", "GET", `photos?select=id&user_id=eq.${id.v}`)).rows.length === 0,
);
check("Un tiers (W) n'est pas affecté : il voit toujours A", (await feed("w")) === "a,b,c,d");
check(
  "Recherche : V ne trouve pas A",
  (
    await api(
      "v",
      "GET",
      `profiles?select=user_id&status=eq.active&visibility=eq.visible&user_id=neq.${id.v}`,
    )
  ).rows.every((x) => x.user_id !== id.a),
);

// ---------- B. Serveur : aucune interaction possible ----------
r = await api("v", "POST", "likes", { sender_id: id.v, receiver_id: id.a });
check("Like V → A refusé", r.status === 403 && row("v", "a") === "aucun", `HTTP ${r.status}`);
r = await api("a", "POST", "likes", { sender_id: id.a, receiver_id: id.v });
check(
  "Like A → V refusé (sens inverse)",
  r.status === 403 && row("a", "v") === "aucun",
  `HTTP ${r.status}`,
);
r = await api("a", "POST", "likes", { sender_id: id.a, receiver_id: id.v, kind: "pass" });
check("Pass A → V refusé", r.status === 403, `HTTP ${r.status}`);

// ---------- C. Confidentialité du blocage ----------
check("V voit son blocage", (await api("v", "GET", "blocks?select=blocked_id")).rows.length === 1);
check(
  "A ne voit pas qu'elle est bloquée",
  (await api("a", "GET", "blocks?select=blocker_id")).rows.length === 0,
);
r = await api("a", "DELETE", `blocks?blocker_id=eq.${id.v}`);
check(
  "A ne peut pas supprimer le blocage de V",
  sql(`select count(*) from public.blocks where blocker_id='${id.v}'`) === "1",
  `HTTP ${r.status}`,
);
r = await api("a", "POST", "blocks", { blocker_id: id.v, blocked_id: id.b });
check("Bloquer au nom d'un autre : refusé", r.status === 403, `HTTP ${r.status}`);
r = await block("v", "v");
check("Se bloquer soi-même : refusé", r.status >= 400, `HTTP ${r.status}`);

// ---------- D. Like existant puis blocage ----------
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.b}');`);
await block("v", "b");
r = await api("v", "PATCH", `likes?sender_id=eq.${id.v}&receiver_id=eq.${id.b}`, {
  status: "withdrawn",
});
check(
  "V a aimé B puis l'a bloquée : il peut retirer son Like",
  r.status === 200 && row("v", "b") === "like/withdrawn",
  `HTTP ${r.status} · ${row("v", "b")}`,
);
r = await api("v", "PATCH", `likes?sender_id=eq.${id.v}&receiver_id=eq.${id.b}`, {
  status: "active",
});
check(
  "… mais pas le réactiver tant que le blocage existe",
  r.status === 403 && row("v", "b") === "like/withdrawn",
  `HTTP ${r.status}`,
);
r = await api("v", "PATCH", `likes?sender_id=eq.${id.v}&receiver_id=eq.${id.b}`, {
  kind: "pass",
  status: "active",
});
check("… ni le transformer en Pass", r.status === 403, `HTTP ${r.status}`);

// ---------- E. Page Découverte ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(t) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[t]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  return page;
}
const cards = async (p) =>
  (await p.locator("article h3").allTextContents())
    .map((t) => t.split(" ·")[0].replace("Bloc", "").trim())
    .sort()
    .join(",");
const toast = async (p) => {
  const list = p.locator("[data-sonner-toast]");
  for (let i = 0; i < 80 && (await list.count()) === 0; i++) await p.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await p.waitForTimeout(100);
  return t;
};
const pv = await login("v");
check(
  "Page de V : A et B (bloquées) absentes, C et D présentes",
  (await cards(pv)) === "c,d",
  await cards(pv),
);
const pa = await login("a");
check("Page de A : V (qui l'a bloquée) absent", (await cards(pa)) === "w", await cards(pa));

// Blocage pendant que la page est ouverte
await block("c", "v");
await pv
  .locator("article")
  .filter({ hasText: "Blocc " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
let t = await toast(pv);
check(
  "C bloque V pendant sa visite : Like refusé, « Ce profil n'est plus disponible. »",
  t === "Ce profil n'est plus disponible." && row("v", "c") === "aucun",
  t,
);
await pv.waitForTimeout(800);
check("… la carte de C disparaît", (await cards(pv)) === "d", await cards(pv));
await block("d", "v");
await pv
  .locator("article")
  .filter({ hasText: "Blocd " })
  .getByRole("button", { name: /^Passer le profil/ })
  .click();
t = await toast(pv);
check(
  "D bloque V pendant sa visite : Pass refusé, même message, rien d'enregistré",
  t === "Ce profil n'est plus disponible." && row("v", "d") === "aucun",
  t,
);
await pv.waitForTimeout(800);
check(
  "… plus aucune carte : message de liste vide",
  (await pv.locator("article").count()) === 0 &&
    (await pv.getByText("Aucun profil ne correspond").isVisible()),
);

// ---------- F. Déblocage ----------
await unblock("v", "a");
await unblock("c", "v");
check(
  "V débloque A, C débloque V : A et C de nouveau proposées à V",
  (await feed("v")) === "a,c",
  await feed("v"),
);
check("… et V de nouveau proposé à A", (await feed("a")) === "v,w");
await unblock("v", "b");
check(
  "B débloquée : de nouveau proposée (son Like avait été retiré)",
  (await feed("v")).includes("b"),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-bloc-%@example.test';");
check(
  "Nettoyage : comptes, blocages et Likes de test supprimés",
  sql("select count(*) from auth.users where email like 'test-bloc-%'") === "0" &&
    sql(
      `select count(*) from public.blocks where blocker_id in ('${id.v}','${id.c}','${id.d}')`,
    ) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
