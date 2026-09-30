// YONA — Phase 11 / Étape 11.2 — Vérification du filtre sexe.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.2-filtre-sexe.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";
import { cardNames, invalid, search } from "../outils/base-recherche.mjs";

const { check, finish } = createChecker();
const P = "Rb";
const { id, emails, PWD, cleanup } = createAccounts("r112", {
  v: ["male", "Rbpaul"],
  w: ["female", "Rbwendy"],
  a: ["female", "Rbana"],
  b: ["female", "Rbbea"],
  c: ["male", "Rbcyr"],
  d: ["male", "Rbdan"],
  n: ["female", "Rbnoel"],
});
// Profil sans sexe renseigné (données anciennes).
sql(`alter table public.profiles disable trigger user;
     update public.profiles set gender = null where user_id='${id.n}';
     alter table public.profiles enable trigger user;`);
// Préférence enregistrée de Rbpaul : il cherche une femme. Rbwendy : aucune préférence de sexe.
sql(`insert into public.preferences (user_id, preferred_gender) values ('${id.v}', 'female')
     on conflict (user_id) do update set preferred_gender = 'female'`);
sql(`insert into public.preferences (user_id, preferred_gender) values ('${id.w}', null)
     on conflict (user_id) do update set preferred_gender = null`);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ gender: "female" });
check(
  "Femmes : Rbana, Rbbea, Rbwendy",
  r.names?.join(",") === "Rbana,Rbbea,Rbwendy",
  r.names?.join(","),
);
r = await s({ gender: "male" });
check(
  "Hommes : Rbcyr, Rbdan (jamais soi-même)",
  r.names?.join(",") === "Rbcyr,Rbdan",
  r.names?.join(","),
);
r = await s({});
check(
  "Indifférent (sans filtre) : tous, y compris le profil sans sexe renseigné",
  r.names?.join(",") === "Rbana,Rbbea,Rbcyr,Rbdan,Rbnoel,Rbwendy",
  r.names?.join(","),
);
check(
  "Profil sans sexe renseigné : jamais dans un filtre de sexe",
  !(await s({ gender: "female" })).names?.includes("Rbnoel") &&
    !(await s({ gender: "male" })).names?.includes("Rbnoel"),
);
for (const [label, f] of [
  ["valeur inconnue « other »", { gender: "other" }],
  ["majuscules « FEMALE »", { gender: "FEMALE" }],
  ["texte vide", { gender: "" }],
  ["nombre", { gender: 1 }],
  ["valeur nulle", { gender: null }],
  ["liste", { gender: ["female", "male"] }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await s({ gender: "female", min_age: 30, max_age: 40 });
check(
  "Sexe combiné à l'âge : Rbana, Rbbea, Rbwendy (34 ans)",
  r.names?.join(",") === "Rbana,Rbbea,Rbwendy",
  r.names?.join(","),
);

// B. Page Recherche
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
let names = await cardNames(pv, P);
check(
  "Rbpaul (préférence : une femme) : « Une femme » présélectionné, seules les femmes affichées",
  (await pv.getByLabel("Sexe — je cherche").inputValue()) === "female" &&
    names.join(",") === "Rbana,Rbbea,Rbwendy",
  names.join(","),
);
await pv.getByLabel("Sexe — je cherche").selectOption("male");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check("Choix « Un homme » : Rbcyr, Rbdan", names.join(",") === "Rbcyr,Rbdan", names.join(","));
await pv.getByLabel("Sexe — je cherche").selectOption("");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check("Choix « Indifférent » : les 6 profils", names.length === 6, names.join(","));
check(
  "Options proposées : Indifférent, Une femme, Un homme",
  (await pv.getByLabel("Sexe — je cherche").locator("option").allTextContents()).join(",") ===
    "Indifférent,Une femme,Un homme",
);
const pw = await login(emails.w, PWD);
await pw.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pw.getByTestId("search-form").waitFor({ timeout: 8000 });
names = await cardNames(pw, P);
check(
  "Rbwendy (aucune préférence) : « Indifférent », tous les profils sauf elle-même",
  (await pw.getByLabel("Sexe — je cherche").inputValue()) === "" &&
    names.length === 6 &&
    !names.includes("Rbwendy"),
  names.join(","),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
