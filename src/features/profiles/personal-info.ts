/**
 * Règles des informations personnelles (prénom, sexe, date de naissance, ville, pays).
 * Le serveur applique les mêmes règles (migration 20260926100000_phase1_infos_personnelles) :
 * ces contrôles côté navigateur servent uniquement à afficher un message clair.
 */
import { APP_NAME } from "@/lib/config";

export const MIN_AGE = 18;
export const FIRST_NAME_MAX_LENGTH = 60;
export const PLACE_MAX_LENGTH = 100;
export const OLDEST_BIRTH_DATE = "1900-01-01";
/** Présentation (bio) : contrainte profiles_bio_length. */
export const BIO_MAX_LENGTH = 2000;

const pad = (n: number) => String(n).padStart(2, "0");

/** Date de naissance la plus récente autorisée (aujourd'hui − 18 ans), au format AAAA-MM-JJ. */
export function latestAllowedBirthDate(today = new Date()): string {
  return `${today.getFullYear() - MIN_AGE}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

interface PersonalInfo {
  firstName: string;
  gender?: string;
  birthDate: string;
}

/** Renvoie le message d'erreur à afficher, ou `null` si les informations sont valides. */
export function validatePersonalInfo(
  { firstName, gender, birthDate }: PersonalInfo,
  { requireGender, requireBirthDate }: { requireGender: boolean; requireBirthDate: boolean },
): string | null {
  if (!firstName.trim()) return "Indiquez votre prénom.";
  if (requireGender && !gender) return "Indiquez si vous êtes un homme ou une femme.";
  if (!birthDate) return requireBirthDate ? "Indiquez votre date de naissance." : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate < OLDEST_BIRTH_DATE) {
    return "Date de naissance invalide.";
  }
  if (birthDate > latestAllowedBirthDate()) {
    return `${APP_NAME} est réservé aux personnes majeures (${MIN_AGE} ans et plus).`;
  }
  return null;
}

/** Traduit les refus du serveur liés aux informations personnelles. */
export function personalInfoServerError(message: string | undefined): string | null {
  const m = (message ?? "").toLowerCase();
  if (m.includes("underage")) {
    return `${APP_NAME} est réservé aux personnes majeures (${MIN_AGE} ans et plus).`;
  }
  if (m.includes("invalid_birth_date")) return "Date de naissance invalide.";
  if (m.includes("profile_incomplete")) {
    return "Indiquez votre prénom, votre sexe et votre date de naissance pour que votre profil soit visible.";
  }
  if (m.includes("profiles_bio_length")) {
    return `La présentation est limitée à ${BIO_MAX_LENGTH} caractères.`;
  }
  if (m.includes("profiles_city_length") || m.includes("profiles_country_length")) {
    return `La ville et le pays sont limités à ${PLACE_MAX_LENGTH} caractères.`;
  }
  return null;
}
