/**
 * Profils d'exemple affichés sur la page des profils pour qu'un nouveau membre ne tombe
 * jamais sur une page vide. Ils vivent uniquement ici, côté site : ils ne sont JAMAIS
 * enregistrés ni lus dans Supabase.
 *
 * 25 profils par pays, fabriqués toujours de la même façon (même ordre, mêmes prénoms
 * pour tous les visiteurs). Photos : public/virtual-profiles/<dossier>/ (voir le README
 * de ce dossier) ; sans photo, un avatar neutre s'affiche.
 */
import { PASSION_CHOICES } from "@/features/auth/signup-draft";

export interface VirtualProfile {
  id: string;
  firstName: string;
  gender: "male" | "female";
  age: number;
  city: string;
  country: string;
  bio: string;
  interests: string[];
  /** Dossier des photos (public/virtual-profiles/<folder>/) et numéro de la photo. */
  folder: string;
  photoIndex: number;
}

type Zone = "centre" | "ouest" | "ocean" | "maghreb" | "europe" | "quebec";

/** Pays couverts : nom (identique à la liste de l'étape 3), dossier photo, villes. */
export const VIRTUAL_COUNTRIES: { name: string; folder: string; zone: Zone; cities: string[] }[] = [
  {
    name: "Gabon",
    folder: "gabon",
    zone: "centre",
    cities: ["Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda", "Lambaréné"],
  },
  {
    name: "Cameroun",
    folder: "cameroun",
    zone: "centre",
    cities: ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Bamenda", "Kribi", "Limbé"],
  },
  {
    name: "Congo",
    folder: "congo",
    zone: "centre",
    cities: ["Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Owando"],
  },
  {
    name: "RD Congo",
    folder: "rd-congo",
    zone: "centre",
    cities: ["Kinshasa", "Lubumbashi", "Goma", "Kisangani", "Bukavu", "Matadi", "Mbuji-Mayi"],
  },
  {
    name: "République centrafricaine",
    folder: "centrafrique",
    zone: "centre",
    cities: ["Bangui", "Berbérati", "Bambari", "Bouar"],
  },
  {
    name: "Tchad",
    folder: "tchad",
    zone: "centre",
    cities: ["N'Djamena", "Moundou", "Sarh", "Abéché"],
  },
  {
    name: "Guinée équatoriale",
    folder: "guinee-equatoriale",
    zone: "centre",
    cities: ["Malabo", "Bata", "Ebebiyín", "Mongomo"],
  },
  {
    name: "Burundi",
    folder: "burundi",
    zone: "centre",
    cities: ["Bujumbura", "Gitega", "Ngozi", "Rumonge"],
  },
  {
    name: "Rwanda",
    folder: "rwanda",
    zone: "centre",
    cities: ["Kigali", "Huye", "Musanze", "Rubavu"],
  },
  {
    name: "Côte d'Ivoire",
    folder: "cote-d-ivoire",
    zone: "ouest",
    cities: ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Daloa", "Grand-Bassam"],
  },
  {
    name: "Sénégal",
    folder: "senegal",
    zone: "ouest",
    cities: ["Dakar", "Thiès", "Saint-Louis", "Ziguinchor", "Mbour"],
  },
  {
    name: "Mali",
    folder: "mali",
    zone: "ouest",
    cities: ["Bamako", "Sikasso", "Ségou", "Kayes", "Mopti"],
  },
  {
    name: "Burkina Faso",
    folder: "burkina-faso",
    zone: "ouest",
    cities: ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Banfora"],
  },
  {
    name: "Bénin",
    folder: "benin",
    zone: "ouest",
    cities: ["Cotonou", "Porto-Novo", "Parakou", "Abomey-Calavi", "Ouidah"],
  },
  {
    name: "Togo",
    folder: "togo",
    zone: "ouest",
    cities: ["Lomé", "Kara", "Sokodé", "Kpalimé", "Atakpamé"],
  },
  {
    name: "Guinée",
    folder: "guinee",
    zone: "ouest",
    cities: ["Conakry", "Kankan", "Kindia", "Labé", "N'Zérékoré"],
  },
  {
    name: "Niger",
    folder: "niger",
    zone: "ouest",
    cities: ["Niamey", "Zinder", "Maradi", "Tahoua"],
  },
  {
    name: "Mauritanie",
    folder: "mauritanie",
    zone: "ouest",
    cities: ["Nouakchott", "Nouadhibou", "Rosso", "Kiffa"],
  },
  {
    name: "Madagascar",
    folder: "madagascar",
    zone: "ocean",
    cities: ["Antananarivo", "Toamasina", "Antsirabe", "Mahajanga", "Fianarantsoa"],
  },
  { name: "Comores", folder: "comores", zone: "ocean", cities: ["Moroni", "Mutsamudu", "Fomboni"] },
  {
    name: "Djibouti",
    folder: "djibouti",
    zone: "ocean",
    cities: ["Djibouti", "Ali Sabieh", "Tadjourah", "Dikhil"],
  },
  {
    name: "Maurice",
    folder: "maurice",
    zone: "ocean",
    cities: ["Port-Louis", "Curepipe", "Quatre Bornes", "Vacoas", "Rose-Hill"],
  },
  {
    name: "Seychelles",
    folder: "seychelles",
    zone: "ocean",
    cities: ["Victoria", "Anse Boileau", "Beau Vallon"],
  },
  {
    name: "Maroc",
    folder: "maroc",
    zone: "maghreb",
    cities: ["Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", "Agadir"],
  },
  {
    name: "Algérie",
    folder: "algerie",
    zone: "maghreb",
    cities: ["Alger", "Oran", "Constantine", "Annaba", "Tizi Ouzou"],
  },
  {
    name: "Tunisie",
    folder: "tunisie",
    zone: "maghreb",
    cities: ["Tunis", "Sfax", "Sousse", "Bizerte", "Nabeul"],
  },
  {
    name: "France",
    folder: "france",
    zone: "europe",
    cities: ["Paris", "Lyon", "Marseille", "Lille", "Bordeaux", "Toulouse", "Nantes", "Strasbourg"],
  },
  {
    name: "Belgique",
    folder: "belgique",
    zone: "europe",
    cities: ["Bruxelles", "Liège", "Namur", "Charleroi", "Mons", "Louvain-la-Neuve"],
  },
  {
    name: "Canada",
    folder: "canada",
    zone: "quebec",
    cities: ["Montréal", "Québec", "Gatineau", "Sherbrooke", "Laval", "Trois-Rivières"],
  },
];

