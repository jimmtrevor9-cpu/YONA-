// YONA — Phase 0 / Étape 0.7 — Rejoue, avec @supabase/supabase-js (même bibliothèque que
// l'application), chaque requête et fonction appelée par le code contre un Supabase LOCAL.
// Les requêtes reproduisent exactement celles de src/ (fichier:ligne indiqués).
// Usage : node docs/verification/phase-0/etape-0.7-requetes-code.mjs
// Crée 2 comptes de TEST (@example.test) puis les supprime.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { createClient } = createRequire(`${process.cwd()}/package.json`)("@supabase/supabase-js");
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
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
const noErr = (label, r, extra = "") => check(label, !r.error, r.error ? r.error.message : extra);

// Comptes de test (inscription réelle + confirmation forcée en local)
sql("delete from auth.users where email like 'test-coherence-%@example.test';");
const anon = createClient(URL, KEY, { auth: { persistSession: false } });
const pwd = "TestCoh!2026";
for (const n of ["a", "b"]) {
  await anon.auth.signUp({
    email: `test-coherence-${n}@example.test`,
    password: pwd,
    options: { data: { first_name: `Coh${n}` } },
  });
}
sql(
  "update auth.users set email_confirmed_at = now() where email like 'test-coherence-%@example.test';",
);
const login = async (n) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data } = await c.auth.signInWithPassword({
    email: `test-coherence-${n}@example.test`,
    password: pwd,
  });
  return { c, id: data.user.id };
};
const A = await login("a");
const B = await login("b");

// ---- onboarding.tsx:57/74/85 — 3 mises à jour (pour A et B) ----
for (const [who, u, gender] of [
  ["A", A, "female"],
  ["B", B, "male"],
]) {
  const p = await u.c
    .from("profiles")
    .update({
      first_name: `Coh${who}`,
      gender,
      birth_date: "1995-05-05",
      city: "Douala",
      country: "Cameroun",
      bio: "Test",
      onboarding_step: 3,
      onboarding_completed_at: new Date().toISOString(),
      status: "active",
      visibility: "visible",
    })
    .eq("user_id", u.id);
  noErr(`onboarding.tsx:57 — profiles.update (${who})`, p);
  const f = await u.c
    .from("christian_profiles")
    .update({
      denomination: "Évangélique",
      church_attendance: "Chaque semaine",
      faith_importance: "Essentielle",
      marriage_vision: "Pour la vie",
    })
    .eq("user_id", u.id);
  noErr(`onboarding.tsx:74 — christian_profiles.update (${who})`, f);
  const pr = await u.c
    .from("preferences")
    .update({
      preferred_gender: gender === "female" ? "male" : "female",
      min_age: 25,
      max_age: 40,
      relationship_goal: "Mariage",
    })
    .eq("user_id", u.id);
  noErr(`onboarding.tsx:85 — preferences.update (${who})`, pr);
}
// ---- profile.tsx:56 ----
noErr(
  "profile.tsx:56 — profiles.update (A)",
  await A.c
    .from("profiles")
    .update({
      first_name: "CohA",
      birth_date: "1995-05-05",
      city: "Douala",
      country: "Cameroun",
      profession: "Infirmière",
      bio: "Test",
    })
    .eq("user_id", A.id),
);
// ---- queries.ts:11 ----
const me = await A.c.from("profiles").select("*").eq("user_id", A.id).maybeSingle();
noErr("queries.ts:11 — mon profil (select *)", me, `statut=${me.data?.status}`);
// ---- discovery.ts:19 (sans filtre, puis filtres sexe + ville comme search.tsx) ----
const disc = await A.c
  .from("profiles")
  .select("user_id, first_name, birth_date, city, country, bio, gender, interests")
  .eq("status", "active")
  .eq("visibility", "visible")
  .neq("user_id", A.id)
  .order("updated_at", { ascending: false })
  .limit(30);
noErr("discovery.ts:19 — découverte", disc, `${disc.data?.length} profil(s)`);
check(
  "Découverte : A voit B",
  disc.data?.some((p) => p.user_id === B.id),
);
const discF = await A.c
  .from("profiles")
  .select("user_id, first_name, birth_date, city, country, bio, gender, interests")
  .eq("status", "active")
  .eq("visibility", "visible")
  .neq("user_id", A.id)
  .order("updated_at", { ascending: false })
  .limit(30)
  .eq("gender", "male")
  .ilike("city", "%Douala%");
