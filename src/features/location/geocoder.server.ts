/**
 * Géocodage du serveur (tâche E), sans service extérieur : les positions des villes
 * (GeoNames, licence CC BY 4.0, scripts/generate-geo-positions.mjs) sont embarquées dans le
 * code du serveur et chargées pays par pays, seulement quand il le faut.
 *  - reverseGeocode : position GPS → ville la plus proche, région, pays ;
 *  - locateDeclared : ville choisie à l'étape « Où es-tu ? » → position de cette ville.
 */
interface CountryFile {
  /** Régions du pays. */
  r: string[];
  /** Villes : [nom, n° de région, latitude, longitude]. */
  c: [string, number, number, number][];
}
interface IndexFile {
  /** Code ISO → nom du pays (mêmes noms que la liste de l'étape « Où es-tu ? »). */
  n: Record<string, string>;
  /** Carré de 1° « lat:lng » → pays qui y ont des villes (« GA,CM »). */
  g: Record<string, string>;
}

const countryLoaders = import.meta.glob<CountryFile>("./data/[A-Z][A-Z].json", {
  import: "default",
});
let indexPromise: Promise<IndexFile> | null = null;
const countryCache = new Map<string, Promise<CountryFile | null>>();

function loadIndex(): Promise<IndexFile> {
  indexPromise ??= import("./data/index.json").then((m) => m.default as IndexFile);
  return indexPromise;
}

function loadCountry(code: string): Promise<CountryFile | null> {
  let p = countryCache.get(code);
  if (!p) {
    const loader = countryLoaders[`./data/${code}.json`];
    p = loader ? loader().catch(() => null) : Promise.resolve(null);
    countryCache.set(code, p);
  }
  return p;
}

/** Comparaison des noms sans accents ni ponctuation (« Lambaréné » = « lambarene »). */
export function normalizePlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Place {
  countryCode: string;
  country: string;
  region: string | null;
  city: string;
  latitude: number;
  longitude: number;
  /** Distance entre la position donnée et la ville trouvée (géocodage inverse). */
  distanceKm: number;
}

/** Position → ville la plus proche (et son pays). null si aucune ville à moins de 300 km. */
export async function reverseGeocode(latitude: number, longitude: number): Promise<Place | null> {
  const index = await loadIndex();
  const cellLat = Math.floor(latitude);
  const cellLng = Math.floor(longitude);
  for (const radius of [1, 3]) {
    const codes = new Set<string>();
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        let lng = cellLng + dx;
        if (lng < -180) lng += 360;
        if (lng >= 180) lng -= 360;
        const found = index.g[`${cellLat + dy}:${lng}`];
        if (found) for (const code of found.split(",")) codes.add(code);
      }
    }
    if (!codes.size) continue;
    let best: Place | null = null;
    for (const code of codes) {
      const file = await loadCountry(code);
      if (!file) continue;
      for (const [name, ri, lat, lng] of file.c) {
        // Filtre rapide avant le calcul exact.
        if (Math.abs(lat - latitude) > radius + 1) continue;
        const d = distanceKm(latitude, longitude, lat, lng);
        if (!best || d < best.distanceKm) {
          best = {
            countryCode: code,
            country: index.n[code] ?? code,
            region: file.r[ri] ?? null,
            city: name,
            latitude: lat,
            longitude: lng,
            distanceKm: d,
          };
        }
      }
    }
    if (best && best.distanceKm <= 300) return preferWholeCity(best, codes);
  }
  return null;
}

/**
 * Quartier numéroté (« Paris 04 Hôtel-de-Ville », « Lyon 03 ») : la ville elle-même
 * (« Paris ») si elle est à moins de 15 km.
 */
async function preferWholeCity(best: Place, codes: Set<string>): Promise<Place> {
  const words = normalizePlaceName(best.city).split(" ");
  if (words.length < 2) return best;
  const file = await loadCountry(best.countryCode);
  if (!file || !codes.has(best.countryCode)) return best;
  let whole: Place | null = null;
  for (const [name, ri, lat, lng] of file.c) {
    const n = normalizePlaceName(name);
    if (n === words.join(" ") || !words.join(" ").startsWith(`${n} `)) continue;
    const d = distanceKm(best.latitude, best.longitude, lat, lng);
    if (d <= 15 && (!whole || n.length > normalizePlaceName(whole.city).length)) {
      whole = {
        ...best,
        city: name,
        region: file.r[ri] ?? best.region,
        latitude: lat,
        longitude: lng,
      };
    }
  }
  return whole ?? best;
}

/** Code ISO d'un pays d'après son nom (« Gabon » → GA). */
export async function countryCodeOf(name: string | null | undefined): Promise<string | null> {
  if (!name?.trim()) return null;
  const index = await loadIndex();
  const key = normalizePlaceName(name);
  for (const [code, countryName] of Object.entries(index.n)) {
    if (normalizePlaceName(countryName) === key || code.toLowerCase() === key) return code;
  }
  return null;
}

/** Ville déclarée (pays, région, ville) → position de la ville. null si elle est inconnue. */
export async function locateDeclared(
  countryName: string | null | undefined,
  regionName: string | null | undefined,
  cityName: string | null | undefined,
): Promise<Place | null> {
  const code = await countryCodeOf(countryName);
  if (!code || !cityName?.trim()) return null;
  const file = await loadCountry(code);
  if (!file) return null;
  const index = await loadIndex();
  const city = normalizePlaceName(cityName);
  const region = regionName?.trim() ? normalizePlaceName(regionName) : null;
  let match: [string, number, number, number] | null = null;
  for (const entry of file.c) {
    if (normalizePlaceName(entry[0]) !== city) continue;
    if (region && normalizePlaceName(file.r[entry[1]] ?? "") === region) {
      match = entry;
      break;
    }
    match ??= entry;
  }
  if (!match) return null;
  return {
    countryCode: code,
    country: index.n[code] ?? code,
    region: file.r[match[1]] ?? null,
    city: match[0],
    latitude: match[2],
    longitude: match[3],
    distanceKm: 0,
  };
}
