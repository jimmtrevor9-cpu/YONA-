/**
 * Règles des informations chrétiennes (table christian_profiles).
 * Le serveur applique les mêmes limites (migration 20260926110000_phase1_infos_chretiennes).
 */
export const FAITH_SHORT_MAX_LENGTH = 100;
export const FAITH_LONG_MAX_LENGTH = 1000;
export const CHRISTIAN_VALUES_MAX = 10;
export const CHRISTIAN_VALUE_MAX_LENGTH = 40;

/**
 * « Fidélité, pardon,  humilité, fidélité » → ["Fidélité", "pardon", "humilité"] :
 * séparation par virgules, espaces retirés, vides et doublons (sans tenir compte de la
 * casse) supprimés, 10 valeurs de 40 caractères au plus.
 */
export function parseChristianValues(input: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of input.split(",")) {
    const value = raw.trim().slice(0, CHRISTIAN_VALUE_MAX_LENGTH).trim();
    const key = value.toLocaleLowerCase("fr");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
    if (values.length === CHRISTIAN_VALUES_MAX) break;
  }
  return values;
}

export function formatChristianValues(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}