const NAMES: Record<Zone, { female: string[]; male: string[] }> = {
  centre: {
    female: [
      "Grâce",
      "Merveille",
      "Christelle",
      "Ornella",
      "Divine",
      "Prisca",
      "Josiane",
      "Nadège",
      "Larissa",
      "Sandrine",
      "Gloria",
      "Bénédicte",
      "Esther",
      "Ruth",
      "Mireille",
      "Carine",
      "Patricia",
      "Rebecca",
      "Joëlle",
      "Annick",
    ],
    male: [
      "Christian",
      "Fabrice",
      "Hervé",
      "Arnaud",
      "Landry",
      "Rodrigue",
      "Cédric",
      "Emmanuel",
      "Patrick",
      "Serge",
      "Jordan",
      "Samuel",
      "Yannick",
      "Joël",
      "Désiré",
      "Steve",
      "Junior",
      "Brice",
      "Gaël",
      "Dieudonné",
    ],
  },
  ouest: {
    female: [
      "Akissi",
      "Affoué",
      "Marie-Claire",
      "Félicité",
      "Rosine",
      "Edwige",
      "Pélagie",
      "Yolande",
      "Bernadette",
      "Clarisse",
      "Estelle",
      "Murielle",
      "Aurélie",
      "Victoire",
      "Adjoa",
      "Florence",
      "Odile",
      "Sylvie",
      "Nathalie",
      "Jeanne",
    ],
    male: [
      "Koffi",
      "Kouadio",
      "Yao",
      "Didier",
      "Armel",
      "Romaric",
      "Wilfried",
      "Ange",
      "Hermann",
      "Fulbert",
      "Ghislain",
      "Aristide",
      "Thierry",
      "Kodjo",
      "Paterne",
      "Innocent",
      "Honoré",
      "Sylvain",
      "Mathias",
      "Placide",
    ],
  },
  ocean: {
    female: [
      "Fanja",
      "Hanta",
      "Voahangy",
      "Miora",
      "Tiana",
      "Nirina",
      "Lalaina",
      "Fitia",
      "Mialy",
      "Noro",
      "Sabrina",
      "Anaïs",
      "Laetitia",
      "Mélissa",
      "Johanna",
      "Sandra",
      "Valérie",
      "Cindy",
      "Nadia",
      "Elsa",
    ],
    male: [
      "Sitraka",
      "Hery",
      "Andry",
      "Mamy",
      "Toky",
      "Rado",
      "Fetra",
      "Tojo",
      "Haja",
      "Lova",
      "Kevin",
      "Jérémy",
      "Ludovic",
      "Fabien",
      "Stéphane",
      "Michaël",
      "Olivier",
      "Damien",
      "Jason",
      "Ryan",
    ],
  },
  maghreb: {
    female: [
      "Sarah",
      "Myriam",
      "Inès",
      "Lina",
      "Nadia",
      "Maya",
      "Leïla",
      "Sonia",
      "Amel",
      "Dounia",
      "Salomé",
      "Rania",
      "Lydia",
      "Kenza",
      "Céline",
      "Hanna",
      "Yasmine",
      "Nora",
      "Melissa",
      "Dalila",
    ],
    male: [
      "Karim",
      "Yanis",
      "Samir",
      "Elias",
      "Adam",
      "Rayan",
      "Nassim",
      "Sofiane",
      "Amine",
      "Mehdi",
      "Malik",
      "Ilyes",
      "Anis",
      "Riad",
      "Walid",
      "Fares",
      "Nabil",
      "Youcef",
      "Hakim",
      "Sami",
    ],
  },
  europe: {
    female: [
      "Camille",
      "Chloé",
      "Manon",
      "Léa",
      "Émilie",
      "Sophie",
      "Pauline",
      "Clara",
      "Julie",
      "Anaïs",
      "Mathilde",
      "Sarah",
      "Inès",
      "Marie",
      "Charlotte",
      "Élodie",
      "Laura",
      "Océane",
      "Priscille",
      "Audrey",
    ],
    male: [
      "Thomas",
      "Lucas",
      "Antoine",
      "Julien",
      "Nicolas",
      "Maxime",
      "Hugo",
      "Benjamin",
      "Mathieu",
      "Simon",
      "Gabriel",
      "David",
      "Jonathan",
      "Raphaël",
      "Pierre",
      "Kévin",
      "Romain",
      "Florian",
      "Josué",
      "Christophe",
    ],
  },
  quebec: {
    female: [
      "Gabrielle",
      "Florence",
      "Rosalie",
      "Marie-Ève",
      "Catherine",
      "Audrey-Anne",
      "Laurence",
      "Émilie",
      "Justine",
      "Sabrina",
      "Mélanie",
      "Véronique",
      "Kim",
      "Andréanne",
      "Noémie",
      "Ariane",
      "Myriam",
      "Valérie",
      "Josiane",
      "Sarah",
    ],
    male: [
      "Alexandre",
      "Olivier",
      "Étienne",
      "Félix",
      "Samuel",
      "William",
      "Mathieu",
      "Jean-Philippe",
      "Maxime",
      "Gabriel",
      "Vincent",
      "Simon",
      "Marc-André",
      "Louis",
      "Charles",
      "David",
      "Philippe",
      "Jérémie",
      "Antoine",
      "Francis",
    ],
  },
};

