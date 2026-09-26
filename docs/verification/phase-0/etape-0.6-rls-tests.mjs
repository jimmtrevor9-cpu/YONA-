// YONA — Phase 0 / Étape 0.6 — Tests des règles d'accès (RLS) via l'API réelle
// (PostgREST + Storage) d'un Supabase LOCAL, en se faisant passer pour plusieurs membres.
// Usage : node docs/verification/phase-0/etape-0.6-rls-tests.mjs
// Prérequis : `supabase start` + migrations appliquées ; conteneur supabase_db_yona-local.
// Crée des comptes de TEST (@example.test) puis les supprime à la fin.
import { execFileSync } from "node:child_process";

const U = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const K = process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync(
    "docker",
    ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
    {
      input: q,
    },
  )
    .toString()
    .trim();

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Préparation (en superutilisateur, hors API) ----------
const ids = {
  A: "a0000000-0000-4000-8000-00000000000a",
  B: "b0000000-0000-4000-8000-00000000000b",
  C: "c0000000-0000-4000-8000-00000000000c",
  D: "d0000000-0000-4000-8000-00000000000d",
  E: "e0000000-0000-4000-8000-00000000000e",
};
const MATCH = "f1000000-0000-4000-8000-000000000001";
const CONV = "f2000000-0000-4000-8000-000000000002";
const CONV_BC = "f2000000-0000-4000-8000-000000000003";
const PWD = "TestRls!2026";
sql(`delete from auth.users where email like 'test-rls-%@example.test';`);
if (sql("select count(*) from storage.objects where bucket_id='photos'") !== "0") {
  console.log("⚠️  Des fichiers de test d'une exécution précédente restent dans le bucket photos.");
}
sql(
  Object.entries(ids)
    .map(
      ([n, id]) =>
        `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000','${id}','authenticated','authenticated','test-rls-${n.toLowerCase()}@example.test',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Test${n}"}',now(),now(),'','','','');`,
    )
    .join("\n") +
    `
update public.profiles set status='active', visibility='visible' where user_id in ('${ids.A}','${ids.B}','${ids.C}');
insert into public.user_roles (user_id, role) values ('${ids.E}','admin');
insert into public.blocks (blocker_id, blocked_id) values ('${ids.C}','${ids.A}');
insert into public.likes (sender_id, receiver_id) values ('${ids.B}','${ids.A}'), ('${ids.A}','${ids.D}');
insert into public.matches (id,user_1_id,user_2_id) values ('${MATCH}','${ids.A}','${ids.B}'), ('f1000000-0000-4000-8000-000000000003','${ids.B}','${ids.C}');
insert into public.conversations (id,match_id,user_1_id,user_2_id) values ('${CONV}','${MATCH}','${ids.A}','${ids.B}'), ('${CONV_BC}','f1000000-0000-4000-8000-000000000003','${ids.B}','${ids.C}') on conflict (match_id) do update set id = excluded.id; -- depuis l'étape 4.1, la base crée déjà la conversation du Match
insert into public.messages (conversation_id,sender_id,content) values ('${CONV}','${ids.B}','Bonjour A'), ('${CONV_BC}','${ids.B}','Bonjour C');
insert into public.messages (conversation_id,sender_id,content,status) values ('${CONV}','${ids.B}','bloqué','blocked');
insert into public.payments (id,user_id,type,amount,provider,status) values ('f3000000-0000-4000-8000-000000000001','${ids.B}','subscription',500,'test','succeeded');
insert into public.subscriptions (user_id,status,starts_at,expires_at,payment_id) values ('${ids.B}','active',now()-interval '1 day',now()+interval '29 days','f3000000-0000-4000-8000-000000000001');
insert into public.conversation_unlocks (conversation_id,paid_by_user_id,status,starts_at,expires_at) values ('${CONV_BC}','${ids.B}','active',now(),now()+interval '3 days');
insert into public.favorites (user_id, favorite_user_id) values ('${ids.B}','${ids.A}');
insert into public.profile_visits (visitor_id, visited_user_id) values ('${ids.B}','${ids.A}');
insert into public.reports (reporter_id, reported_user_id, reason) values ('${ids.B}','${ids.C}','other');
`,
);

