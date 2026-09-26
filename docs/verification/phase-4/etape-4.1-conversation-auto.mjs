// YONA — Phase 4 / Étape 4.1 — Vérification : conversation créée automatiquement après un Match.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.1-conversation-auto.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
sql("delete from auth.users where email like 'test-conv-%@example.test';");
const stamp = Date.now();
const PWD = "TestConv!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-conv-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Convpaul"),
  a: mk("a", "female", "Convgrace"),
  b: mk("b", "female", "Convruth"),
  c: mk("c", "male", "Convtiers"),
  d: mk("d", "female", "Convmarie"),
  e: mk("e", "female", "Convsarah"),
  f: mk("f", "female", "Convanne"),
};
const pairs = [];
for (let i = 0; i < 10; i++)
  pairs.push([
    mk(`p${i}m`, "male", `Convm${i}`),
    mk(`p${i}f`, "female", `Convf${i}`),
    `p${i}m`,
    `p${i}f`,
  ]);
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
const h = (t) => ({
  apikey: KEY,
  authorization: `Bearer ${tok[t]}`,
  "content-type": "application/json",
  prefer: "return=representation",
});
const lo = (x, y) => `least('${x}'::uuid,'${y}'::uuid)`;
const hi = (x, y) => `greatest('${x}'::uuid,'${y}'::uuid)`;
const matchOf = (x, y) =>
  sql(
    `select coalesce((select id::text from public.matches where user_1_id=${lo(x, y)} and user_2_id=${hi(x, y)}),'aucun')`,
  );
const convOf = (x, y) =>
  sql(
    `select coalesce((select c.id||'|'||c.status||'|'||c.free_messages_used||'|'||coalesce(c.last_message_at::text,'∅')||'|'||(c.user_1_id=m.user_1_id and c.user_2_id=m.user_2_id)||'|'||(c.created_at > now() - interval '1 minute') from public.conversations c join public.matches m on m.id=c.match_id where m.user_1_id=${lo(x, y)} and m.user_2_id=${hi(x, y)}),'aucune')`,
  );
const convCount = (x, y) =>
  sql(
    `select count(*) from public.conversations where user_1_id=${lo(x, y)} and user_2_id=${hi(x, y)}`,
  );

// ---------- A. Création au Match (par la page) ----------
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.a}','${id.v}');`);
const browser = await chromium.launch();
const jsErrors = [];
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 8000 });
for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
  await page.waitForTimeout(100);
