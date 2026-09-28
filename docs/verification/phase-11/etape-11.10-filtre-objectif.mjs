// YONA — Phase 11 / Étape 11.10 — Vérification du filtre objectif relationnel.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.10-filtre-objectif.mjs
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
const P = "Rj";
const { id, emails, PWD, cleanup } = createAccounts("r1110", {
  v: ["male", "Rjpaul"],
  a: ["female", "Rjana"],
  b: ["female", "Rjbea"],
  c: ["female", "Rjcleo"],
  n: ["female", "Rjnone"],
});
const goal = (u, v) =>
  sql(`insert into public.preferences (user_id, relationship_goal) values ('${id[u]}', '${v.replace(/'/g, "''")}')
       on conflict (user_id) do update set relationship_goal = excluded.relationship_goal`);
goal("a", "Une relation menant au mariage");
goal("b", "MARIAGE chrétien");
goal("c", "Amitié sincère d'abord");
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ relationship_goal: "mariage" });
check(
  "« mariage » : Rjana et Rjbea (casse ignorée)",
  r.names?.join(",") === "Rjana,Rjbea",
  r.names?.join(","),
);
r = await s({ relationship_goal: "amitie" });
check("« amitie » (sans accent) : Rjcleo", r.names?.join(",") === "Rjcleo", r.names?.join(","));
r = await s({ relationship_goal: "mariage", gender: "female", min_age: 30 });
check("Combiné au sexe et à l'âge", r.names?.join(",") === "Rjana,Rjbea", r.names?.join(","));
check(
  "Profil sans objectif : jamais retenu",
  !(await s({ relationship_goal: "a" })).names?.includes("Rjnone"),
);
for (const [label, f] of [
  ["texte vide", { relationship_goal: "" }],
  ["plus de 100 caractères", { relationship_goal: "a".repeat(101) }],
  ["nombre", { relationship_goal: 1 }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
// Confidentialité : les préférences restent privées.
r = await rest(tv, `preferences?user_id=eq.${id.a}`);
check(
  "Les préférences de Rjana restent illisibles par Rjpaul",
  r.status === 200 && (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
r = await rest(tv, "rpc/list_search_values", "POST", { _field: "relationship_goal" });
check("Aucune liste de suggestions pour ce champ privé", invalid(r), `${r.status}`);
r = await rest(tv, "rpc/search_profiles", "POST", { _filters: { relationship_goal: "mariage" } });
check(
  "La recherche ne renvoie pas l'objectif lui-même",
  r.status === 200 && !r.text.includes("relation menant") && !r.text.includes("relationship_goal"),
);

// B. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
check(
  "Champ « Objectif relationnel » sans liste de suggestions",
  (await pv.getByLabel("Objectif relationnel").getAttribute("list")) === null,
);
await pv.getByLabel("Objectif relationnel").fill("Mariage");
await pv.getByRole("button", { name: "Rechercher" }).click();
const names = await cardNames(pv, P);
check("Page, « Mariage » : Rjana, Rjbea", names.join(",") === "Rjana,Rjbea", names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
