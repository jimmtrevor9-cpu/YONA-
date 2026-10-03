// Génère les positions des villes utilisées par le SERVEUR pour la localisation des membres
// (tâche E) : géocodage inverse (position GPS → ville, région, pays) et position d'une ville
// déclarée. Mêmes sources et mêmes noms que la liste de l'étape « Où es-tu ? »
// (scripts/generate-geo.mjs) : GeoNames (licence CC BY 4.0) via le paquet npm « cities.json ».
//
// Sorties (dans le code du serveur, jamais envoyées au navigateur) :
//   src/features/location/data/<CODE>.json : { r: [régions], c: [[ville, n° de région, lat, lng], …] }
//   src/features/location/data/index.json   : { n: {code: nom du pays}, g: {"lat:lng": "GA,CM"} }
//     (carré de 1° × 1° → pays qui y ont des villes)
//
// Utilisation (une seule fois, le résultat est dans le dépôt) :
//   npm install --no-save cities.json && node scripts/generate-geo-positions.mjs
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const base = process.env.CITIES_JSON_PATH || "cities.json";
const cities = require(`${base}/cities.json`);
const admin1 = require(`${base}/admin1.json`);

const OUT = new URL("../src/features/location/data/", import.meta.url);
const OTHER_REGION = "Autres villes";
const clean = (s) => s.replace(/’/g, "'").replace(/\s+/g, " ").trim();
const REGION_FIXES = { "GA.04": "Ngounié" };
const regionNames = new Map(admin1.map((a) => [a.code, REGION_FIXES[a.code] ?? clean(a.name)]));
const round = (n) => Math.round(Number(n) * 100) / 100;

// Noms français des pays : ceux de la liste de l'étape « Où es-tu ? ».
const countries = JSON.parse(readFileSync(new URL("../public/geo/countries.json", import.meta.url), "utf8"));
const names = Object.fromEntries(countries.map((c) => [c.code, c.name]));

const byCountry = new Map();
const grid = new Map();
for (const city of cities) {
  const code = city.country;
  if (!code || !names[code]) continue;
  const lat = round(city.lat);
  const lng = round(city.lng);
  let entry = byCountry.get(code);
  if (!entry) {
    entry = { regions: new Map(), seen: new Set(), list: [] };
    byCountry.set(code, entry);
  }
  const region = regionNames.get(`${code}.${city.admin1}`) ?? OTHER_REGION;
  if (!entry.regions.has(region)) entry.regions.set(region, entry.regions.size);
  const name = clean(city.name);
  const key = `${name}|${region}`;
  if (entry.seen.has(key)) continue; // même ville en double dans la source : la première suffit
  entry.seen.add(key);
  entry.list.push([name, entry.regions.get(region), lat, lng]);
  const cell = `${Math.floor(lat)}:${Math.floor(lng)}`;
  const set = grid.get(cell) ?? new Set();
  set.add(code);
  grid.set(cell, set);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [code, entry] of byCountry) {
  const json = JSON.stringify({ r: [...entry.regions.keys()], c: entry.list });
  total += json.length;
  writeFileSync(new URL(`${code}.json`, OUT), json);
}
const index = JSON.stringify({
  n: names,
  g: Object.fromEntries([...grid].map(([cell, set]) => [cell, [...set].sort().join(",")])),
});
writeFileSync(new URL("index.json", OUT), index);
console.log(
  `${byCountry.size} pays, ${[...byCountry.values()].reduce((n, e) => n + e.list.length, 0)} villes, ` +
    `${grid.size} carrés ; ${(total / 1e6).toFixed(1)} Mo + index ${(index.length / 1e3).toFixed(0)} ko.`,
);