// ---------- Outils API ----------
async function token(n) {
  const r = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: K, "content-type": "application/json" },
    body: JSON.stringify({ email: `test-rls-${n.toLowerCase()}@example.test`, password: PWD }),
  });
  return (await r.json()).access_token;
}
const tok = {};
for (const n of Object.keys(ids)) tok[n] = await token(n);

async function api(who, method, path, body, extra = {}) {
  const headers = {
    apikey: K,
    "content-type": "application/json",
    prefer: "return=representation",
    ...extra,
  };
  if (who) headers.authorization = `Bearer ${tok[who]}`;
  const r = await fetch(`${U}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json, rows: Array.isArray(json) ? json : [] };
}
const denied = (r) => r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0);
const rpc = (who, fn, args) => api(who, "POST", `rpc/${fn}`, args);
const TABLES = sql(
  "select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname='public'",
).split(",");

// ---------- 1. Visiteur anonyme ----------
let anonLeaks = [];
for (const t of TABLES) {
  const r = await api(null, "GET", `${t}?select=*&limit=5`);
  if (r.rows.length) anonLeaks.push(t);
}
check(
  "Anonyme : aucune ligne lisible dans les 21 tables",
  anonLeaks.length === 0,
  anonLeaks.join(","),
);
const anonIns = await api(null, "POST", "likes", { sender_id: ids.A, receiver_id: ids.B });
check("Anonyme : écriture refusée", anonIns.status >= 400, `HTTP ${anonIns.status}`);
const anonRpc = await rpc(null, "is_premium", { _user_id: ids.B });
check("Anonyme : fonctions internes refusées", anonRpc.status >= 400, `HTTP ${anonRpc.status}`);

// ---------- 2. Lecture : chacun ne voit que ce qu'il doit voir ----------
const users = await api("A", "GET", "users?select=id");
check(
  "Membre A : table users = uniquement lui-même",
  users.rows.length === 1 && users.rows[0].id === ids.A,
);
const profs = (await api("A", "GET", "profiles?select=user_id")).rows.map((r) => r.user_id).sort();
check(
  "Membre A : profils visibles = lui + B (C l'a bloqué, D incomplet, E incomplet)",
  JSON.stringify(profs) === JSON.stringify([ids.A, ids.B].sort()),
  `${profs.length} profil(s)`,
);
const cp = (await api("A", "GET", "christian_profiles?select=user_id")).rows.length;
check("Membre A : profils chrétiens visibles = 2 (même règle)", cp === 2, `${cp}`);
const prefs = (await api("A", "GET", "preferences?select=user_id")).rows;
check(
  "Membre A : préférences = uniquement les siennes",
  prefs.length === 1 && prefs[0].user_id === ids.A,
);
const likesA = (await api("A", "GET", "likes?select=sender_id,receiver_id")).rows;
check(
  "Membre A : ne voit pas les Likes reçus (B → A)",
  likesA.every((l) => l.sender_id === ids.A),
  `${likesA.length} Like(s) visibles`,
);
const blocksA = (await api("A", "GET", "blocks?select=*")).rows.length;
check("Membre A : ne voit pas qui l'a bloqué", blocksA === 0);
const convC = (await api("C", "GET", `conversations?id=eq.${CONV}`)).rows.length;
const msgC = (await api("C", "GET", `messages?conversation_id=eq.${CONV}`)).rows.length;
check("Membre C : n'accède pas à la conversation A–B ni à ses messages", convC === 0 && msgC === 0);
const msgA = (await api("A", "GET", `messages?conversation_id=eq.${CONV}&select=content`)).rows;
check(
  "Membre A : voit les messages livrés de sa conversation, pas les messages bloqués de B",
  msgA.length === 1 && msgA[0].content === "Bonjour A",
  `${msgA.length}`,
);
for (const t of [
  "payments",
  "subscriptions",
  "conversation_unlocks",
  "favorites",
  "profile_visits",
  "reports",
  "user_activity",
  "ai_usage",
  "conversation_user_usage",
  "user_roles",
  "moderation_actions",
]) {
  const r = await api("A", "GET", `${t}?select=*`);
  const foreign = r.rows.filter(
    (row) =>
      Object.values(row).includes(ids.B) ||
      Object.values(row).includes(ids.C) ||
      Object.values(row).includes(ids.E),
  );
  check(
    `Membre A : aucune donnée d'un autre membre dans ${t}`,
    foreign.length === 0,
    `${foreign.length}`,
  );
}

