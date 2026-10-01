// YONA — Phase 11 / Étape 11.3 — Vérification du filtre pays.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.3-filtre-pays.mjs
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
const P = "Rc";
const { id, emails, PWD, cleanup } = createAccounts("r113", {
  v: ["male", "Rcpaul"],
  a: ["female", "Rcana"],
  b: ["female", "Rcbea"],
  c: ["female", "Rccleo"],
  d: ["female", "Rcdina"],
  e: ["female", "Rceva"],
  n: ["female", "Rcnone"],
  h: ["female", "Rchide"],
});
const country = (u, c) =>
  sql(
    `update public.profiles set country = ${c === null ? "null" : `'${c.replace(/'/g, "''")}'`} where user_id='${id[u]}'`,
  );
country("a", "Côte d'Ivoire");
country("b", "cote-d’ivoire");
country("c", "  COTE  D IVOIRE ");
country("d", "Cameroun");
country("e", "Gabon");
country("n", null);
country("h", "Côte d'Ivoire");
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ country: "Côte d'Ivoire" });
check(
  "« Côte d'Ivoire » : les 3 écritures du même pays (accents, tiret, apostrophe typographique, majuscules, espaces)",
  r.names?.join(",") === "Rcana,Rcbea,Rccleo",
  r.names?.join(","),
);
r = await s({ country: "cote divoire" });
check(
  "Écriture différente (« cote divoire ») : pas de correspondance approximative",
  r.names?.length === 0,
  r.names?.join(","),
);
r = await s({ country: "cameroun" });
check("« cameroun » : Rcdina", r.names?.join(",") === "Rcdina", r.names?.join(","));
r = await s({ country: "Came" });
check(
  "Début de nom (« Came ») : pas de correspondance (pays exact)",
  r.names?.length === 0,
  r.names?.join(","),
);
r = await s({ country: "Sénégal" });
check("Pays sans profil : aucun résultat", r.status === 200 && r.names?.length === 0);
check(
  "Profil sans pays : jamais dans un filtre de pays",
  !(await s({ country: "Gabon" })).names?.includes("Rcnone"),
);
check("Profil masqué : exclu", !(await s({ country: "Côte d'Ivoire" })).names?.includes("Rchide"));
r = await s({ country: "Côte d'Ivoire", gender: "female", min_age: 30, max_age: 40 });
check(
  "Pays combiné au sexe et à l'âge",
  r.names?.join(",") === "Rcana,Rcbea,Rccleo",
  r.names?.join(","),
);
for (const [label, f] of [
  ["texte vide", { country: "" }],
  ["espaces seuls", { country: "   " }],
  ["plus de 100 caractères", { country: "x".repeat(101) }],
  ["nombre", { country: 237 }],
  ["valeur nulle", { country: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await s({ country: "%" });
check(
  "Caractère spécial « % » : traité comme du texte, aucun résultat",
  r.status === 200 && r.names?.length === 0,
);

// B. Liste d'aide à la saisie
r = await rest(tv, "rpc/list_search_countries", "POST", {});
const mine = (r.json ?? []).filter((x) => /ivoire|cameroun|gabon/i.test(x.country));
check(
  "Pays proposés : un seul « Côte d'Ivoire » (orthographe soignée, 3 profils visibles, le masqué non compté), Cameroun, Gabon",
  JSON.stringify(mine) ===
    JSON.stringify([
      { country: "Côte d'Ivoire", profiles: 3 },
      { country: "Cameroun", profiles: 1 },
      { country: "Gabon", profiles: 1 },
    ]),
  JSON.stringify(mine),
);
r = await rest(null, "rpc/list_search_countries", "POST", {});
check("Liste des pays : visiteur non connecté refusé", r.status >= 400, `${r.status}`);

// C. Page Recherche
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(800);
const options = await pv
  .locator("#search-countries option")
  .evaluateAll((o) => o.map((x) => x.value));
check(
  "Champ « Pays » avec suggestions des pays réellement renseignés",
  (await pv.getByLabel("Pays").count()) === 1 &&
    options.includes("Cameroun") &&
    options.includes("Gabon"),
  options.join(" | "),
);
await pv.getByLabel("Pays").fill("cote d'ivoire");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Page, « cote d'ivoire » : les 3 profils",
  names.join(",") === "Rcana,Rcbea,Rccleo",
  names.join(","),
);
check(
  "Pays affiché sur chaque carte",
  (await pv.locator("article").filter({ hasText: "Rcana " }).textContent()).includes(
    "Côte d'Ivoire",
  ),
);
await pv.getByLabel("Pays").fill("");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check("Pays vidé : tous les pays", names.length === 6, names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
