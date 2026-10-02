/**
 * Base géographique de l'étape « Où es-tu ? » : tous les pays du monde, leurs régions
 * (province, État…) et leurs villes.
 *
 * Les fichiers sont générés par `scripts/generate-geo.mjs` (base open source
 * « country-state-city ») et servis depuis `public/geo/` : la liste des pays est chargée
 * une fois, puis seulement le fichier du pays choisi.
 */
export interface GeoCountry {
  code: string;
  /** Nom en français (ex. « Cameroun »). */
  name: string;
  lat: number;
  lng: number;
}

export interface GeoRegion {
  name: string;
  cities: string[];
}

let countriesPromise: Promise<GeoCountry[]> | null = null;
const regionsCache = new Map<string, Promise<GeoRegion[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`geo ${res.status}`);
  return (await res.json()) as T;
}

export function loadCountries(): Promise<GeoCountry[]> {
  countriesPromise ??= fetchJson<GeoCountry[]>("/geo/countries.json").catch((error) => {
    countriesPromise = null;
    throw error;
  });
  return countriesPromise;
}

export function loadRegions(countryCode: string): Promise<GeoRegion[]> {
  let promise = regionsCache.get(countryCode);
  if (!promise) {
    promise = fetchJson<{ regions: GeoRegion[] }>(`/geo/${countryCode}.json`)
      .then((data) => data.regions)
      .catch((error) => {
        regionsCache.delete(countryCode);
        throw error;
      });
    regionsCache.set(countryCode, promise);
  }
  return promise;
}

/** Comparaison souple pour la recherche : sans accents, sans majuscules, sans tirets. */
export function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-'’.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Retrouve un pays à partir d'un nom déjà enregistré (ex. ancien brouillon). */
export function findCountry(countries: GeoCountry[], name: string): GeoCountry | undefined {
  const target = normalizePlace(name);
  if (!target) return undefined;
  return countries.find((c) => normalizePlace(c.name) === target);
}
