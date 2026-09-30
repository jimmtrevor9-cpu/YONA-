// YONA — Phase 3 / Étape 3.1 — Vérification : détection d'un Like réciproque (base + serveur).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.1-like-reciproque.mjs
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
sql("delete from auth.users where email like 'test-recip-%@example.test';");
const stamp = Date.now();
const PWD = "TestRecip!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-recip-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Recip${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = { v: mk("v", "male"), c: mk("c", "male") };
for (const t of ["a", "b", "d", "e", "f"]) id[t] = mk(t, "female");
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
const headers = (t) => ({
  apikey: KEY,
  ...(t ? { authorization: `Bearer ${tok[t]}` } : {}),
  "content-type": "application/json",
});
const mutual = async (t, other) => {
  const r = await fetch(`${API}/rest/v1/rpc/has_mutual_like`, {
    method: "POST",
    headers: headers(t),
    body: JSON.stringify({ _other: other }),
  });
  return r.status === 200 ? String(await r.json()) : `HTTP ${r.status}`;
};
const like = (s, r, kind = "like") =>
  fetch(`${API}/rest/v1/likes`, {
    method: "POST",
    headers: headers(s),
    body: JSON.stringify({ sender_id: id[s], receiver_id: id[r], kind }),
  }).then((x) => x.status);

// ---------- A. Base : cas nominal ----------
check("Personne n'a aimé : pas réciproque", (await mutual("v", id.a)) === "false");
await like("v", "a");
check("V aime A (A n'a pas aimé V) : pas réciproque", (await mutual("v", id.a)) === "false");
await like("a", "v");
check("A aime V en retour : réciproque, vu par V", (await mutual("v", id.a)) === "true");
check("… et vu par A", (await mutual("a", id.v)) === "true");

// ---------- B. Confidentialité ----------
await like("b", "v");
check(
  "B a aimé V, mais V n'a pas aimé B : V ne peut pas le deviner (réponse « faux »)",
  (await mutual("v", id.b)) === "false",
);
check(
  "Un tiers (C) ne peut pas savoir si V et A se sont aimés",
  (await mutual("c", id.a)) === "false" && (await mutual("c", id.v)) === "false",
);
check("Visiteur non connecté : refusé", (await mutual(null, id.a)).startsWith("HTTP 401"));
check("Soi-même : « faux »", (await mutual("v", id.v)) === "false");

// ---------- C. Ce qui n'est pas un Like réciproque ----------
await like("d", "v", "pass");
await like("v", "d");
check(
  "D a passé V, V aime D : pas réciproque (un Pass n'est pas un Like)",
  (await mutual("v", id.d)) === "false",
);
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.e}'), ('${id.e}','${id.v}');`,
);
check("V et E s'aiment : réciproque", (await mutual("v", id.e)) === "true");
sql(
  `update public.likes set status='withdrawn' where sender_id='${id.e}' and receiver_id='${id.v}';`,
);
check("E retire son Like : plus réciproque", (await mutual("v", id.e)) === "false");
sql(`update public.likes set status='active' where sender_id='${id.e}' and receiver_id='${id.v}';
     insert into public.blocks (blocker_id, blocked_id) values ('${id.e}','${id.v}');`);
check(
  "E bloque V (Likes toujours actifs) : pas réciproque",
  (await mutual("v", id.e)) === "false" && (await mutual("e", id.v)) === "false",
);

// ---------- D. Fonction serveur (Like depuis la page) ----------
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
const responses = [];
page.on("response", async (r) => {
  if (r.url().includes("/_serverFn/")) responses.push(await r.text());
});
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.waitForTimeout(600);
// Réponse sérialisée (seroval) : true = {"t":2,"s":2}, false = {"t":2,"s":3}
const flag = (text, key) => {
  const m = text.match(/"k":\[([^\]]*)\],"v":\[((?:\{"t":\d+,"s":(?:"[^"]*"|\d+)\},?)+)\]/);
  if (!m) return "?";
  const keys = m[1].split(",").map((k) => k.replace(/"/g, ""));
  const values = [...m[2].matchAll(/\{"t":\d+,"s":(?:"[^"]*"|\d+)\}/g)].map((x) => x[0]);
  const v = values[keys.indexOf(key)];
  return v === '{"t":2,"s":2}' ? "true" : v === '{"t":2,"s":3}' ? "false" : "?";
};
const clickLike = async (t) => {
  responses.length = 0;
  await page
    .locator("article")
    .filter({ hasText: `Recip${t} ` })
    .getByRole("button", { name: /^Liker le profil/ })
    .click();
  for (let i = 0; i < 60 && responses.length === 0; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(300);
  return responses[0] ?? "";
};
let res = await clickLike("b");
check(
  "Page : V aime B (qui l'avait aimé) → le serveur répond « réciproque »",
  flag(res, "mutual") === "true",
  `mutual=${flag(res, "mutual")}`,
);
check("… et la base confirme", (await mutual("v", id.b)) === "true");
// Depuis l'étape 3.4, un Like réciproque ouvre la fenêtre « Match » : on la ferme.
for (let i = 0; i < 40 && !(await page.getByTestId("match-dialog").isVisible()); i++)
  await page.waitForTimeout(100);
await page.keyboard.press("Escape");
await page.getByTestId("match-dialog").waitFor({ state: "hidden", timeout: 5000 });
res = await clickLike("f");
check(
  "Page : V aime F (qui ne l'a pas aimé) → « pas réciproque »",
  flag(res, "mutual") === "false",
  `mutual=${flag(res, "mutual")}`,
);
await like("f", "v");
check(
  "F aime V ensuite : réciproque (détecté aussi dans ce sens)",
  (await mutual("f", id.v)) === "true",
);

// ---------- E. Portée ----------
check(
  "Depuis l'étape 3.2 : un Match existe pour chaque paire réciproque (A, B, E, F), aucun avec D",
  sql(`select count(*) from public.matches where '${id.v}' in (user_1_id, user_2_id)`) === "4" &&
    sql(`select count(*) from public.matches where '${id.d}' in (user_1_id, user_2_id)`) === "0",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-recip-%@example.test';");
check(
  "Nettoyage : comptes, Likes et blocages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-recip-%'") === "0" &&
    sql(`select count(*) from public.likes where sender_id='${id.v}' or receiver_id='${id.v}'`) ===
      "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
