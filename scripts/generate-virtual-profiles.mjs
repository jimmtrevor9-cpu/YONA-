// Génère la migration des profils virtuels (25 par pays, 27 pays) et des positions de
// pays (public.geo_countries), à partir de scripts/data/virtual-profiles-countries.mjs
// et de la base géographique public/geo/.
//
// Le tirage est déterministe (graine fixe) : relancer le script donne le même fichier.
//   node scripts/generate-virtual-profiles.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { COUNTRIES } from "./data/virtual-profiles-countries.mjs";

const PER_COUNTRY = 25;
const OUT = [
  "supabase/migrations/20261002110000_profils_virtuels_donnees.sql",
  "drizzle/migrations/0085_profils_virtuels_donnees.sql",
];
const geo = (code) =>
  JSON.parse(readFileSync(new URL(`../public/geo/${code}.json`, import.meta.url)));
const countries = JSON.parse(
  readFileSync(new URL("../public/geo/countries.json", import.meta.url), "utf8"),
);

// Générateur pseudo-aléatoire à graine fixe (mulberry32).
let seed = 20261002;
function random() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];
function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Centres d'intérêt : mêmes valeurs que le parcours d'inscription (PASSION_CHOICES).
const PASSIONS = {
  Louange: "la louange",
  Musique: "la musique",
  Lecture: "la lecture",
  Cuisine: "la cuisine",
  Voyages: "les voyages",
  Sport: "le sport",
  Danse: "la danse",
  Cinéma: "le cinéma",
  Nature: "les balades dans la nature",
  Bénévolat: "le bénévolat",
  Mode: "la mode",
  Photographie: "la photographie",
};
const PASSION_KEYS = Object.keys(PASSIONS);
/** « la louange » → « à la louange », « le sport » → « au sport », « les voyages » → « aux voyages ». */
const toA = (phrase) =>
  phrase.replace(/^les /, "aux ").replace(/^le /, "au ").replace(/^la /, "à la ");

