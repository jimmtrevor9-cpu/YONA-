/**
 * Informations de situation du profil, avec les seules valeurs acceptées par la base
 * (contraintes sur la table `profiles`).
 */
export const MARITAL_STATUSES = ["never_married", "divorced", "widowed"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  never_married: "Célibataire, jamais marié·e",
  divorced: "Divorcé·e",
  widowed: "Veuf / veuve",
};

export function isMaritalStatus(value: string | null | undefined): value is MaritalStatus {
  return (MARITAL_STATUSES as readonly string[]).includes(value ?? "");
}

/** Nombre d'enfants accepté par la base (seulement si le membre a des enfants). */
export const CHILDREN_COUNT_MAX = 20;

/** Centres d'intérêt : limites acceptées par la base. */
export const INTERESTS_MAX = 10;
export const INTEREST_MAX_LENGTH = 40;

/**
 * Découpe une saisie « musique, randonnée, lecture » en liste propre (espaces réduits,
 * doublons retirés sans tenir compte des majuscules). Renvoie un message d'erreur si la
 * liste dépasse les limites.
 */
export function parseInterests(
  text: string,
  max = INTERESTS_MAX,
): { items: string[]; error?: undefined } | { items?: undefined; error: string } {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of text.split(",")) {
    const item = raw.trim().replace(/\s+/g, " ");
    if (!item) continue;
    if (item.length > INTEREST_MAX_LENGTH) {
      return {
        error: `Chaque centre d'intérêt est limité à ${INTEREST_MAX_LENGTH} caractères.`,
      };
    }
    const key = item.toLocaleLowerCase("fr");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  if (items.length > max) return { error: `${max} centres d'intérêt au plus.` };
  return { items };
}