const BIOS = [
  "Fils/Fille de Dieu avant tout. J'aime les moments simples : un culte, un bon repas, de vraies discussions.",
  "Je crois que l'amour se construit dans la patience et la prière. Je cherche une relation sérieuse.",
  "Engagé(e) dans ma paroisse, j'aime servir et partager. Prêt(e) pour une belle histoire qui mène au mariage.",
  "Souriant(e) et posé(e), j'avance avec la foi. J'aimerais rencontrer quelqu'un qui marche dans la même direction.",
  "La louange me ressource. Je rêve d'un foyer bâti sur le Christ, la confiance et le respect.",
  "Calme, fidèle et attentionné(e). Je cherche une personne sincère pour construire quelque chose de solide.",
  "J'aime rire, voyager et découvrir. Ma foi guide mes choix, y compris en amour.",
  "Famille, foi et projets : ce sont mes piliers. Je suis ici pour une rencontre vraie, sans jeu.",
  "Bénévole le week-end, curieux(se) en semaine. Je prie pour rencontrer la bonne personne au bon moment.",
  "« L'amour est patient, il est plein de bonté. » C'est ainsi que je veux aimer.",
  "Travailleur(se) et passionné(e), je garde toujours du temps pour Dieu et pour ceux que j'aime.",
  "Je cherche une relation où l'on prie ensemble, où l'on s'encourage et où l'on avance main dans la main.",
];

