// YONA — Phase 11 / Étape 11.5 — Vérification du filtre distance.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.5-filtre-distance.mjs
// La position de l'appareil est simulée (Playwright `geolocation`).
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";
import { cardNames, invalid, search } from "../outils/base-recherche.mjs";

const { check, finish } = createChecker();
const P = "Re";
const { id, emails, PWD, cleanup } = createAccounts("r115", {
  v: ["male", "Repaul"],
  w: ["male", "Rewill"],
  a: ["female", "Reana"],
  b: ["female", "Rebea"],
  c: ["female", "Recleo"],
  d: ["female", "Redina"],
  n: ["female", "Renone"],
});
// Positions (enregistrées comme par l'application) : Douala centre, un autre point de Douala (~13 km),
// Yaoundé (~200 km), Libreville (~480 km), Dakar (~4 000 km).
const setLoc = (u, lat, lng) =>
  sql(`insert into public.profile_locations (user_id, latitude, longitude) values ('${id[u]}', ${lat}, ${lng})
       on conflict (user_id) do update set latitude = ${lat}, longitude = ${lng}`);
setLoc("a", 4.08, 9.66);
setLoc("b", 3.87, 11.52);
setLoc("c", 0.42, 9.47);
setLoc("d", 14.72, -17.47);
const tv = await tokenOf(emails.v, PWD);
const tw = await tokenOf(emails.w, PWD);
const s = (f, t = tv) => search(t, f, P);

// A. Position de Repaul : enregistrée par la fonction serveur, arrondie à ~1 km
let r = await rest(tv, "rpc/search_profiles", "POST", { _filters: { max_distance_km: 50 } });
check(
  "Distance sans position enregistrée : refus « location_required »",
  r.status >= 400 && r.text.includes("location_required"),
  r.text.slice(0, 80),
);
r = await rest(tv, "rpc/set_my_location", "POST", { _latitude: 4.051234, _longitude: 9.767891 });
check(
  "set_my_location : position enregistrée arrondie à 0,01° (4.05, 9.77)",
  r.status < 300 &&
    sql(
      `select latitude || ',' || longitude from public.profile_locations where user_id='${id.v}'`,
    ) === "4.05,9.77",
  sql(`select latitude || ',' || longitude from public.profile_locations where user_id='${id.v}'`),
);
for (const [label, body] of [
  ["latitude 91", { _latitude: 91, _longitude: 0 }],
  ["longitude -181", { _latitude: 0, _longitude: -181 }],
  ["valeur nulle", { _latitude: null, _longitude: 9 }],
]) {
  r = await rest(tv, "rpc/set_my_location", "POST", body);
  check(
    `Position refusée : ${label}`,
    r.status >= 400 && /invalid_location|null/.test(r.text),
    `${r.status} ${r.text.slice(0, 60)}`,
  );
}
r = await rest(null, "rpc/set_my_location", "POST", { _latitude: 1, _longitude: 1 });
check("set_my_location sans connexion : refusé", r.status >= 400, `${r.status}`);

// B. Recherche
const d = (u) =>
  Number(
    sql(
      `select round(public.distance_km(4.05, 9.77, l.latitude, l.longitude)::numeric) from public.profile_locations l where user_id='${id[u]}'`,
    ),
  );
const km = { a: d("a"), b: d("b"), c: d("c"), d: d("d") };
const expect = (radius) =>
  Object.entries(km)
    .filter(([, v]) => v <= radius)
    .map(([k]) => ({ a: "Reana", b: "Rebea", c: "Recleo", d: "Redina" })[k])
    .sort()
    .join(",");
for (const radius of [10, 25, 250, 500]) {
  r = await s({ max_distance_km: radius });
  check(
    `${radius} km : ${expect(radius) || "aucun"} (distances ${JSON.stringify(km)})`,
    r.names?.join(",") === expect(radius),
    r.names?.join(","),
  );
}
check(
  "Distances réelles cohérentes (Douala–Yaoundé ≈ 200 km, Douala–Libreville ≈ 400 à 500 km)",
  km.b > 180 && km.b < 220 && km.c > 380 && km.c < 520,
  JSON.stringify(km),
);
check(
  "Profil sans position : jamais dans un filtre de distance",
  !(await s({ max_distance_km: 500 })).names?.includes("Renone"),
);
sql(`update public.profiles set country = 'Cameroun' where user_id in ('${id.a}','${id.b}');
     update public.profiles set country = 'Gabon' where user_id = '${id.c}'`);
