// YONA — Phase 24 — Audit de sécurité final (24.1 à 24.13).
// Deux parties : (1) audit de la structure de la base (RLS, droits, SECURITY DEFINER,
// stockage) ; (2) tentatives d'attaque réelles avec un compte membre par l'API publique.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… node docs/verification/phase-24/etapes-24.1-a-24.13-audit-securite.mjs
import {
  API,
  KEY,
  createAccounts,
  createChecker,
  match,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const list = (q) => sql(q).split("\n").filter(Boolean);

// ---------- 1. Audit de structure (24.12 et base de tout le reste) ----------
const noRls = list(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and relkind='r' and not relrowsecurity`);
check("RLS active sur toutes les tables", noRls.length === 0, noRls.join(", "));
const noPath = list(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and prosecdef and not exists
  (select 1 from unnest(coalesce(proconfig,'{}')) c where c like 'search_path=%')`);
check(
  "24.12 : chaque SECURITY DEFINER a un search_path fixe",
  noPath.length === 0,
  noPath.join(", "),
);
const anonExec =
  list(`select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE')`);
check(
  "24.12 : aucune fonction SECURITY DEFINER ouverte aux visiteurs",
  anonExec.length === 0,
  anonExec.join(", "),
);
const INTERNAL = [
  "activate_conversation_unlock",
  "activate_premium_subscription",
  "compatibility_breakdown",
  "confirm_payment",
  "consume_free_message",
  "create_conversation_for_match",
  "create_match_on_mutual_like",
  "create_notification",
  "expire_conversation_unlocks",
  "expire_subscriptions",
  "handle_new_user",
  "lock_conversation_for_sending",
  "refund_ai_quota",
  "wants_notification",
  "contains_phone_number",
];
const open = INTERNAL.filter(
  (f) =>
    sql(
      `select bool_or(has_function_privilege('authenticated', oid, 'EXECUTE')) from pg_proc where proname='${f}' and pronamespace='public'::regnamespace`,
    ) === "t",
);
check(
  "24.12 : fonctions internes (paiement, activation, quotas) fermées à l'API",
  open.length === 0,
  open.join(", "),
);
const SENSITIVE = [
  "payments",
  "subscriptions",
  "conversation_unlocks",
  "matches",
  "conversations",
  "messages",
  "notifications",
  "reports",
  "user_roles",
  "ai_usage",
  "profile_boosts",
  "support_tickets",
  "conversation_user_usage",
  "contact_requests",
  "profile_visits",
];
const writable = list(`select tablename || ':' || cmd from pg_policies where schemaname='public'
  and cmd in ('INSERT','UPDATE','DELETE','ALL') and tablename in (${SENSITIVE.map((t) => `'${t}'`).join(",")})
  and not (tablename = 'reports' and policyname like '%admin%')`);
check(
  "Tables sensibles : aucune écriture directe par un membre",
  writable.length === 0,
  writable.join(", "),
);
const publicBuckets = list(`select id from storage.buckets where public`);
check(
  "Stockage : photos et messages vocaux privés",
  publicBuckets.length === 0,
  publicBuckets.join(", "),
);

// ---------- 2. Tentatives réelles ----------
const { id, emails, PWD, cleanup } = createAccounts("c24", {
  u: ["male", "Attaquant"],
  v: ["female", "Victime"],
  w: ["male", "Temoin"],
});
const tok = {};
for (const k of Object.keys(id)) tok[k] = await tokenOf(emails[k], PWD);
const refused = (r) => r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0);

// 24.1 Profils
let r = await rest(tok.u, `profiles?user_id=eq.${id.v}`, "PATCH", { bio: "piraté" });
check(
  "24.1 : modifier le profil d'un autre → rien n'est changé",
  sql(`select coalesce(bio,'') from public.profiles where user_id='${id.v}'`) !== "piraté",
);
sql(`update public.profiles set status='suspended' where user_id='${id.u}'`);
r = await rest(tok.u, `profiles?user_id=eq.${id.u}`, "PATCH", { status: "active" });
check(
  "24.1 : un membre ne peut pas réactiver son propre profil",
  sql(`select status from public.profiles where user_id='${id.u}'`) === "suspended",
  `${r.status}`,
);
sql(`update public.profiles set status='active' where user_id='${id.u}'`);
sql(`update public.profiles set visibility='hidden' where user_id='${id.w}'`);
r = await rest(tok.u, `profiles?user_id=eq.${id.w}&select=first_name`);
check("24.1 : un profil masqué n'est pas lisible", refused(r));

// 24.2 Photos
const photo = sql(
  `insert into public.photos (user_id, storage_path) values ('${id.u}', '${id.u}/a.jpg') returning id`,
);
r = await rest(tok.u, `photos?id=eq.${photo}`, "PATCH", { status: "approved" });
check(
  "24.2 : s'auto-valider une photo → refusé",
  sql(`select status from public.photos where id='${photo}'`) === "pending",
  `${r.status}`,
);
const up = await fetch(`${API}/storage/v1/object/photos/${id.v}/intrus.jpg`, {
  method: "POST",
  headers: { apikey: KEY, Authorization: `Bearer ${tok.u}`, "Content-Type": "image/jpeg" },
  body: Buffer.alloc(100, 1),
});
check(
  "24.2 : déposer une photo dans le dossier d'un autre → refusé",
  up.status >= 400,
  `${up.status}`,
);
r = await rest(tok.u, "photos", "POST", { user_id: id.v, storage_path: `${id.v}/b.jpg` });
check("24.2 : créer une photo au nom d'un autre → refusé", r.status >= 400);