const INTROS = {
  female: [
    (a, b) => `Souriante et attentionnée, j'aime ${a} et ${b}.`,
    (a, b) => `Fille de Dieu avant tout, je trouve ma joie dans ${a} et ${b}.`,
    (a) => `Calme et joyeuse, je partage mon temps entre mon travail et ${a}.`,
    (a, b) => `Je suis une femme simple, passionnée par ${a} et ${b}.`,
    (a, b) =>
      `Chaque journée est un cadeau de Dieu : je la remplis de ${a.replace(/^(la|le|les) /, "")} et de ${b.replace(/^(la|le|les) /, "")}.`,
    (a) => `Dynamique et fidèle en amitié, je consacre mon temps libre ${toA(a)}.`,
    (a, b) => `Douce mais déterminée, j'aime ${a}, ${b} et les longues discussions.`,
  ],
  male: [
    (a, b) => `Souriant et attentionné, j'aime ${a} et ${b}.`,
    (a, b) => `Fils de Dieu avant tout, je trouve ma joie dans ${a} et ${b}.`,
    (a) => `Calme et joyeux, je partage mon temps entre mon travail et ${a}.`,
    (a, b) => `Je suis un homme simple, passionné par ${a} et ${b}.`,
    (a, b) =>
      `Chaque journée est un cadeau de Dieu : je la remplis de ${a.replace(/^(la|le|les) /, "")} et de ${b.replace(/^(la|le|les) /, "")}.`,
    (a) => `Dynamique et fidèle en amitié, je consacre mon temps libre ${toA(a)}.`,
    (a, b) => `Posé mais déterminé, j'aime ${a}, ${b} et les longues discussions.`,
  ],
};
const FAITH = {
  female: [
    "Je chante dans la chorale de mon église.",
    "La prière rythme mes journées.",
    "Je suis engagée dans le groupe de jeunes de ma paroisse.",
    "Ma foi guide chacune de mes décisions.",
    "J'aime méditer la Parole chaque matin.",
    "Je sers à l'accueil de mon église le dimanche.",
    "Le Psaume 23 m'accompagne depuis toujours.",
    "Je participe à un groupe de prière chaque semaine.",
    "J'enseigne à l'école du dimanche.",
  ],
  male: [
    "Je joue dans le groupe de louange de mon église.",
    "La prière rythme mes journées.",
    "Je suis engagé dans le groupe de jeunes de ma paroisse.",
    "Ma foi guide chacune de mes décisions.",
    "J'aime méditer la Parole chaque matin.",
    "Je sers à l'accueil de mon église le dimanche.",
    "Le Psaume 23 m'accompagne depuis toujours.",
    "Je participe à un groupe de prière chaque semaine.",
    "J'aide à l'organisation des sorties de l'église.",
  ],
};
const LOOKING = {
  female: [
    "Je souhaite rencontrer un homme sincère pour construire un foyer béni.",
    "Je cherche une relation sérieuse, en vue du mariage.",
    "J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",
    "Prête à bâtir une famille fondée sur l'amour et la foi.",
    "Je crois au mariage, à la fidélité et au respect.",
    "J'attends un homme de foi, doux et responsable.",
  ],
  male: [
    "Je souhaite rencontrer une femme sincère pour construire un foyer béni.",
    "Je cherche une relation sérieuse, en vue du mariage.",
    "J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",
    "Prêt à bâtir une famille fondée sur l'amour et la foi.",
    "Je crois au mariage, à la fidélité et au respect.",
    "J'attends une femme de foi, douce et pleine de joie.",
  ],
};
const GOALS = [
  "Mariage",
  "Mariage",
  "Relation sérieuse",
  "Relation sérieuse",
  "Faire connaissance d'abord",
];
const ATTENDANCE = [
  "Chaque semaine",
  "Chaque semaine",
  "Plusieurs fois par semaine",
  "Deux à trois fois par mois",
];
const PRAYER = ["Tous les jours", "Tous les jours", "Matin et soir", "Plusieurs fois par semaine"];
const IMPORTANCE = ["Essentielle", "Très importante", "Au centre de ma vie"];

const sql = (value) =>
  value === null || value === undefined ? "NULL" : `'${String(value).replace(/'/g, "''")}'`;
const sqlArray = (list) => `ARRAY[${list.map(sql).join(", ")}]::text[]`;

function birthDate(age) {
  const today = new Date(Date.UTC(2026, 9, 2));
  const year = today.getUTCFullYear() - age - 1;
  const dayOfYear = 1 + Math.floor(random() * 360);
  const date = new Date(Date.UTC(year, 0, dayOfYear));
  // Anniversaire déjà passé ou à venir : l'âge reste age ou age + 1, toujours >= 18.
  return date.toISOString().slice(0, 10);
}

const rows = [];
const bios = new Set();
for (const country of COUNTRIES) {
  const meta = countries.find((c) => c.code === country.code);
  if (!meta) throw new Error(`Pays inconnu : ${country.code}`);
  const regions = geo(country.code).regions.filter(
    (r) => !country.regionOnly || r.name === country.regionOnly,
  );
  const places = country.cities.map((city) => {
    const region = regions.find((r) => r.cities.includes(city));
    if (!region) throw new Error(`${country.code} : ville absente de la base (${city})`);
    return { city, region: region.name };
  });
  const women = shuffle(country.women);
  const men = shuffle(country.men);
  const lastNames = shuffle(country.last);
  for (let i = 0; i < PER_COUNTRY; i++) {
    const gender = i % 2 === 0 ? "female" : "male";
    const firstName = gender === "female" ? women[Math.floor(i / 2)] : men[Math.floor(i / 2)];
    const lastName = lastNames[i % lastNames.length];
    const place = places[i % places.length];
    const age = 22 + Math.floor(random() * 27); // 22 à 48 ans
    const passions = shuffle(PASSION_KEYS).slice(0, 2 + Math.floor(random() * 3));
    let bio;
    do {
      const [a, b] = shuffle(passions).map((p) => PASSIONS[p]);
      bio = [pick(INTROS[gender])(a, b ?? a), pick(FAITH[gender]), pick(LOOKING[gender])].join(" ");
    } while (bios.has(bio));
    bios.add(bio);
    const capitalized = bio.charAt(0).toUpperCase() + bio.slice(1);
    rows.push({
      email: `virtuel.${country.code.toLowerCase()}.${String(i + 1).padStart(2, "0")}@profils-virtuels.yona.invalid`,
      firstName,
      lastName,
      gender,
      birthDate: birthDate(age),
      country: meta.name,
      region: place.region,
      city: place.city,
      bio: capitalized,
      interests: passions,
      denomination: pick(country.churches),
      attendance: pick(ATTENDANCE),
      prayer: pick(PRAYER),
      importance: pick(IMPORTANCE),
      goal: pick(GOALS),
      prefGender: gender === "female" ? "male" : "female",
      minAge: Math.max(18, age - 8),
      maxAge: Math.min(99, age + 10),
    });
  }
}

