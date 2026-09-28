import type { Gender } from "@/features/profiles/discovery";
import { isMaritalStatus, type MaritalStatus } from "@/features/profiles/facts";

/** Âges acceptés par la recherche (vérifiés aussi par le serveur). */
export const SEARCH_MIN_AGE = 18;
export const SEARCH_MAX_AGE = 99;

/** Filtres envoyés à la recherche serveur (`search_profiles`). */
export interface SearchFilters {
  min_age?: number;
  max_age?: number;
  gender?: Gender;
  country?: string;
  city?: string;
  max_distance_km?: SearchDistance;
  marital_status?: MaritalStatus[];
  has_children?: boolean;
  denomination?: string;
}

/** Rayons de recherche proposés (les seuls acceptés par le serveur). */
export const SEARCH_DISTANCES = [5, 10, 25, 50, 100, 250, 500] as const;
export type SearchDistance = (typeof SEARCH_DISTANCES)[number];

/** Valeurs saisies dans le formulaire de recherche. */
export interface SearchForm {
  minAge: string;
  maxAge: string;
  gender: Gender | "";
  country: string;
  city: string;
  distance: string;
  maritalStatus: MaritalStatus | "";
  children: "" | "with" | "without";
  denomination: string;
}

export const EMPTY_SEARCH_FORM: SearchForm = {
  minAge: "",
  maxAge: "",
  gender: "",
  country: "",
  city: "",
  distance: "",
  maritalStatus: "",
  children: "",
  denomination: "",
};

/** Longueur maximale d'un critère texte du profil chrétien (identique au profil). */
export const SEARCH_TEXT_MAX_LENGTH = 100;

/** Longueur maximale d'un pays ou d'une ville (identique au profil). */
export const SEARCH_PLACE_MAX_LENGTH = 100;

function parseAge(value: string): number | undefined | null {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  const age = Number(trimmed);
  return age >= SEARCH_MIN_AGE && age <= SEARCH_MAX_AGE ? age : null;
}

/**
 * Convertit le formulaire en filtres serveur. Renvoie un message d'erreur si une valeur
 * est invalide (le serveur refuse aussi ces valeurs).
 */
export function buildSearchFilters(
  form: SearchForm,
): { filters: SearchFilters; error?: undefined } | { filters?: undefined; error: string } {
  const minAge = parseAge(form.minAge);
  const maxAge = parseAge(form.maxAge);
  if (minAge === null || maxAge === null) {
    return { error: `L'âge doit être un nombre entre ${SEARCH_MIN_AGE} et ${SEARCH_MAX_AGE} ans.` };
  }
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    return { error: "L'âge minimum ne peut pas dépasser l'âge maximum." };
  }
  const country = form.country.trim().replace(/\s+/g, " ");
  if (country.length > SEARCH_PLACE_MAX_LENGTH) {
    return { error: `Le pays ne peut pas dépasser ${SEARCH_PLACE_MAX_LENGTH} caractères.` };
  }
  const city = form.city.trim().replace(/\s+/g, " ");
  if (city.length > SEARCH_PLACE_MAX_LENGTH) {
    return { error: `La ville ne peut pas dépasser ${SEARCH_PLACE_MAX_LENGTH} caractères.` };
  }
  const distance = form.distance ? Number(form.distance) : undefined;
  if (distance !== undefined && !(SEARCH_DISTANCES as readonly number[]).includes(distance)) {
    return { error: "Choisissez une distance proposée." };
  }
  if (form.maritalStatus && !isMaritalStatus(form.maritalStatus)) {
    return { error: "Choisissez une situation matrimoniale proposée." };
  }
  const denomination = form.denomination.trim().replace(/\s+/g, " ");
  if (denomination.length > SEARCH_TEXT_MAX_LENGTH) {
    return { error: `La dénomination ne peut pas dépasser ${SEARCH_TEXT_MAX_LENGTH} caractères.` };
  }
  return {
    filters: {
      ...(minAge !== undefined ? { min_age: minAge } : {}),
      ...(maxAge !== undefined ? { max_age: maxAge } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
      ...(distance !== undefined ? { max_distance_km: distance as SearchDistance } : {}),
      ...(form.maritalStatus ? { marital_status: [form.maritalStatus] } : {}),
      ...(form.children ? { has_children: form.children === "with" } : {}),
      ...(denomination ? { denomination } : {}),
    },
  };
}