r = await s({ max_distance_km: 500, country: "Cameroun" });
check(
  "Distance combinée au pays : 500 km + Cameroun → Reana, Rebea",
  r.names?.join(",") === "Reana,Rebea",
  r.names?.join(","),
);
r = await s({ max_distance_km: 500, country: "Gabon", gender: "female" });
check(
  "Distance combinée au pays et au sexe : 500 km + Gabon → Recleo",
  r.names?.join(",") === "Recleo",
  r.names?.join(","),
);
for (const [label, f] of [
  ["rayon libre 7 km", { max_distance_km: 7 }],
  ["rayon 1000 km", { max_distance_km: 1000 }],
  ["texte", { max_distance_km: "50" }],
  ["valeur nulle", { max_distance_km: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// C. Confidentialité
r = await rest(tw, `profile_locations?user_id=eq.${id.a}`);
check(
  "Un autre membre ne lit jamais la position de Reana",
  r.status === 200 && (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
r = await rest(tw, `profiles?user_id=eq.${id.a}&select=latitude,longitude`);
check(
  "Colonnes latitude/longitude du profil : toujours vides",
  JSON.stringify(r.json) === '[{"latitude":null,"longitude":null}]',
  r.text,
);
r = await rest(tv, `profiles?user_id=eq.${id.v}`, "PATCH", { latitude: 4.05, longitude: 9.77 });
check(
  "Écrire sa position dans le profil : ignorée (reste vide)",
  sql(
    `select latitude is null and longitude is null from public.profiles where user_id='${id.v}'`,
  ) === "t",
  `${r.status}`,
);
r = await rest(tv, "profile_locations", "POST", { user_id: id.v, latitude: 1, longitude: 1 });
check("Écrire directement dans la table des positions : refusé", r.status >= 400, `${r.status}`);
r = await rest(tv, `profile_locations?user_id=eq.${id.v}`, "PATCH", { latitude: 1 });
check("Modifier directement sa position : refusé", r.status >= 400, `${r.status}`);
r = await rest(tv, `profile_locations?user_id=eq.${id.v}&select=latitude`);
check("Chacun lit sa propre position", (r.json ?? []).length === 1, r.text);

// D. Interface : profil (position de l'appareil simulée) puis recherche
const { browser, jsErrors, login } = await openBrowser();
const pw = await login(emails.w, PWD);
await pw.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pw.getByTestId("search-form").waitFor({ timeout: 8000 });
check(
  "Sans position : champ Distance désactivé et lien vers le profil",
  (await pw.getByLabel("Distance").isDisabled()) &&
    (await pw.getByTestId("distance-hint").textContent()).includes("enregistrez votre position"),
);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 800 },
  geolocation: { latitude: 4.0612, longitude: 9.7856 },
  permissions: ["geolocation"],
});
const pg = await ctx.newPage();
pg.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await pg.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await pg.fill("#email", emails.w);
await pg.fill("#password", PWD);
await pg.click("button[type=submit]");
await pg.waitForURL(/\/discover$/, { timeout: 10000 });
await pg.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pg.getByTestId("my-location").waitFor({ timeout: 8000 });
check(
  "Profil : « Aucune position enregistrée. »",
  (await pg.getByTestId("my-location-status").textContent()).includes(
    "Aucune position enregistrée.",
  ),
);
await pg.getByRole("button", { name: "Utiliser ma position actuelle" }).click();
const t = await toastText(pg);
await pg.waitForTimeout(800);
check(
  "« Utiliser ma position actuelle » : « Position enregistrée. », arrondie (4.06, 9.79)",
  t.includes("Position enregistrée.") &&
    sql(
      `select latitude || ',' || longitude from public.profile_locations where user_id='${id.w}'`,
    ) === "4.06,9.79" &&
    (await pg.getByTestId("my-location-status").textContent()).includes("Enregistrée le"),
  t,
);
await pg.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pg.getByTestId("search-form").waitFor({ timeout: 8000 });
await pg.waitForTimeout(600);
check(
  "Recherche : champ Distance activé, 7 rayons proposés",
  !(await pg.getByLabel("Distance").isDisabled()) &&
    (await pg.getByLabel("Distance").locator("option").count()) === 8,
);
await pg.getByLabel("Sexe — je cherche").selectOption("");
await pg.getByLabel("Distance").selectOption("250");
await pg.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pg, P);
check(
  "Page, « À moins de 250 km » : Reana, Rebea, Repaul",
  names.join(",") === "Reana,Rebea,Repaul",
  names.join(","),
);
await pg.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pg.getByRole("button", { name: "Retirer ma position" }).click();
await toastText(pg);
await pg.waitForTimeout(800);
check(
  "« Retirer ma position » : position supprimée",
  sql(`select count(*) from public.profile_locations where user_id='${id.w}'`) === "0",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes et positions de test supprimés",
  cleanup() &&
    sql(
      `select count(*) from public.profile_locations where user_id in ('${Object.values(id).join("','")}')`,
    ) === "0",
);
finish();