await page.waitForTimeout(600);
check("Avant le Match : aucune conversation", convOf(id.v, id.a) === "aucune");
await page
  .locator("article")
  .filter({ hasText: "Convgrace " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
await page.getByTestId("match-dialog").waitFor({ timeout: 5000 });
const conv = convOf(id.v, id.a);
check(
  "Match créé depuis la page : conversation créée automatiquement",
  conv !== "aucune" && matchOf(id.v, id.a) !== "aucun",
  conv,
);
check(
  "Conversation : ouverte, 0 message gratuit utilisé, aucun message encore",
  conv.split("|").slice(1, 4).join("|") === "open|0|∅",
  conv,
);
check(
  "Même couple que le Match, dans le même ordre ; datée de maintenant",
  conv.endsWith("|true|true"),
  conv,
);
await page.keyboard.press("Escape");
await page
  .locator("article")
  .filter({ hasText: "Convruth " })
  .getByRole("button", { name: /^Liker le profil/ })
  .click();
for (let i = 0; i < 30; i++) await page.waitForTimeout(100);
check(
  "Like sans retour (Ruth) : ni Match ni conversation",
  convOf(id.v, id.b) === "aucune" && matchOf(id.v, id.b) === "aucun",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- B. Accès et protections ----------
const convId = conv.split("|")[0];
const see = async (t) =>
  (
    await (
      await fetch(`${API}/rest/v1/conversations?select=id&id=eq.${convId}`, { headers: h(t) })
    ).json()
  ).length;
check(
  "Paul et Grace voient leur conversation ; un tiers non",
  (await see("v")) === 1 && (await see("a")) === 1 && (await see("c")) === 0,
);
const ins = await fetch(`${API}/rest/v1/conversations`, {
  method: "POST",
  headers: h("c"),
  body: JSON.stringify({
    match_id: matchOf(id.v, id.a),
    user_1_id: id.v < id.c ? id.v : id.c,
    user_2_id: id.v < id.c ? id.c : id.v,
  }),
});
const upd = await fetch(`${API}/rest/v1/conversations?id=eq.${convId}`, {
  method: "PATCH",
  headers: h("v"),
  body: JSON.stringify({ status: "closed", free_messages_used: 99 }),
});
const del = await fetch(`${API}/rest/v1/conversations?id=eq.${convId}`, {
  method: "DELETE",
  headers: h("v"),
});
check(
  "Un membre ne peut ni créer, ni modifier, ni supprimer une conversation (403)",
  ins.status === 403 && upd.status === 403 && del.status === 403 && convOf(id.v, id.a) === conv,
  `${ins.status}/${upd.status}/${del.status}`,
);

// ---------- C. Envois simultanés ----------
await Promise.all(
  pairs.flatMap(([m, f, tm, tf]) => [
    fetch(`${API}/rest/v1/likes`, {
      method: "POST",
      headers: h(tm),
      body: JSON.stringify({ sender_id: m, receiver_id: f }),
    }),
    fetch(`${API}/rest/v1/likes`, {
      method: "POST",
      headers: h(tf),
      body: JSON.stringify({ sender_id: f, receiver_id: m }),
    }),
  ]),
);
const ok10 = pairs.every(([m, f]) => convCount(m, f) === "1");
check("10 Matchs créés au même instant : 10 conversations, une par Match", ok10);

// ---------- D. Match défait puis réactivé, Match bloqué ----------
sql(`update public.matches set status='unmatched' where id='${matchOf(id.v, id.a)}';
     update public.conversations set status='closed' where id='${convId}';`);
sql(
  `update public.likes set status='withdrawn' where sender_id='${id.v}' and receiver_id='${id.a}';`,
);
sql(`update public.likes set status='active' where sender_id='${id.v}' and receiver_id='${id.a}';`);
const re = convOf(id.v, id.a);
check(
  "Match défait puis réactivé : même conversation rouverte (pas de nouvelle)",
  convCount(id.v, id.a) === "1" && re.startsWith(`${convId}|open|`),
  re,
);
sql(
  `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.d}'), ('${id.d}','${id.v}');`,
);
const convD = convOf(id.v, id.d).split("|")[0];
sql(`update public.conversations set status='locked' where id='${convD}';
     update public.matches set status='unmatched' where id='${matchOf(id.v, id.d)}';
     update public.matches set status='active' where id='${matchOf(id.v, id.d)}';`);
check(
  "Conversation « verrouillée » : non modifiée par une réactivation",
  convOf(id.v, id.d).startsWith(`${convD}|locked|`),
);
sql(`update public.matches set status='blocked' where id='${matchOf(id.v, id.d)}';`);
check("Match passé à « bloqué » : aucune nouvelle conversation", convCount(id.v, id.d) === "1");
sql(
  `insert into public.matches (user_1_id, user_2_id, status) values (${lo(id.v, id.e)}, ${hi(id.v, id.e)}, 'blocked');`,
);
check("Match créé directement « bloqué » : aucune conversation", convOf(id.v, id.e) === "aucune");

// ---------- E. Rattrapage des Matchs existants (migration rejouée) ----------
sql(`alter table public.matches disable trigger matches_create_conversation;
     insert into public.matches (user_1_id, user_2_id) values (${lo(id.v, id.f)}, ${hi(id.v, id.f)});
     alter table public.matches enable trigger matches_create_conversation;`);
check(
  "Match ancien (créé avant cette étape) : pas encore de conversation",
  convOf(id.v, id.f) === "aucune",
);
execFileSync(
  "docker",
  ["exec", "-i", DB, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
  {
    input: readFileSync(
      new URL(
        "../../../supabase/migrations/20260926220000_phase4_conversation_auto.sql",
        import.meta.url,
      ),
    ),
    stdio: ["pipe", "pipe", "pipe"],
  },
);
check(
  "Migration rejouée : la conversation manquante est créée, aucune en double",
  convCount(id.v, id.f) === "1" && convCount(id.v, id.a) === "1",
);
check(
  "Tous les Matchs actifs ont exactement une conversation",
  sql(
    "select count(*) from public.matches m where m.status='active' and (select count(*) from public.conversations c where c.match_id=m.id) <> 1",
  ) === "0",
);

// ---------- F. Suppression d'un compte ----------
sql(`delete from auth.users where id='${id.a}';`);
check(
  "Compte de Grace supprimé : Match et conversation supprimés",
  convOf(id.v, id.a) === "aucune" &&
    sql(`select count(*) from public.conversations where id='${convId}'`) === "0",
);

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-conv-%@example.test';");
check(
  "Nettoyage : comptes, Matchs et conversations de test supprimés",
  sql("select count(*) from auth.users where email like 'test-conv-%'") === "0" &&
    sql(`select count(*) from public.conversations where '${id.v}' in (user_1_id,user_2_id)`) ===
      "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
