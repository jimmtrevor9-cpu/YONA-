// Génère la base géographique de l'étape « Où es-tu ? » (public/geo/).
//
// Sources (aucune donnée saisie à la main) :
//   - villes et régions : GeoNames (geonames.org, licence CC BY 4.0), via le paquet
//     npm « cities.json » (villes de 1 000 habitants et plus, avec leur région) ;
//   - noms des pays en français : données Unicode CLDR intégrées à Node (Intl), sauf
//     trois noms courts déjà utilisés par YONA (RD Congo, Congo-Brazzaville, Centrafrique)
//     et une région dont l'accent est perdu dans la source (Ngounié, Gabon).
//
// Utilisation (une seule fois, le résultat est déjà dans le dépôt) :
//   npm install --no-save cities.json && node scripts/generate-geo.mjs
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const base = process.env.CITIES_JSON_PATH || "cities.json";
const cities = require(`${base}/cities.json`);
const admin1 = require(`${base}/admin1.json`);

const OUT = new URL("../public/geo/", import.meta.url);
const NAME_OVERRIDES = { CD: "RD Congo", CG: "Congo-Brazzaville", CF: "Centrafrique" };
const OTHER_REGION = "Autres villes";
const frenchNames = new Intl.DisplayNames(["fr"], { type: "region" });
const collator = new Intl.Collator("fr", { sensitivity: "base" });
const clean = (s) => s.replace(/’/g, "'").replace(/\s+/g, " ").trim();

// Correction d'un nom mal encodé dans la source (accent perdu).
const REGION_FIXES = { "GA.04": "Ngounié" };
const regionNames = new Map(admin1.map((a) => [a.code, REGION_FIXES[a.code] ?? clean(a.name)]));

// Pays → région → villes (sans doublon), avec la position moyenne du pays.
const byCountry = new Map();
for (const city of cities) {
  const code = city.country;
  if (!code) continue;
  let entry = byCountry.get(code);
  if (!entry) {
    entry = { regions: new Map(), lat: 0, lng: 0, n: 0 };
    byCountry.set(code, entry);
  }
  entry.lat += Number(city.lat);
  entry.lng += Number(city.lng);
  entry.n += 1;
  const region = regionNames.get(`${code}.${city.admin1}`) ?? OTHER_REGION;
  if (!entry.regions.has(region)) entry.regions.set(region, new Set());
  entry.regions.get(region).add(clean(city.name));
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Tous les pays reconnus (codes ISO à deux lettres), même sans ville dans la base.
const allCodes = new Set(byCountry.keys());
for (const a of admin1) allCodes.add(a.code.split(".")[0]);

const countries = [];
let regionCount = 0;
let cityCount = 0;
for (const code of allCodes) {
  const fr = frenchNames.of(code);
  if (!fr || fr === code) continue;
  const entry = byCountry.get(code);
  const regions = entry
    ? [...entry.regions.entries()]
        .map(([name, set]) => ({ name, cities: [...set].sort(collator.compare) }))
        .sort((a, b) =>
          a.name === OTHER_REGION
            ? 1
            : b.name === OTHER_REGION
              ? -1
              : collator.compare(a.name, b.name),
        )
    : [];
  regionCount += regions.length;
  for (const r of regions) cityCount += r.cities.length;
  countries.push({
    code,
    name: clean(NAME_OVERRIDES[code] ?? fr),
    lat: entry ? Number((entry.lat / entry.n).toFixed(2)) : 0,
    lng: entry ? Number((entry.lng / entry.n).toFixed(2)) : 0,
  });
  writeFileSync(new URL(`${code}.json`, OUT), JSON.stringify({ regions }));
}
countries.sort((a, b) => collator.compare(a.name, b.name));
writeFileSync(new URL("countries.json", OUT), JSON.stringify(countries));
console.log(`${countries.length} pays, ${regionCount} régions, ${cityCount} villes.`);
