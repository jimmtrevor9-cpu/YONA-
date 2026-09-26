// YONA — Phase 3 / Étape 3.3 — Vérification : un seul Match par couple (base + serveur).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-3/etape-3.3-matchs-doublons.mjs
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
const sqlStatus = (q) => {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
      {
        input: q,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return "accepté";
  } catch (e) {
    const m = String(e.stderr ?? e).match(/constraint "([^"]+)"/);
    return m ? `refusé (${m[1]})` : "refusé";
  }
};
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-mdoublon-%@example.test';");
const stamp = Date.now();
const PWD = "TestMdoublon!2026";
const emails = {};
const mk = (tag, gender) => {
  const e = `test-mdoublon-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Mdoub${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1990-05-05' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = { v: mk("v", "male") };
for (const t of ["a", "b", "c", "d", "e"]) id[t] = mk(t, "female");
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
const h = (t) => ({
  apikey: KEY,
  authorization: `Bearer ${tok[t]}`,
  "content-type": "application/json",
});
const like = (s, r) =>
  fetch(`${API}/rest/v1/likes`, {
    method: "POST",
    headers: h(s),
    body: JSON.stringify({ sender_id: id[s], receiver_id: id[r] }),
  }).then((x) => x.status);
const setLike = (s, r, body) =>
  fetch(`${API}/rest/v1/likes?sender_id=eq.${id[s]}&receiver_id=eq.${id[r]}`, {
    method: "PATCH",
    headers: h(s),
    body: JSON.stringify(body),
  }).then((x) => x.status);
const pair = (x, y) =>
  `least('${id[x]}'::uuid,'${id[y]}'::uuid) = user_1_id and greatest('${id[x]}'::uuid,'${id[y]}'::uuid) = user_2_id`;
const count = (x, y) =>
  sql(
    `select count(*) from public.matches where least(user_1_id,user_2_id)=least('${id[x]}'::uuid,'${id[y]}'::uuid) and greatest(user_1_id,user_2_id)=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const info = (x, y) =>
  sql(`select id||'|'||status||'|'||created_at from public.matches where ${pair(x, y)}`);

// ---------- A. Répétitions de Likes ----------
await like("v", "a");
await like("a", "v");
const first = info("v", "a");
check("Match V–A créé", count("v", "a") === "1", first);
const again = await like("v", "a");
check(
  "Like renvoyé (doublon) : refusé, toujours 1 Match inchangé",
  again === 409 && count("v", "a") === "1" && info("v", "a") === first,
  `HTTP ${again}`,
);
await setLike("v", "a", { status: "withdrawn" });
await setLike("v", "a", { status: "active" });
check(
  "V retire puis remet son Like : toujours 1 Match, même identifiant et même date",
  count("v", "a") === "1" && info("v", "a") === first,
);
await setLike("v", "a", { status: "withdrawn" });
await setLike("a", "v", { status: "withdrawn" });
await setLike("a", "v", { status: "active" });
await setLike("v", "a", { status: "active" });
check(
  "Les deux retirent puis remettent leur Like : toujours 1 Match",
  count("v", "a") === "1" && info("v", "a") === first,
);
await setLike("v", "a", { kind: "pass" });
await setLike("v", "a", { kind: "like" });
check(
  "V passe puis réaime : toujours 1 Match",
  count("v", "a") === "1" && info("v", "a") === first,
);

// ---------- B. Garde-fous de la base (même avec les droits du serveur) ----------
const [lo, hi] = id.v < id.a ? [id.v, id.a] : [id.a, id.v];
let s = sqlStatus(`insert into public.matches (user_1_id, user_2_id) values ('${lo}','${hi}');`);
check(
  "Base : 2e Match pour la même paire refusé",
  s === "refusé (matches_user_1_id_user_2_id_key)",
  s,
);
s = sqlStatus(`insert into public.matches (user_1_id, user_2_id) values ('${hi}','${lo}');`);
check(
  "Base : même paire dans l'autre ordre (B, A) refusée",
  s === "refusé (matches_ordered_pair)",
  s,
);
s = sqlStatus(`insert into public.matches (user_1_id, user_2_id) values ('${lo}','${lo}');`);
check("Base : Match avec soi-même refusé", s.startsWith("refusé"), s);

// ---------- C. Match défait ou bloqué ----------
sql(`update public.matches set status='unmatched' where ${pair("v", "a")};`);
await setLike("v", "a", { status: "withdrawn" });
await setLike("v", "a", { status: "active" });
const reac = info("v", "a");
check(
  "Match défait (« unmatched ») puis Likes réciproques : le MÊME Match est réactivé",
  count("v", "a") === "1" &&
    reac.split("|")[0] === first.split("|")[0] &&
    reac.split("|")[1] === "active",
  reac,
);
await like("v", "b");
await like("b", "v");
sql(`update public.matches set status='blocked' where ${pair("v", "b")};`);
await setLike("v", "b", { status: "withdrawn" });
await setLike("v", "b", { status: "active" });
check(
  "Match « bloqué » : jamais réactivé automatiquement, toujours 1 ligne",
  count("v", "b") === "1" && info("v", "b").split("|")[1] === "blocked",
);

// ---------- D. Opérations simultanées ----------
await like("v", "c");
await like("c", "v");
const ops = [];
for (let i = 0; i < 10; i++) {
  ops.push(setLike("v", "c", { status: i % 2 ? "active" : "withdrawn" }));
  ops.push(setLike("c", "v", { status: i % 2 ? "withdrawn" : "active" }));
}
await Promise.all(ops);
await setLike("v", "c", { status: "active" });
await setLike("c", "v", { status: "active" });
check(
  "20 retraits / remises simultanés des deux côtés : toujours 1 Match V–C",
  count("v", "c") === "1",
);
await Promise.all([like("v", "d"), like("d", "v"), like("v", "d"), like("d", "v")]);
check("Likes croisés simultanés en double : 1 seul Match V–D", count("v", "d") === "1");

// ---------- E. Fonction serveur (appel rejoué) ----------
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
let captured = null;
page.on("request", (q) => {
  if (q.url().includes("/_serverFn/") && q.method() === "POST" && !captured)
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.waitForTimeout(600);
await like("e", "v");
await page
  .locator("article")
  .filter({ hasText: "Mdoube " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
for (let i = 0; i < 60 && count("v", "e") === "0"; i++) await page.waitForTimeout(100);
const me = info("v", "e").split("|")[0];
const replies = await Promise.all(
  Array.from({ length: 5 }, () =>
    fetch(captured.url, {
      method: "POST",
      headers: Object.fromEntries(
        Object.entries(captured.headers).filter(
          ([k]) => !["host", "content-length", "connection"].includes(k),
        ),
      ),
      body: captured.body,
    }).then((x) => x.text()),
  ),
);
check(
  "Like rejoué 5 fois en parallèle après le Match : même identifiant de Match renvoyé, 1 seul Match",
  count("v", "e") === "1" && replies.every((t) => t.includes(`"s":"${me}"`)),
  me,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- F. Vérification globale ----------
check(
  "Aucune paire en double dans toute la table matches",
  sql(
    "select count(*) from (select least(user_1_id,user_2_id), greatest(user_1_id,user_2_id) from public.matches group by 1,2 having count(*)>1) x",
  ) === "0",
);

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-mdoublon-%@example.test';");
check(
  "Nettoyage : comptes, Likes et Matchs de test supprimés",
  sql("select count(*) from auth.users where email like 'test-mdoublon-%'") === "0" &&
    sql(`select count(*) from public.matches where '${id.v}' in (user_1_id,user_2_id)`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
