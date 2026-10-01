// YONA — Phase 11 / Étape 11.4 — Vérification du filtre ville.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.4-filtre-ville.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";
import { cardNames, invalid, search } from "../outils/base-recherche.mjs";

const { check, finish } = createChecker();
const P = "Rd";
const { id, emails, PWD, cleanup } = createAccounts("r114", {
  v: ["male", "Rdpaul"],
  a: ["female", "Rdana"],
  b: ["female", "Rdbea"],
  c: ["female", "Rdcleo"],
  d: ["female", "Rddina"],
  e: ["female", "Rdeva"],
  f: ["female", "Rdfaye"],
  n: ["female", "Rdnone"],
});
const place = (u, city, country) =>
  sql(
    `update public.profiles set city = ${city === null ? "null" : `'${city.replace(/'/g, "''")}'`}, country = '${country}' where user_id='${id[u]}'`,
  );
place("a", "Yaoundé", "Cameroun");
place("b", "YAOUNDE", "Cameroun");
place("c", "Douala 5e", "Cameroun");
place("d", "Douala", "Cameroun");
place("e", "Saint-Louis", "Sénégal");
place("f", "Libreville", "Gabon");
place("n", null, "Gabon");
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ city: "yaounde" });
check("« yaounde » : Yaoundé et YAOUNDE", r.names?.join(",") === "Rdana,Rdbea", r.names?.join(","));
r = await s({ city: "Douala" });
check(
  "« Douala » : Douala et Douala 5e",
  r.names?.join(",") === "Rdcleo,Rddina",
  r.names?.join(","),
);
r = await s({ city: "saint louis" });
check("« saint louis » : Saint-Louis (tiret)", r.names?.join(",") === "Rdeva", r.names?.join(","));
r = await s({ city: "Libre" });
check("Début de nom « Libre » : Libreville", r.names?.join(",") === "Rdfaye", r.names?.join(","));
r = await s({ city: "Lagos" });
check("Ville sans profil : aucun résultat", r.status === 200 && r.names?.length === 0);
check(
  "Profil sans ville : jamais dans un filtre de ville",
  !(await s({ city: "e" })).names?.includes("Rdnone"),
);
r = await s({ city: "%" });
check(
  "« % » n'est plus un joker : aucun résultat",
  r.status === 200 && r.names?.length === 0,
  r.names?.join(","),
);
r = await s({ city: "_" });
check(
  "« _ » n'est plus un joker : aucun résultat",
  r.status === 200 && r.names?.length === 0,
  r.names?.join(","),
);
r = await s({ city: "douala", country: "Cameroun" });
check("Ville combinée au pays", r.names?.join(",") === "Rdcleo,Rddina", r.names?.join(","));
r = await s({ city: "douala", country: "Gabon" });
check("Ville d'un autre pays : aucun résultat", r.names?.length === 0);
for (const [label, f] of [
  ["texte vide", { city: "" }],
  ["espaces seuls", { city: "  " }],
  ["plus de 100 caractères", { city: "y".repeat(101) }],
  ["nombre", { city: 5 }],
  ["valeur nulle", { city: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// B. Suggestions de villes
const cities = async (country) =>
  (
    (await rest(tv, "rpc/list_search_cities", "POST", country ? { _country: country } : {})).json ??
    []
  )
    .map((x) => `${x.city}:${x.profiles}`)
    .filter((x) => /yaound|douala|louis|libreville/i.test(x));
let list = await cities();
check(
  "Villes proposées : « Yaoundé » une seule fois (2 profils), Douala, Douala 5e, Libreville, Saint-Louis",
  list.join(",") === "Yaoundé:2,Douala 5e:1,Douala:1,Libreville:1,Saint-Louis:1" ||
    list.join(",") === "Yaoundé:2,Douala:1,Douala 5e:1,Libreville:1,Saint-Louis:1",
  list.join(","),
);
list = await cities("cameroun");
check(
  "Villes limitées au pays « cameroun »",
  list.join(",").startsWith("Yaoundé:2") && list.length === 3,
  list.join(","),
);
r = await rest(null, "rpc/list_search_cities", "POST", {});
check("Liste des villes : visiteur refusé", r.status >= 400, `${r.status}`);

// C. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.getByLabel("Pays").fill("Cameroun");
await pv.waitForTimeout(1200);
const opts = await pv.locator("#search-cities option").evaluateAll((o) => o.map((x) => x.value));
check(
  "Pays « Cameroun » saisi : villes suggérées de ce pays seulement",
  opts.includes("Yaoundé") && opts.includes("Douala") && !opts.includes("Libreville"),
  opts.join(" | "),
);
await pv.getByLabel("Ville").fill("yaounde");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Page, Cameroun + « yaounde » : Rdana, Rdbea",
  names.join(",") === "Rdana,Rdbea",
  names.join(","),
);
check(
  "Ville et pays affichés sur la carte",
  (await pv.locator("article").filter({ hasText: "Rdana " }).textContent()).includes(
    "Yaoundé, Cameroun",
  ),
);
await pv.getByLabel("Pays").fill("");
await pv.getByLabel("Ville").fill("");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check("Champs vidés : tous les profils", names.length === 7, names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
