// YONA — Phase 11 / Étape 11.8 — Vérification du filtre dénomination.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.8-filtre-denomination.mjs
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
const P = "Rh";
const { id, emails, PWD, cleanup } = createAccounts("r118", {
  v: ["male", "Rhpaul"],
  a: ["female", "Rhana"],
  b: ["female", "Rhbea"],
  c: ["female", "Rhcleo"],
  d: ["female", "Rhdina"],
  h: ["female", "Rhhide"],
  n: ["female", "Rhnone"],
});
const denom = (u, v) =>
  sql(`insert into public.christian_profiles (user_id, denomination) values ('${id[u]}', '${v.replace(/'/g, "''")}')
       on conflict (user_id) do update set denomination = excluded.denomination`);
denom("a", "Église évangélique");
denom("b", "EVANGELIQUE");
denom("c", "Catholique");
denom("d", "Église adventiste du 7e jour");
denom("h", "Évangélique");
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ denomination: "evangelique" });
check(
  "« evangelique » : Église évangélique et EVANGELIQUE (masqué exclu)",
  r.names?.join(",") === "Rhana,Rhbea",
  r.names?.join(","),
);
r = await s({ denomination: "Catholique" });
check("« Catholique » : Rhcleo", r.names?.join(",") === "Rhcleo", r.names?.join(","));
r = await s({ denomination: "adventiste" });
check("« adventiste » (mot contenu) : Rhdina", r.names?.join(",") === "Rhdina", r.names?.join(","));
r = await s({ denomination: "Église" });
check(
  "« Église » : les deux dénominations qui contiennent ce mot",
  r.names?.join(",") === "Rhana,Rhdina",
  r.names?.join(","),
);
r = await s({ denomination: "orthodoxe" });
check("Dénomination sans profil : aucun résultat", r.status === 200 && r.names?.length === 0);
check(
  "Profil sans dénomination : jamais retenu",
  !(await s({ denomination: "e" })).names?.includes("Rhnone"),
);
r = await s({ denomination: "evangelique", gender: "female", min_age: 30, max_age: 40 });
check("Combinée au sexe et à l'âge", r.names?.join(",") === "Rhana,Rhbea", r.names?.join(","));
for (const [label, f] of [
  ["texte vide", { denomination: "" }],
  ["plus de 100 caractères", { denomination: "a".repeat(101) }],
  ["nombre", { denomination: 3 }],
  ["valeur nulle", { denomination: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// B. Suggestions
r = await rest(tv, "rpc/list_search_values", "POST", { _field: "denomination" });
const mine = (r.json ?? []).filter((x) => /vang|catho|advent/i.test(x.value));
check(
  "Suggestions : « Église évangélique » (1), « EVANGELIQUE » (1), Catholique, adventiste — masqué non compté",
  mine.length === 4 && !mine.some((x) => x.value === "Évangélique"),
  JSON.stringify(mine),
);
r = await rest(tv, "rpc/list_search_values", "POST", { _field: "relationship_goal" });
check("Suggestions d'un champ non prévu : refus", invalid(r), `${r.status}`);
r = await rest(null, "rpc/list_search_values", "POST", { _field: "denomination" });
check("Suggestions : visiteur refusé", r.status >= 400, `${r.status}`);

// C. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(800);
const opts = await pv
  .locator("#searchDenomination-suggestions option")
  .evaluateAll((o) => o.map((x) => x.value));
check(
  "Champ « Église / dénomination » avec suggestions réelles",
  opts.includes("Catholique") && opts.includes("Église évangélique"),
  opts.join(" | "),
);
await pv.getByLabel("Église / dénomination").fill("évangélique");
await pv.getByRole("button", { name: "Rechercher" }).click();
const names = await cardNames(pv, P);
check("Page, « évangélique » : Rhana, Rhbea", names.join(",") === "Rhana,Rhbea", names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
