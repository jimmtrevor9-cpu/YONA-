// YONA — Phase 11 / Étape 11.6 — Vérification du filtre situation matrimoniale.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.6-filtre-situation.mjs
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
const P = "Rf";
const { id, emails, PWD, cleanup } = createAccounts("r116", {
  v: ["male", "Rfpaul"],
  a: ["female", "Rfana"],
  b: ["female", "Rfbea"],
  c: ["female", "Rfcleo"],
  n: ["female", "Rfnone"],
});
const setMs = (u, v) =>
  sql(`update public.profiles set marital_status = '${v}' where user_id='${id[u]}'`);
setMs("a", "never_married");
setMs("b", "divorced");
setMs("c", "widowed");
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Base : valeurs autorisées
let r = await rest(tv, `profiles?user_id=eq.${id.v}`, "PATCH", { marital_status: "married" });
check(
  "Valeur non prévue (« married ») refusée par la base",
  r.status >= 400 && r.text.includes("profiles_marital_status_check"),
  `${r.status}`,
);
r = await rest(tv, `profiles?user_id=eq.${id.v}`, "PATCH", { marital_status: "divorced" });
check(
  "Valeur prévue acceptée",
  r.status < 300 &&
    sql(`select marital_status from public.profiles where user_id='${id.v}'`) === "divorced",
);

// B. Recherche
r = await s({ marital_status: ["never_married"] });
check("Jamais marié·e : Rfana", r.names?.join(",") === "Rfana", r.names?.join(","));
r = await s({ marital_status: ["divorced", "widowed"] });
check(
  "Divorcé·e ou veuf / veuve : Rfbea, Rfcleo",
  r.names?.join(",") === "Rfbea,Rfcleo",
  r.names?.join(","),
);
r = await s({ marital_status: ["never_married", "divorced", "widowed"] });
check(
  "Les trois : tous sauf le profil non précisé",
  r.names?.join(",") === "Rfana,Rfbea,Rfcleo",
  r.names?.join(","),
);
r = await s({});
check("Sans filtre : le profil non précisé est inclus", r.names?.includes("Rfnone"));
r = await s({ marital_status: ["widowed"], gender: "female", min_age: 30, max_age: 40 });
check("Combiné au sexe et à l'âge", r.names?.join(",") === "Rfcleo", r.names?.join(","));
for (const [label, f] of [
  ["valeur inconnue", { marital_status: ["married"] }],
  ["texte au lieu d'une liste", { marital_status: "divorced" }],
  ["liste vide", { marital_status: [] }],
  ["doublon", { marital_status: ["divorced", "divorced"] }],
  ["nombre dans la liste", { marital_status: [1] }],
  ["valeur nulle", { marital_status: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// C. Pages
const { browser, jsErrors, login } = await openBrowser();
const pc = await login(emails.c, PWD);
await pc.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pc.getByLabel("Situation matrimoniale").waitFor({ timeout: 8000 });
await pc.waitForTimeout(600);
check(
  "Profil : situation actuelle affichée (Veuf / veuve)",
  (await pc.getByLabel("Situation matrimoniale").inputValue()) === "widowed",
);
check(
  "Profil : choix proposés (Non précisée, Célibataire…, Divorcé·e, Veuf / veuve)",
  (await pc.getByLabel("Situation matrimoniale").locator("option").allTextContents()).join("|") ===
    "Non précisée|Célibataire, jamais marié·e|Divorcé·e|Veuf / veuve",
);
await pc.getByLabel("Situation matrimoniale").selectOption("divorced");
await pc.getByRole("button", { name: "Enregistrer" }).click();
const t = await toastText(pc);
check(
  "Profil : changement enregistré (Divorcé·e)",
  t.includes("Profil enregistré.") &&
    sql(`select marital_status from public.profiles where user_id='${id.c}'`) === "divorced",
  t,
);
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.getByLabel("Situation matrimoniale").selectOption("divorced");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Recherche « Divorcé·e » : Rfbea et Rfcleo (qui vient de changer)",
  names.join(",") === "Rfbea,Rfcleo",
  names.join(","),
);
await pv.getByLabel("Situation matrimoniale").selectOption("");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check("« Indifférente » : tous les profils", names.length === 4, names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
