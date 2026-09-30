/**
 * Règles des préférences (personne recherchée, table preferences).
 * Le serveur applique les mêmes règles (contrainte preferences_age_range et migration
 * 20260926120000_phase1_preferences).
 */
export const PARTNER_MIN_AGE = 18;
export const PARTNER_MAX_AGE = 99;
export const RELATIONSHIP_GOAL_MAX_LENGTH = 100;
export const FAMILY_PROJECT_MAX_LENGTH = 200;

/** Renvoie le message d'erreur à afficher, ou `null` si la tranche d'âge est valide. */
export function validateAgeRange(minAge: number, maxAge: number): string | null {
  const inRange = (n: number) =>
    Number.isInteger(n) && n >= PARTNER_MIN_AGE && n <= PARTNER_MAX_AGE;
  if (!inRange(minAge) || !inRange(maxAge)) {
    return `Les âges recherchés doivent être compris entre ${PARTNER_MIN_AGE} et ${PARTNER_MAX_AGE} ans.`;
  }
  if (minAge > maxAge) return "L'âge minimum ne peut pas dépasser l'âge maximum.";
  return null;
}

/** Traduit les refus du serveur liés aux préférences. */
export function preferencesServerError(message: string | undefined): string | null {
  const m = (message ?? "").toLowerCase();
  if (m.includes("preferences_age_range")) {
    return `Tranche d'âge invalide (entre ${PARTNER_MIN_AGE} et ${PARTNER_MAX_AGE} ans, minimum ≤ maximum).`;
  }
  if (m.includes("preferences_relationship_goal_length")) {
    return `« Ce que vous recherchez » est limité à ${RELATIONSHIP_GOAL_MAX_LENGTH} caractères.`;
  }
  if (m.includes("preferences_family_project_length")) {
    return `Le projet familial est limité à ${FAMILY_PROJECT_MAX_LENGTH} caractères.`;
  }
  return null;
}