const geoValues = countries
  .map((c) => `  (${sql(c.code)}, ${sql(c.name)}, ${c.lat}, ${c.lng})`)
  .join(",\n");

// Les profils sont écrits en JSON dans un bloc DO : aucune table n'est créée (pas
// d'avertissement « RLS » dans l'éditeur SQL de Supabase) et chaque partie se suffit
// à elle-même. Le JSON est encadré par $seed$ … $seed$ : aucun échappement nécessaire.
function seedBlock(list) {
  const json = JSON.stringify(
    list.map((r) => ({
      email: r.email,
      first_name: r.firstName,
      last_name: r.lastName,
      gender: r.gender,
      birth_date: r.birthDate,
      country: r.country,
      region: r.region,
      city: r.city,
      bio: r.bio,
      interests: r.interests,
      denomination: r.denomination,
      church_attendance: r.attendance,
      prayer_practice: r.prayer,
      faith_importance: r.importance,
      goal: r.goal,
      preferred_gender: r.prefGender,
      min_age: r.minAge,
      max_age: r.maxAge,
    })),
  ).replace(/\},\{/g, "},\n{");
  if (json.includes("$seed$")) throw new Error("Délimiteur $seed$ présent dans les données");
  return `DO $do$
DECLARE
  _seed jsonb := $seed$${json}$seed$;
  _col text;
BEGIN
  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    s.email, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', s.first_name, 'last_name', s.last_name, 'is_virtual', true),
    now(), now()
  FROM jsonb_to_recordset(_seed) AS s(email text, first_name text, last_name text)
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = s.email);

  -- Colonnes texte du service d'authentification : jamais NULL (sinon l'écran des
  -- utilisateurs de Supabase peut échouer). Seules les colonnes présentes sont touchées.
  FOREACH _col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
    'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = _col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email LIKE %L',
        _col, _col, '%@profils-virtuels.yona.invalid'
      );
    END IF;
  END LOOP;

  -- 2. Profils complets, actifs et visibles.
  UPDATE public.profiles p
  SET first_name = s.first_name,
      gender = s.gender::public.gender,
      birth_date = s.birth_date::date,
      country = s.country,
      region = s.region,
      city = s.city,
      bio = s.bio,
      interests = ARRAY(SELECT jsonb_array_elements_text(s.interests)),
      is_virtual = true,
      terms_accepted_at = now(),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible'
  FROM jsonb_to_recordset(_seed) AS s(
    email text, first_name text, gender text, birth_date text, country text, region text,
    city text, bio text, interests jsonb
  )
  JOIN public.users u ON u.email = s.email
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = s.denomination,
      church_attendance = s.church_attendance,
      prayer_practice = s.prayer_practice,
      faith_importance = s.faith_importance
  FROM jsonb_to_recordset(_seed) AS s(
    email text, denomination text, church_attendance text, prayer_practice text,
    faith_importance text
  )
  JOIN public.users u ON u.email = s.email
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET preferred_gender = s.preferred_gender::public.gender,
      min_age = s.min_age,
      max_age = s.max_age,
      relationship_goal = s.goal
  FROM jsonb_to_recordset(_seed) AS s(
    email text, preferred_gender text, min_age smallint, max_age smallint, goal text
  )
  JOIN public.users u ON u.email = s.email
  WHERE pr.user_id = u.id;
END
$do$;
`;
}

