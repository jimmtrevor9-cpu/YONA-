/** Affichage d'une cellule et tri des tableaux de l'administration. */
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "oui" : "non";
  if (typeof value === "string" && ISO.test(value)) return dateTime.format(new Date(value));
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Tri : un clic sur la même colonne inverse l'ordre ; une nouvelle colonne commence
 * décroissante (dates, nombres) ou croissante (textes : A → Z).
 */
export function nextSort(current: { sort: string; desc: boolean }, key: string, firstDesc = true) {
  return current.sort === key ? { sort: key, desc: !current.desc } : { sort: key, desc: firstDesc };
}

/** Colonnes de texte triées de A à Z au premier clic. */
export const TEXT_SORT_KEYS = [
  "first_name",
  "email",
  "country",
  "city",
  "event",
  "step",
  "action",
  "source",
  "product",
  "target_table",
];
