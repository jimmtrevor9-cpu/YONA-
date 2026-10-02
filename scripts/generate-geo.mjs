// Prépare les listes Pays / Province-région / Ville de l'étape 3 de l'inscription.
// Source : le paquet country-state-city (données locales, aucun appel à une API).
// Résultat : public/geo/countries.json (tous les pays, noms en français) et un fichier
// public/geo/<CODE>.json par pays (ses régions et leurs villes). Le navigateur ne charge
// que le fichier du pays choisi. Lancé automatiquement avant « npm run dev » et « npm run build ».
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import csc from "country-state-city";

const { Country, State, City } = csc;
const OUT = join(process.cwd(), "public", "geo");
mkdirSync(OUT, { recursive: true });

const names = new Intl.DisplayNames(["fr"], { type: "region" });
// Noms déjà utilisés par YONA (avant cette liste complète) : gardés pour rester cohérents.
const NAME_OVERRIDES = { CG: "Congo", CD: "RD Congo" };
const byName = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base" });
const unique = (list) => [...new Set(list)].sort(byName);

const countries = Country.getAllCountries()
  .map((c) => {
    let name = c.name;
    try {
      name = NAME_OVERRIDES[c.isoCode] ?? names.of(c.isoCode) ?? c.name;
    } catch {
      // Code inconnu de la traduction : on garde le nom d'origine.
    }
    return { code: c.isoCode, name: name.replace(/’/g, "'") };
  })
  .sort((a, b) => byName(a.name, b.name));

writeFileSync(join(OUT, "countries.json"), JSON.stringify(countries));

for (const { code } of countries) {
  const regions = State.getStatesOfCountry(code)
    .map((s) => ({
      name: s.name,
      cities: unique(City.getCitiesOfState(code, s.isoCode).map((c) => c.name)),
    }))
    .sort((a, b) => byName(a.name, b.name));
  writeFileSync(join(OUT, `${code}.json`), JSON.stringify({ regions }));
}

console.log(`geo : ${countries.length} pays écrits dans public/geo`);
