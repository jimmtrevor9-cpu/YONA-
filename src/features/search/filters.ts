import type { Gender } from "@/features/profiles/discovery";

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
}

/** Valeurs saisies dans le formulaire de recherche. */
export interface SearchForm {
  minAge: string;
  maxAge: string;
  gender: Gender | "";
  country: string;
  city: string;
}

export const EMPTY_SEARCH_FORM: SearchForm = {
  minAge: "",
  maxAge: "",
  gender: "",
  country: "",
  city: "",
};

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
  const city = form.city.trim();
  return {
    filters: {
      ...(minAge !== undefined ? { min_age: minAge } : {}),
      ...(maxAge !== undefined ? { max_age: maxAge } : {}),
      ...(form.gender ? { gender: form.gender } : {}),
      ...(country ? { country } : {}),
      ...(city ? { city } : {}),
    },
  };
}