// 24.3 Likes / 24.4 Matchs
r = await rest(tok.u, "likes", "POST", { sender_id: id.v, receiver_id: id.u });
check("24.3 : Like au nom d'un autre → refusé", r.status >= 400);
await rest(tok.u, "likes", "POST", { sender_id: id.u, receiver_id: id.v });
r = await rest(tok.u, `likes?sender_id=eq.${id.u}`, "PATCH", { receiver_id: id.w });
check(
  "24.3 : changer la personne d'un Like → refusé",
  sql(`select count(*) from public.likes where sender_id='${id.u}' and receiver_id='${id.w}'`) ===
    "0",
  `${r.status}`,
);
r = await rest(tok.u, "matches", "POST", {
  user_1_id: id.u < id.w ? id.u : id.w,
  user_2_id: id.u < id.w ? id.w : id.u,
});
check("24.4 : créer un Match sans Like réciproque → refusé", r.status >= 400);

// 24.5 Conversations / 24.6 Messages
match(id, "v", "w");
const conv = sql(
  `select id from public.conversations where user_1_id=least('${id.v}'::uuid,'${id.w}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id.w}'::uuid)`,
);
await rest(tok.v, "rpc/send_message", "POST", {
  _conversation_id: conv,
  _content: "Message privé",
});
r = await rest(tok.u, `conversations?id=eq.${conv}`);
check("24.5 : lire la conversation des autres → rien", refused(r));
r = await rest(tok.u, `messages?conversation_id=eq.${conv}`);
check("24.6 : lire les messages des autres → rien", refused(r));
r = await rest(tok.u, "rpc/send_message", "POST", { _conversation_id: conv, _content: "Intrus" });
check("24.6 : écrire dans la conversation des autres → refusé", r.status >= 400);
r = await rest(tok.v, "messages", "POST", {
  conversation_id: conv,
  sender_id: id.v,
  content: "Sans quota",
});
check("24.6 : insérer un message sans passer par le serveur → refusé", r.status >= 400);

// 24.7 Favoris / 24.8 Visites
r = await rest(tok.u, "favorites", "POST", { user_id: id.v, favorite_user_id: id.u });
check("24.7 : favori au nom d'un autre → refusé", r.status >= 400);
r = await rest(tok.u, `favorites?user_id=eq.${id.v}`);
check("24.7 : lire les favoris d'un autre → rien", refused(r));
r = await rest(tok.u, "profile_visits", "POST", { visitor_id: id.u, visited_user_id: id.v });
check("24.8 : visite insérée sans passer par le serveur → refusé", r.status >= 400);
r = await rest(tok.u, `profile_visits?visited_user_id=eq.${id.v}`);
check("24.8 : lire les visiteurs d'un autre → rien", refused(r));

// 24.9 Quotas
r = await rest(tok.v, `conversation_user_usage?user_id=eq.${id.v}`, "PATCH", { messages_sent: 0 });
const r2 = await rest(tok.v, "ai_usage", "POST", {
  user_id: id.v,
  feature: "roi_salomon",
  count: 0,
});
check(
  "24.9 : remettre ses quotas à zéro → refusé",
  refused(r) && r2.status >= 400,
  `${r.status} / ${r2.status}`,
);

// 24.10 Premium / 24.11 Paiements
r = await rest(tok.u, "subscriptions", "POST", {
  user_id: id.u,
  plan: "premium_monthly",
  status: "active",
  starts_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 864e5).toISOString(),
});
check(
  "24.10 : s'offrir Premium sans payer → refusé",
  r.status >= 400 && sql(`select public.is_premium('${id.u}')`) === "f",
);
r = await rest(tok.u, "payments", "POST", {
  user_id: id.u,
  type: "subscription",
  amount: 1,
  currency: "EUR",
  provider: "test",
  status: "succeeded",
});
check("24.11 : créer un paiement « réussi » soi-même → refusé", r.status >= 400);
r = await rest(tok.u, "rpc/confirm_payment", "POST", {});
check("24.11 : confirmer un paiement depuis l'API → refusé", r.status >= 400);
r = await rest(tok.u, `payments?user_id=eq.${id.v}`);
check("24.11 : lire les paiements d'un autre → rien", refused(r));

// 24.13 Administration
r = await rest(tok.u, "user_roles", "POST", { user_id: id.u, role: "admin" });
check(
  "24.13 : se donner le rôle admin → refusé",
  r.status >= 400 &&
    sql(`select count(*) from public.user_roles where user_id='${id.u}' and role='admin'`) === "0",
);
sql(`update public.users set status='suspended' where id='${id.u}'`);
r = await rest(tok.u, `users?id=eq.${id.u}`, "PATCH", { status: "active" });
check(
  "24.13 : un membre suspendu ne peut pas se réactiver",
  sql(`select status from public.users where id='${id.u}'`) === "suspended",
  `${r.status}`,
);
r = await rest(tok.u, "rpc/admin_stats", "POST", {});
check("24.13 : fonctions admin refusées", r.text.includes("admin_required"));
r = await rest(tok.u, "moderation_actions", "POST", {
  admin_id: id.u,
  target_user_id: id.v,
  action: "suspend",
});
check("24.13 : écrire dans le journal de modération → refusé", r.status >= 400);

check("Nettoyage : comptes de test supprimés", cleanup());
finish();