// ---------- 3. Écritures interdites ----------
const forged = [
  ["Like au nom d'un autre membre", "likes", { sender_id: ids.B, receiver_id: ids.D }],
  ["Like de son propre profil", "likes", { sender_id: ids.A, receiver_id: ids.A }],
  ["Like d'un membre qui l'a bloqué", "likes", { sender_id: ids.A, receiver_id: ids.C }],
  ["Créer un Match soi-même", "matches", { user_1_id: ids.A, user_2_id: ids.D }],
  [
    "Créer une conversation soi-même",
    "conversations",
    { match_id: MATCH, user_1_id: ids.A, user_2_id: ids.B },
  ],
  [
    "Écrire un message directement (sans contrôle serveur)",
    "messages",
    { conversation_id: CONV, sender_id: ids.A, content: "0612345678" },
  ],
  [
    "S'offrir un abonnement Premium",
    "subscriptions",
    {
      user_id: ids.A,
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: "2099-01-01T00:00:00Z",
    },
  ],
  [
    "Déclarer un paiement réussi",
    "payments",
    { user_id: ids.A, type: "subscription", amount: 500, provider: "x", status: "succeeded" },
  ],
  [
    "S'offrir un déblocage de conversation",
    "conversation_unlocks",
    { conversation_id: CONV, paid_by_user_id: ids.A, status: "active" },
  ],
  ["Se donner le rôle admin", "user_roles", { user_id: ids.A, role: "admin" }],
  [
    "Créer une action de modération",
    "moderation_actions",
    { admin_id: ids.A, target_user_id: ids.B, action: "suspend" },
  ],
  [
    "Enregistrer une visite directement",
    "profile_visits",
    { visitor_id: ids.A, visited_user_id: ids.B },
  ],
  ["S'ajouter des questions IA", "ai_usage", { user_id: ids.A, usage_count: 0 }],
  [
    "Remettre son quota de messages à zéro",
    "conversation_user_usage",
    { conversation_id: CONV, user_id: ids.A },
  ],
  [
    "Signaler au nom d'un autre",
    "reports",
    { reporter_id: ids.B, reported_user_id: ids.D, reason: "other" },
  ],
  ["Favori au nom d'un autre", "favorites", { user_id: ids.B, favorite_user_id: ids.D }],
  ["Favori d'un membre qui l'a bloqué", "favorites", { user_id: ids.A, favorite_user_id: ids.C }],
  ["Bloquer au nom d'un autre", "blocks", { blocker_id: ids.B, blocked_id: ids.D }],
  ["Créer un profil pour un autre", "profiles", { user_id: ids.D }],
];
for (const [label, t, body] of forged) {
  const r = await api("A", "POST", t, body);
  check(`Refusé : ${label}`, r.status >= 400, `HTTP ${r.status}`);
}

