// Fuseau horaire → pays possibles (tâche E : indice d'incohérence de localisation).
// Source : base IANA des fuseaux horaires (tzdata, domaine public), fichiers zone1970.tab,
// zone.tab et liens de tzdata.zi (ex. Africa/Libreville → Africa/Lagos : Nigeria, Gabon,
// Cameroun, Congo…). Affiche l'instruction SQL à placer dans la migration de localisation.
// Utilisation : node scripts/generate-timezones.mjs [/usr/share/zoneinfo]
import { readFileSync } from "node:fs";

const dir = process.argv[2] ?? "/usr/share/zoneinfo";
const lines = (f) =>
  readFileSync(`${dir}/${f}`, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"));
const map = new Map();
const add = (tz, codes) => {
  const set = map.get(tz) ?? new Set();
  for (const c of codes) set.add(c);
  map.set(tz, set);
};
for (const l of lines("zone1970.tab")) {
  const [codes, , tz] = l.split("\t");
  add(tz, codes.split(","));
}
for (const l of lines("zone.tab")) {
  const [code, , tz] = l.split("\t");
  add(tz, [code]);
}
// Liens (anciens noms, villes rattachées) : mêmes pays que la cible, plus leur propre pays.
for (const l of readFileSync(`${dir}/tzdata.zi`, "utf8").split("\n")) {
  if (!l.startsWith("L ")) continue;
  const [, target, name] = l.split(" ");
  if (map.has(target)) add(name, map.get(target));
}
add("UTC", []);
const rows = [...map]
  .filter(([, set]) => set.size)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(
    ([tz, set]) =>
      `  ('${tz}', ARRAY[${[...set]
        .sort()
        .map((c) => `'${c}'`)
        .join(", ")}])`,
  );
console.log(
  `INSERT INTO public.geo_timezones (tz, country_codes) VALUES\n${rows.join(",\n")}\n` +
    "ON CONFLICT (tz) DO UPDATE SET country_codes = EXCLUDED.country_codes;",
);