const geoSql = `INSERT INTO public.geo_countries (code, name, lat, lng) VALUES
${geoValues}
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng;
`;

// Découpage en petites parties (3 pays chacune) : plus simple à coller dans l'éditeur
// SQL de Supabase, surtout depuis un téléphone.
const COUNTRIES_PER_PART = 3;
const parts = [];
for (let i = 0; i < COUNTRIES.length; i += COUNTRIES_PER_PART) {
  const codes = COUNTRIES.slice(i, i + COUNTRIES_PER_PART).map((c) => c.code.toLowerCase());
  const list = rows.filter((r) => codes.includes(r.email.split(".")[1]));
  const names = [...new Set(list.map((r) => r.country))];
  parts.push({ names, list });
}

const header = `-- ============================================================
-- Profils virtuels : données (générées par scripts/generate-virtual-profiles.mjs)
--
-- * public.geo_countries : position de chaque pays (base GeoNames), pour « le pays le
--   plus proche » quand il n'y a plus de profil virtuel dans le pays d'un nouveau membre.
-- * ${rows.length} profils virtuels : ${PER_COUNTRY} par pays, ${COUNTRIES.length} pays, femmes et hommes à parts
--   presque égales, 22 à 48 ans. Ce sont des comptes sans mot de passe (connexion
--   impossible), marqués « virtual » dans le compte et is_virtual dans le profil.
--   Aucune photo : la carte affiche l'initiale, en attendant de vraies photos.
-- Rejouable : un profil déjà présent (même adresse) n'est pas recréé.
-- Aucune table n'est créée. Le même contenu existe en petits fichiers dans
-- supabase/profils-virtuels/ (à coller un par un dans l'éditeur SQL de Supabase).
-- À exécuter APRÈS 20261002100000_profils_virtuels_et_verification.sql.
-- ============================================================
`;

const output = [
  header,
  geoSql,
  ...parts.map((p) => `-- ${p.names.join(", ")}\n${seedBlock(p.list)}`),
].join("\n");
for (const path of OUT) writeFileSync(new URL(`../${path}`, import.meta.url), output);

// Petits fichiers, un par étape, pour l'éditeur SQL de Supabase.
const DIR = new URL("../supabase/profils-virtuels/", import.meta.url);
rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
const total = parts.length + 1;
const intro = (n, what) => `-- ============================================================
-- YONA — profils virtuels : fichier ${n} sur ${total}
-- ${what}
-- À coller tel quel dans Supabase → SQL Editor, puis « Run ».
-- Rejouable sans risque. À faire APRÈS le fichier de structure
-- (supabase/migrations/20261002100000_profils_virtuels_et_verification.sql).
-- ============================================================
`;
const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
writeFileSync(
  new URL("01-positions-des-pays.sql", DIR),
  `${intro(1, "Position des pays (pour trouver le pays le plus proche).")}\n${geoSql}`,
);
parts.forEach((p, index) => {
  const n = index + 2;
  const name = `${String(n).padStart(2, "0")}-profils-${p.names.map(slug).join("-")}.sql`;
  writeFileSync(
    new URL(name, DIR),
    `${intro(n, `${p.list.length} profils : ${p.names.join(", ")}.`)}\n${seedBlock(p.list)}`,
  );
});
console.log(
  `${rows.length} profils virtuels, ${countries.length} pays → ${OUT.join(", ")} + ${total} fichiers dans supabase/profils-virtuels/`,
);