const updates = [
  ["Modifier le profil de B", "PATCH", `profiles?user_id=eq.${ids.B}`, { bio: "piraté" }],
  ["Modifier les préférences de B", "PATCH", `preferences?user_id=eq.${ids.B}`, { min_age: 99 }],
  [
    "Modifier le compte de B",
    "PATCH",
    `users?id=eq.${ids.B}`,
    { last_active_at: new Date().toISOString() },
  ],
  ["Supprimer le profil de B", "DELETE", `profiles?user_id=eq.${ids.B}`],
  ["Supprimer sa propre fiche users", "DELETE", `users?id=eq.${ids.A}`],
  ["Supprimer le Like de B", "DELETE", `likes?sender_id=eq.${ids.B}`],
  [
    "Changer la date d'expiration de l'abonnement de B",
    "PATCH",
    `subscriptions?user_id=eq.${ids.B}`,
    { expires_at: "2099-01-01T00:00:00Z" },
  ],
  [
    "Modifier le statut d'un signalement",
    "PATCH",
    `reports?reporter_id=eq.${ids.B}`,
    { status: "dismissed" },
  ],
];
for (const [label, method, path, body] of updates) {
  const r = await api("A", method, path, body);
  check(`Sans effet : ${label}`, denied(r), `HTTP ${r.status}, ${r.rows.length} ligne(s)`);
}
const stillPremium = sql(
  `select expires_at < '2090-01-01' from public.subscriptions where user_id='${ids.B}'`,
);
check("Abonnement de B intact", stillPremium === "t");

// Colonnes protégées sur ses propres lignes
await api("A", "PATCH", `users?id=eq.${ids.A}`, { status: "active", email: "vole@example.test" });
check(
  "Membre A ne peut pas changer son email/statut de compte",
  sql(`select email from public.users where id='${ids.A}'`) === "test-rls-a@example.test",
);
await api("A", "POST", "photos", {
  user_id: ids.A,
  storage_path: `${ids.A}/1.jpg`,
  status: "approved",
});
check(
  "Photo ajoutée par le membre forcée « en attente » (pas d'auto-approbation)",
  sql(`select status from public.photos where user_id='${ids.A}'`) === "pending",
);

// ---------- 4. Failles potentielles à surveiller ----------
const likeRow = sql(
  `select id from public.likes where sender_id='${ids.A}' and receiver_id='${ids.D}'`,
);
const hijack = await api("A", "PATCH", `likes?id=eq.${likeRow}`, { receiver_id: ids.C });
check(
  "Refusé : détourner un Like existant vers un membre qui l'a bloqué",
  denied(hijack),
  `HTTP ${hijack.status}`,
);
const hijack2 = await api("A", "PATCH", `likes?id=eq.${likeRow}`, { sender_id: ids.B });
check("Refusé : réattribuer son Like à un autre membre", denied(hijack2), `HTTP ${hijack2.status}`);
const badPhoto = await api("A", "POST", "photos", {
  user_id: ids.A,
  storage_path: `${ids.B}/1.jpg`,
});
check(
  "Refusé : déclarer une photo pointant vers le dossier d'un autre membre",
  badPhoto.status >= 400,
  `HTTP ${badPhoto.status}`,
);
const spoof = await api("A", "PATCH", `user_activity?user_id=eq.${ids.A}`, {
  last_seen_at: "2099-01-01T00:00:00Z",
  is_online: true,
});
check(
  "Refusé : falsifier sa présence « en ligne » directement",
  denied(spoof),
  `HTTP ${spoof.status}`,
);
const leak1 = await rpc("A", "is_blocked_between", { _a: ids.B, _b: ids.C });
check(
  "Refusé : savoir si deux AUTRES membres se sont bloqués",
  leak1.status >= 400 || leak1.json === false,
  `réponse ${JSON.stringify(leak1.json)}`,
);
const leakCheck = sql(
  `insert into public.blocks (blocker_id, blocked_id) values ('${ids.B}','${ids.D}'); select 'ok'`,
);
const leak1b = await rpc("A", "is_blocked_between", { _a: ids.B, _b: ids.D });
check(
  "… même quand ils se sont réellement bloqués",
  leak1b.status >= 400 || leak1b.json === false,
  `réponse ${JSON.stringify(leak1b.json)} (${leakCheck})`,
);
const leak2 = await rpc("A", "has_role", { _user_id: ids.E, _role: "admin" });
check(
  "Refusé : découvrir qui est administrateur",
  leak2.status >= 400 || leak2.json === false,
  `réponse ${JSON.stringify(leak2.json)}`,
);
const leak3 = await rpc("A", "has_active_conversation_unlock", { _conversation_id: CONV_BC });
check(
  "Refusé : consulter le déblocage d'une conversation des autres",
  leak3.status >= 400 || leak3.json === false,
  `réponse ${JSON.stringify(leak3.json)}`,
);
const own = await rpc("A", "is_blocked_between", { _a: ids.A, _b: ids.C });
check(
  "Autorisé : savoir si soi-même est bloqué avec quelqu'un",
  own.json === true,
  `réponse ${JSON.stringify(own.json)}`,
);
const ownRole = await rpc("E", "has_role", { _user_id: ids.E, _role: "admin" });
check("Autorisé : l'admin connaît son propre rôle", ownRole.json === true);

