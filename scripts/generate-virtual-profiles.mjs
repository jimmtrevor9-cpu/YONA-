// Génère la migration des 40 profils de démonstration (21 femmes, 19 hommes, 22 à 35 ans,
// un seul prénom visible), à partir de scripts/data/virtual-profiles-countries.mjs et de
// la base géographique public/geo/.
//
// Un profil de démonstration n'est montré aux membres que lorsqu'un administrateur lui a
// donné une photo autorisée (/admin → Profils de démo) ; il porte toujours l'étiquette
// « Profil de démonstration ».
//
// Le tirage est déterministe (graine fixe) : relancer le script donne le même fichier.
//   node scripts/generate-virtual-profiles.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { DEMO_PHOTOS } from "./data/demo-profile-photos.mjs";
import { COUNTRIES } from "./data/virtual-profiles-countries.mjs";

// 80 % en Afrique francophone (8 pays, 2 femmes et 2 hommes chacun), 20 % en France
// (5 femmes, 3 hommes) : 21 femmes et 19 hommes.
const SELECTION = [
  { code: "GA", women: 2, men: 2 },
  { code: "CM", women: 2, men: 2 },
  { code: "CI", women: 2, men: 2 },
  { code: "CG", women: 2, men: 2 },
  { code: "TG", women: 2, men: 2 },
  { code: "BJ", women: 2, men: 2 },
  { code: "SN", women: 2, men: 2 },
  { code: "ML", women: 2, men: 2 },
  { code: "FR", women: 5, men: 3 },
];
const MIN_AGE = 22;
const MAX_AGE = 35;
// Date de référence des âges (jour de génération).
const TODAY = new Date(Date.UTC(2026, 9, 3));
const OUT = [
  "supabase/migrations/20261003100100_profils_demo_donnees.sql",
  "drizzle/migrations/0087_profils_demo_donnees.sql",
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

/** Date de naissance donnant exactement `age` ans au jour de référence. */
function birthDate(age) {
  const day = 24 * 3600 * 1000;
  const latest = Date.UTC(TODAY.getUTCFullYear() - age, TODAY.getUTCMonth(), TODAY.getUTCDate());
  const earliest =
    Date.UTC(TODAY.getUTCFullYear() - age - 1, TODAY.getUTCMonth(), TODAY.getUTCDate()) + day;
  const span = Math.round((latest - earliest) / day);
  return new Date(earliest + Math.floor(random() * (span + 1)) * day).toISOString().slice(0, 10);
}

function ageOn(birth) {
  const b = new Date(`${birth}T00:00:00Z`);
  let age = TODAY.getUTCFullYear() - b.getUTCFullYear();
  if (
    TODAY.getUTCMonth() < b.getUTCMonth() ||
    (TODAY.getUTCMonth() === b.getUTCMonth() && TODAY.getUTCDate() < b.getUTCDate())
  )
    age -= 1;
  return age;
}

const rows = [];
const bios = new Set();
const usedNames = new Set();
for (const selected of SELECTION) {
  const country = COUNTRIES.find((c) => c.code === selected.code);
  if (!country) throw new Error(`Pays absent des données : ${selected.code}`);
  const meta = countries.find((c) => c.code === country.code);
  if (!meta) throw new Error(`Pays inconnu : ${country.code}`);
  const regions = geo(country.code).regions.filter(
    (r) => !country.regionOnly || r.name === country.regionOnly,
  );
  const places = shuffle(
    country.cities.map((city) => {
      const region = regions.find((r) => r.cities.includes(city));
      if (!region) throw new Error(`${country.code} : ville absente de la base (${city})`);
      return { city, region: region.name };
    }),
  );
  // Un prénom n'est jamais donné deux fois, tous pays confondus.
  const names = {
    female: shuffle(country.women).filter((n) => !usedNames.has(n)),
    male: shuffle(country.men).filter((n) => !usedNames.has(n)),
  };
  const genders = [...Array(selected.women).fill("female"), ...Array(selected.men).fill("male")];
  let number = 0;
  for (const gender of genders) {
    number += 1;
    const firstName = names[gender].shift();
    if (!firstName) throw new Error(`${country.code} : plus assez de prénoms (${gender})`);
    usedNames.add(firstName);
    const place = places[(number - 1) % places.length];
    const age = MIN_AGE + Math.floor(random() * (MAX_AGE - MIN_AGE + 1));
    const birth = birthDate(age);
    if (ageOn(birth) !== age) throw new Error(`Âge incohérent pour ${firstName}`);
    const passions = shuffle(PASSION_KEYS).slice(0, 2 + Math.floor(random() * 3));
    let bio;
    do {
      const [a, b] = shuffle(passions).map((p) => PASSIONS[p]);
      bio = [pick(INTROS[gender])(a, b ?? a), pick(FAITH[gender]), pick(LOOKING[gender])].join(" ");
    } while (bios.has(bio));
    bios.add(bio);
    const slug = `demo.${country.code.toLowerCase()}.${String(number).padStart(2, "0")}`;
    // Image livrée avec le site (public/demo-profils/), s'il y en a une pour ce profil.
    const photo = DEMO_PHOTOS[slug] ? `/demo-profils/${slug.replace(/\./g, "-")}.webp` : null;
    if (photo && !existsSync(new URL(`../public${photo}`, import.meta.url))) {
      throw new Error(`Image absente : public${photo}`);
    }
    rows.push({
      email: `${slug}@profils-virtuels.yona.invalid`,
      photo,
      firstName,
      gender,
      birthDate: birth,
      country: meta.name,
      region: place.region,
      city: place.city,
      bio: bio.charAt(0).toUpperCase() + bio.slice(1),
      interests: passions,
      denomination: pick(country.churches),
      attendance: pick(ATTENDANCE),
      prayer: pick(PRAYER),
      importance: pick(IMPORTANCE),
      goal: pick(GOALS),
      prefGender: gender === "female" ? "male" : "female",
      minAge: Math.max(18, age - 6),
      maxAge: Math.min(99, age + 10),
    });
  }
}
const women = rows.filter((r) => r.gender === "female").length;
if (rows.length !== 40 || women !== 21)
  throw new Error(`Répartition inattendue : ${rows.length}/${women}`);

// Les profils sont écrits dans un bloc DO, sous forme de liste JSON compacte (une ligne
// par profil, valeurs dans un ordre fixe) : aucune table n'est créée, donc pas
// d'avertissement « RLS » dans l'éditeur SQL de Supabase. Le JSON est encadré par
// $seed$ … $seed$ : aucun échappement nécessaire.
// Ordre des valeurs : 0 e-mail, 1 prénom, 2 sexe, 3 naissance, 4 pays, 5 région, 6 ville,
// 7 bio, 8 centres d'intérêt, 9 église, 10 culte, 11 prière, 12 place de la foi,
// 13 objectif, 14 sexe recherché, 15 âge min, 16 âge max, 17 photo livrée avec le site.
function seedBlock(list) {
  const json = `[\n${list
    .map((r) =>
      JSON.stringify([
        r.email,
        r.firstName,
        r.gender,
        r.birthDate,
        r.country,
        r.region,
        r.city,
        r.bio,
        r.interests,
        r.denomination,
        r.attendance,
        r.prayer,
        r.importance,
        r.goal,
        r.prefGender,
        r.minAge,
        r.maxAge,
        r.photo,
      ]),
    )
    .join(",\n")}\n]`;
  if (json.includes("$seed$")) throw new Error("Délimiteur $seed$ présent dans les données");
  return `DO $do$
DECLARE
  _seed jsonb := $seed$${json}$seed$;
  _col text;
BEGIN
  -- 0. Profils virtuels d'une version précédente absents de cette liste : retirés
  --    (uniquement des comptes virtuels : fournisseur « virtual » + adresse
  --    @profils-virtuels.yona.invalid). Il reste ainsi exactement ${list.length} profils de démonstration.
  DELETE FROM auth.users u
  WHERE u.email LIKE '%@profils-virtuels.yona.invalid'
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_seed) e WHERE e ->> 0 = u.email);

  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    e ->> 0, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', e ->> 1, 'is_virtual', true),
    now(), now()
  FROM jsonb_array_elements(_seed) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e ->> 0);

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

  -- 2. Profils complets, actifs et visibles, avec leur image générée quand elle est
  --    livrée avec le site ; un profil sans photo reste caché aux membres (un
  --    administrateur peut en ajouter une dans /admin → Profils de démo).
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 2)::public.gender,
      birth_date = (e ->> 3)::date,
      country = e ->> 4,
      region = e ->> 5,
      city = e ->> 6,
      bio = e ->> 7,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 8)),
      is_virtual = true,
      terms_accepted_at = coalesce(p.terms_accepted_at, now()),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible',
      demo_photo_path = coalesce(nullif(e ->> 17, ''), p.demo_photo_path),
      demo_photo_source = CASE WHEN nullif(e ->> 17, '') IS NOT NULL THEN 'generated'
                               ELSE p.demo_photo_source END
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 9,
      church_attendance = e ->> 10,
      prayer_practice = e ->> 11,
      faith_importance = e ->> 12
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 13,
      preferred_gender = (e ->> 14)::public.gender,
      min_age = (e ->> 15)::smallint,
      max_age = (e ->> 16)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;
`;
}

const header = `-- ============================================================
-- Profils de démonstration : données (générées par scripts/generate-virtual-profiles.mjs)
--
-- ${rows.length} profils (${women} femmes, ${rows.length - women} hommes), ${MIN_AGE} à ${MAX_AGE} ans, un seul prénom visible :
-- ${SELECTION.map((x) => `${x.women + x.men} ${countries.find((c) => c.code === x.code).name}`).join(", ")}.
-- Comptes sans mot de passe (connexion impossible), marqués « virtual » dans le compte et
-- is_virtual dans le profil, toujours affichés avec l'étiquette « Profil de démonstration ».
-- ${rows.filter((r) => r.photo).length} ont une image générée par IA (personne qui n'existe pas), livrée avec le site
-- (public/demo-profils/) ; un profil sans image reste caché aux membres tant qu'un
-- administrateur ne lui en donne pas une (/admin → Profils de démo).
-- Aucune table n'est créée. Rejouable sans risque : un profil déjà présent n'est pas
-- recréé, et les profils virtuels d'une version précédente sont retirés.
-- À exécuter APRÈS 20261003100000_profils_demo_40.sql.
-- ============================================================
`;

const output = [header, seedBlock(rows)].join("\n");
for (const path of OUT) writeFileSync(new URL(`../${path}`, import.meta.url), output);
console.log(`${rows.length} profils de démonstration (${women} femmes) → ${OUT.join(", ")}`);
console.table(
  rows.map((r) => ({
    prénom: r.firstName,
    sexe: r.gender,
    âge: ageOn(r.birthDate),
    ville: r.city,
    pays: r.country,
  })),
);