/** Accord simple du genre dans les bios (« Engagé(e) » → « Engagée » ou « Engagé »). */
function agree(text: string, gender: "male" | "female") {
  return text
    .replace(/Fils\/Fille/g, gender === "female" ? "Fille" : "Fils")
    .replace(/\(se\)/g, gender === "female" ? "se" : "")
    .replace(/\(e\)/g, gender === "female" ? "e" : "");
}

/** Petit générateur pseudo-aléatoire à graine fixe : mêmes profils pour tout le monde. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const PROFILES_PER_COUNTRY = 25;

function buildCountry(country: (typeof VIRTUAL_COUNTRIES)[number]): VirtualProfile[] {
  const rand = seeded(hash(country.folder));
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)] as T;
  const pools = NAMES[country.zone];
  const used = new Set<string>();
  const counters = { female: 0, male: 0 };
  const list: VirtualProfile[] = [];
  for (let i = 0; i < PROFILES_PER_COUNTRY; i++) {
    const gender = i % 2 === 0 ? "female" : "male";
    const names = pools[gender];
    let firstName = pick(names);
    for (let tries = 0; used.has(firstName) && tries < names.length; tries++) {
      firstName = names[(names.indexOf(firstName) + 1) % names.length] as string;
    }
    used.add(firstName);
    const interests = [...PASSION_CHOICES]
      .sort(() => rand() - 0.5)
      .slice(0, 2 + Math.floor(rand() * 3));
    counters[gender] += 1;
    list.push({
      id: `virtual-${country.folder}-${String(i + 1).padStart(2, "0")}`,
      firstName,
      gender,
      age: 21 + Math.floor(rand() * 28),
      city: pick(country.cities),
      country: country.name,
      bio: agree(pick(BIOS), gender),
      interests,
      folder: country.folder,
      photoIndex: counters[gender],
    });
  }
  return list;
}

export const VIRTUAL_PROFILES: VirtualProfile[] = VIRTUAL_COUNTRIES.flatMap(buildCountry);

/**
 * Ordre de disparition, le même pour tous les visiteurs : le n-ième vrai membre inscrit
 * fait disparaître le n-ième profil de cette liste.
 */
export const VIRTUAL_REMOVAL_ORDER: string[] = [...VIRTUAL_PROFILES]
  .map((p) => ({ id: p.id, key: hash(`yona:${p.id}`) }))
  .sort((a, b) => a.key - b.key)
  .map((p) => p.id);