// ---------- 5. Stockage des photos ----------
const up = async (who, path) =>
  (
    await fetch(`${U}/storage/v1/object/photos/${path}`, {
      method: "POST",
      headers: { apikey: K, authorization: `Bearer ${tok[who]}`, "content-type": "image/jpeg" },
      body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
    })
  ).status;
const down = async (who, path) =>
  (
    await fetch(`${U}/storage/v1/object/authenticated/photos/${path}`, {
      headers: { apikey: K, authorization: `Bearer ${tok[who]}` },
    })
  ).status;
check("Stockage : B envoie une photo dans son dossier", (await up("B", `${ids.B}/1.jpg`)) === 200);
check("Stockage : C envoie une photo dans son dossier", (await up("C", `${ids.C}/1.jpg`)) === 200);
check(
  "Stockage : A ne peut pas écrire dans le dossier de B",
  (await up("A", `${ids.B}/pirate.jpg`)) >= 400,
);
sql(
  `insert into public.photos (user_id, storage_path, status) values ('${ids.B}','${ids.B}/1.jpg','approved'), ('${ids.C}','${ids.C}/1.jpg','pending');`,
);
check("Stockage : A voit la photo approuvée de B", (await down("A", `${ids.B}/1.jpg`)) === 200);
check(
  "Stockage : D ne voit pas la photo en attente de C",
  (await down("D", `${ids.C}/1.jpg`)) >= 400,
);
check(
  "Stockage : A ne voit pas la photo de C (C l'a bloqué)",
  (await down("A", `${ids.C}/1.jpg`)) >= 400,
);
check(
  "Stockage : anonyme ne voit aucune photo",
  (await fetch(`${U}/storage/v1/object/public/photos/${ids.B}/1.jpg`)).status >= 400,
);

// ---------- 6. Administrateur ----------
const adminUsers = (await api("E", "GET", "users?select=id")).rows.length;
check("Admin E : voit tous les comptes", adminUsers === 5, `${adminUsers}`);
const adminMod = await api("E", "POST", "moderation_actions", {
  admin_id: ids.E,
  target_user_id: ids.C,
  action: "note",
});
check(
  "Admin E : peut enregistrer une action de modération",
  adminMod.status === 201,
  `HTTP ${adminMod.status}`,
);
const adminSelfPromote = await api("E", "POST", "user_roles", { user_id: ids.A, role: "admin" });
check(
  "Admin E : ne peut pas attribuer de rôle via l'API (serveur uniquement)",
  adminSelfPromote.status >= 400,
  `HTTP ${adminSelfPromote.status}`,
);

// ---------- Nettoyage ----------
for (const [who, path] of [
  ["B", `${ids.B}/1.jpg`],
  ["C", `${ids.C}/1.jpg`],
]) {
  await fetch(`${U}/storage/v1/object/photos/${path}`, {
    method: "DELETE",
    headers: { apikey: K, authorization: `Bearer ${tok[who]}` },
  });
}
sql(`delete from auth.users where email like 'test-rls-%@example.test';`);
check("Nettoyage : comptes de test supprimés", sql("select count(*) from public.users") === "0");

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} tests réussis`);
process.exit(failed.length ? 1 : 0);