noErr("discovery.ts:27-28 — filtres sexe + ville", discF, `${discF.data?.length} profil(s)`);
// ---- likes.functions.ts:20/30 (même requêtes, client soumis au RLS de l'utilisateur) ----
const target = await A.c
  .from("profiles")
  .select("user_id")
  .eq("user_id", B.id)
  .eq("status", "active")
  .eq("visibility", "visible")
  .maybeSingle();
noErr(
  "likes.functions.ts:20 — profil cible disponible",
  target,
  target.data ? "trouvé" : "INTROUVABLE",
);
check("likeProfile : la cible est trouvée", !!target.data);
noErr(
  "likes.functions.ts:30 — upsert du Like",
  await A.c
    .from("likes")
    .upsert(
      { sender_id: A.id, receiver_id: B.id, kind: "like", status: "active" },
      { onConflict: "sender_id,receiver_id" },
    ),
);
noErr(
  "likes.functions.ts:30 — upsert du Like (2e fois, pas de doublon)",
  await A.c
    .from("likes")
    .upsert(
      { sender_id: A.id, receiver_id: B.id, kind: "like", status: "active" },
      { onConflict: "sender_id,receiver_id" },
    ),
);
// ---- likes.ts:11 ----
const sent = await A.c
  .from("likes")
  .select("receiver_id")
  .eq("sender_id", A.id)
  .eq("kind", "like")
  .eq("status", "active");
noErr("likes.ts:11 — Likes envoyés", sent, `${sent.data?.length} Like(s)`);
check("Un seul Like en base après 2 envois", sent.data?.length === 1);
// ---- quotas.ts : favoris ----
noErr(
  "quotas.ts:74 — ajouter un favori",
  await A.c.from("favorites").insert({ user_id: A.id, favorite_user_id: B.id }),
);
const favs = await A.c
  .from("favorites")
  .select("favorite_user_id, created_at")
  .order("created_at", { ascending: false });
noErr("quotas.ts:94 — lister mes favoris", favs, `${favs.data?.length}`);
// ---- Fonctions (RPC) appelées par le code ----
const rpcs = [
  ["roles.ts:9 — has_role", A, "has_role", { _user_id: A.id, _role: "admin" }, false],
  ["presence.ts:17 — touch_activity", A, "touch_activity", undefined],
  ["presence.ts:21 — get_presence", A, "get_presence", { _user_id: B.id }],
  ["quotas.ts:62 — get_ai_quota", A, "get_ai_quota", { _feature: "roi_salomon" }],
  ["quotas.ts:69 — consume_ai_quota", A, "consume_ai_quota", { _feature: "roi_salomon" }],
  [
    "quotas.ts:36 — get_conversation_quota (conversation inexistante)",
    A,
    "get_conversation_quota",
    { _conversation_id: "00000000-0000-4000-8000-000000000000" },
  ],
  [
    "quotas.ts:44 — consume_free_message (conversation inexistante)",
    A,
    "consume_free_message",
    { _conversation_id: "00000000-0000-4000-8000-000000000000" },
  ],
  [
    "quotas.ts:53 — has_active_conversation_unlock",
    A,
    "has_active_conversation_unlock",
    { _conversation_id: "00000000-0000-4000-8000-000000000000" },
  ],
  ["quotas.ts:115 — record_profile_visit", A, "record_profile_visit", { _visited_user_id: B.id }],
  ["quotas.ts:108 — get_favorited_by (B, gratuit)", B, "get_favorited_by", undefined],
  ["quotas.ts:122 — get_profile_visitors (B, gratuit)", B, "get_profile_visitors", undefined],
];
for (const [label, u, fn, args] of rpcs) {
  const r = await u.c.rpc(fn, args);
  noErr(label, r, `→ ${JSON.stringify(r.data)}`.slice(0, 110));
}
noErr(
  "quotas.ts:84 — retirer le favori",
  await A.c.from("favorites").delete().eq("user_id", A.id).eq("favorite_user_id", B.id),
);

sql("delete from auth.users where email like 'test-coherence-%@example.test';");
check("Nettoyage : comptes de test supprimés", sql("select count(*) from public.users") === "0");
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
