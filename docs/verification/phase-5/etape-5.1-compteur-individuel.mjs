// YONA — Phase 5 / Étape 5.1 — Vérification de l'initialisation du compteur individuel.
// Usage : node docs/verification/phase-5/etape-5.1-compteur-individuel.mjs
import { execFileSync } from "node:child_process";

const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
// Erreur renvoyée par la base (texte), ou "" si la requête a réussi.
const sqlError = (q) => {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
      {
        input: q,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return "";
  } catch (e) {
    return String(e.stderr ?? e);
  }
};
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-q51-%@example.test';");
const stamp = Date.now();
const PWD = "TestQ51!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-q51-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Qpaul"),
  a: mk("a", "female", "Qgrace"),
  c: mk("c", "male", "Qtiers"),
};
const conv = (x, y) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const usage = (c) =>
  sql(
    `select string_agg(user_id::text || ':' || free_messages_used, ',' order by user_id) from public.conversation_user_usage where conversation_id='${c}'`,
  );
const tokenOf = async (tag) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: emails[tag], password: PWD }),
      })
    ).json()
  ).access_token;
const api = async (tag, path, method = "GET", body) => {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tag ? await tokenOf(tag) : KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
};

// A. Création au Match
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id.a}');`);
check("Like sans retour : pas de conversation, pas de compteur", conv("v", "a") === "");
sql(`insert into public.likes (sender_id, receiver_id) values ('${id.a}','${id.v}');`);
const c = conv("v", "a");
const expected = [id.v, id.a]
  .sort()
  .map((u) => `${u}:0`)
  .join(",");
check(
  "Match : conversation créée avec 2 compteurs à 0 (un par participant)",
  usage(c) === expected,
  usage(c),
);
check(
  "Aucun compteur pour une personne extérieure",
  sql(`select count(*) from public.conversation_user_usage where user_id='${id.c}'`) === "0",
);
check(
  "Toute conversation a exactement ses 2 compteurs",
  sql(
    `select count(*) from public.conversations c where (select count(*) from public.conversation_user_usage u where u.conversation_id=c.id and u.user_id in (c.user_1_id,c.user_2_id)) <> 2`,
  ) === "0",
);

// B. Lecture
let r = await api(
  "v",
  `conversation_user_usage?select=user_id,free_messages_used&conversation_id=eq.${c}`,
);
check(
  "Paul lit son propre compteur seulement (pas celui de Grace)",
  Array.isArray(r.json) &&
    r.json.length === 1 &&
    r.json[0].user_id === id.v &&
    r.json[0].free_messages_used === 0,
  r.text,
);
r = await api("c", `conversation_user_usage?select=user_id&conversation_id=eq.${c}`);
check(
  "Une personne extérieure ne lit aucun compteur",
  Array.isArray(r.json) && r.json.length === 0,
);
r = await api(null, `conversation_user_usage?select=user_id&conversation_id=eq.${c}`);
check("Sans connexion : aucun compteur lisible", !Array.isArray(r.json) || r.json.length === 0);

// C. Aucune modification par un membre
r = await api("v", `conversation_user_usage?conversation_id=eq.${c}&user_id=eq.${id.v}`, "PATCH", {
  free_messages_used: 0,
});
const r2 = await api(
  "v",
  `conversation_user_usage?conversation_id=eq.${c}&user_id=eq.${id.v}`,
  "DELETE",
);
const r3 = await api("c", "conversation_user_usage", "POST", {
  conversation_id: c,
  user_id: id.c,
  free_messages_used: 0,
});
check(
  "Modifier, supprimer ou créer un compteur directement : refusé",
  [r, r2, r3].every((x) => [401, 403].includes(x.status)) && usage(c) === expected,
  `${r.status}/${r2.status}/${r3.status}`,
);
r = await api("v", "rpc/consume_free_message", "POST", { _conversation_id: c });
check(
  "Ancienne fonction qui augmentait le compteur sans message : inaccessible",
  [401, 403, 404].includes(r.status) && usage(c) === expected,
  String(r.status),
);

// D. Conservation
sql(
  `update public.conversation_user_usage set free_messages_used=2 where conversation_id='${c}' and user_id='${id.v}';`,
);
sql(`update public.matches set status='unmatched' where id=(select match_id from public.conversations where id='${c}');
     update public.conversations set status='closed' where id='${c}';`);
sql(
  `update public.matches set status='active' where id=(select match_id from public.conversations where id='${c}');`,
);
check(
  "Match défait puis refait : même conversation, compteurs conservés (pas de remise à zéro)",
  conv("v", "a") === c &&
    sql(`select status from public.conversations where id='${c}'`) === "open" &&
    sql(
      `select free_messages_used from public.conversation_user_usage where conversation_id='${c}' and user_id='${id.v}'`,
    ) === "2" &&
    sql(`select count(*) from public.conversation_user_usage where conversation_id='${c}'`) === "2",
);
const bad = sqlError(
  `update public.conversation_user_usage set free_messages_used=4 where conversation_id='${c}' and user_id='${id.v}';`,
);
check("Compteur limité à 0–3 par la base", bad.includes("conversation_user_usage_range"));
const dup = sqlError(
  `insert into public.conversation_user_usage (conversation_id, user_id) values ('${c}','${id.v}');`,
);
check("Un seul compteur par personne et par conversation", dup.includes("duplicate key"));

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-q51-%@example.test';");
check(
  "Nettoyage : comptes, conversation et compteurs supprimés",
  sql("select count(*) from auth.users where email like 'test-q51-%'") === "0" &&
    sql(`select count(*) from public.conversation_user_usage where conversation_id='${c}'`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
