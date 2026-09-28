// YONA — Phase 11 / Étape 11.11 — Vérification du filtre projet familial.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.11-filtre-projet-familial.mjs
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
const P = "Rk";
const { id, emails, PWD, cleanup } = createAccounts("r1111", {
  v: ["male", "Rkpaul"],
  a: ["female", "Rkana"],
  b: ["female", "Rkbea"],
  c: ["female", "Rkcleo"],
  n: ["female", "Rknone"],
});
const project = (u, v) =>
  sql(`insert into public.preferences (user_id, family_project, relationship_goal) values ('${id[u]}', '${v.replace(/'/g, "''")}', 'Mariage')
       on conflict (user_id) do update set family_project = excluded.family_project, relationship_goal = excluded.relationship_goal`);
project("a", "Fonder une famille et avoir des enfants");
project("b", "Avoir 3 ENFANTS, adopter peut-être");
project("c", "Pas d'enfant souhaité");
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ family_project: "enfants" });
check(
  "« enfants » : Rkana et Rkbea (casse ignorée)",
  r.names?.join(",") === "Rkana,Rkbea",
  r.names?.join(","),
);
r = await s({ family_project: "adopter" });
check("« adopter » : Rkbea", r.names?.join(",") === "Rkbea", r.names?.join(","));
r = await s({ family_project: "souhaite" });
check("« souhaite » (sans accent) : Rkcleo", r.names?.join(",") === "Rkcleo", r.names?.join(","));
r = await s({ family_project: "famille", relationship_goal: "mariage" });
check(
  "Combiné à l'objectif relationnel : Rkana",
  r.names?.join(",") === "Rkana",
  r.names?.join(","),
);
check(
  "Profil sans projet : jamais retenu",
  !(await s({ family_project: "a" })).names?.includes("Rknone"),
);
r = await s({ family_project: "x".repeat(200) });
check("200 caractères : accepté", r.status === 200, `${r.status}`);
for (const [label, f] of [
  ["texte vide", { family_project: "" }],
  ["plus de 200 caractères", { family_project: "x".repeat(201) }],
  ["objet", { family_project: { texte: "enfants" } }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await rest(tv, "rpc/search_profiles", "POST", { _filters: { family_project: "enfants" } });
check(
  "La recherche ne renvoie pas le projet lui-même",
  r.status === 200 && !r.text.includes("Fonder une famille"),
);

// B. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
check(
  "Champ « Projet familial » (200 caractères au plus, sans suggestions)",
  (await pv.getByLabel("Projet familial").getAttribute("maxlength")) === "200" &&
    (await pv.getByLabel("Projet familial").getAttribute("list")) === null,
);
await pv.getByLabel("Projet familial").fill("enfants");
await pv.getByRole("button", { name: "Rechercher" }).click();
const names = await cardNames(pv, P);
check("Page, « enfants » : Rkana, Rkbea", names.join(",") === "Rkana,Rkbea", names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
