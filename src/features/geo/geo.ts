/**
 * Listes Pays / Province-région / Ville de l'inscription.
 * Les fichiers sont préparés à la construction du site (scripts/generate-geo.mjs) dans
 * public/geo : aucun appel à un service extérieur, et seul le pays choisi est chargé.
 */
export interface GeoCountry {
  code: string;
  name: string;
}

export interface GeoRegion {
  name: string;
  cities: string[];
}

const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(path: string): Promise<T> {
  let pending = cache.get(path) as Promise<T> | undefined;
  if (!pending) {
    pending = fetch(path).then((response) => {
      if (!response.ok) throw new Error(`geo ${response.status}`);
      return response.json() as Promise<T>;
    });
    // En cas d'échec, on pourra réessayer plus tard.
    pending.catch(() => cache.delete(path));
    cache.set(path, pending);
  }
  return pending;
}

export function loadCountries(): Promise<GeoCountry[]> {
  return loadJson<GeoCountry[]>("/geo/countries.json");
}

export async function loadRegions(countryCode: string): Promise<GeoRegion[]> {
  const data = await loadJson<{ regions: GeoRegion[] }>(`/geo/${countryCode}.json`);
  return data.regions;
}

/** Comparaison sans tenir compte des accents ni des majuscules (« cote » trouve « Côte »). */
export function normalizePlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
