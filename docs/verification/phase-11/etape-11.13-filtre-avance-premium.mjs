// YONA — Phase 11 / Étape 11.13 — Vérification du filtre avancé Premium « Actif récemment ».
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.13-filtre-avance-premium.mjs
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
const P = "Rm";
const { id, emails, PWD, cleanup } = createAccounts("r1113", {
  v: ["male", "Rmpaul"],
  f: ["male", "Rmfred"],
  a: ["female", "Rmana"],
  b: ["female", "Rmbea"],
  c: ["female", "Rmcleo"],
  d: ["female", "Rmdina"],
  n: ["female", "Rmnone"],
});
sql(
  `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id.v}', 'active', now() - interval '1 day', now() + interval '30 days')`,
);
const seen = (u, ago) =>
  sql(
    `update public.user_activity set last_seen_at = ${ago ? `now() - interval '${ago}'` : "null"} where user_id='${id[u]}'`,
  );
seen("a", "1 hour");
seen("b", "3 days");
seen("c", "20 days");
seen("d", "60 days");
seen("n", null);
seen("f", "90 days"); // Membre gratuit du test : inactif jusqu'à sa connexion (partie B).
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ active_within_days: 1 });
check("Actifs dans les 24 h : Rmana", r.names?.join(",") === "Rmana", r.names?.join(","));
r = await s({ active_within_days: 7 });
check(
  "Actifs cette semaine : Rmana, Rmbea",
  r.names?.join(",") === "Rmana,Rmbea",
  r.names?.join(","),
);
r = await s({ active_within_days: 30 });
check(
  "Actifs ce mois-ci : Rmana, Rmbea, Rmcleo (Rmdina 60 j et sans activité exclues)",
  r.names?.join(",") === "Rmana,Rmbea,Rmcleo",
  r.names?.join(","),
);
r = await s({ active_within_days: 7, gender: "female", min_age: 30 });
check("Combiné au sexe et à l'âge", r.names?.join(",") === "Rmana,Rmbea", r.names?.join(","));
r = await rest(tv, "rpc/search_profiles", "POST", { _filters: { active_within_days: 7 } });
check("Aucune date d'activité renvoyée", r.status === 200 && !/last_seen|seen_at/.test(r.text));
for (const [label, f] of [
  ["2 jours", { active_within_days: 2 }],
  ["texte", { active_within_days: "7" }],
  ["valeur nulle", { active_within_days: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// B. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1000);
check(
  "Premium : section « Filtres avancés — Premium », champ « Activité récente » actif, 3 périodes",
  (await pv.getByTestId("advanced-filters").textContent()).includes("Filtres avancés") &&
    !(await pv.getByLabel("Activité récente").isDisabled()) &&
    (await pv.getByLabel("Activité récente").locator("option").count()) === 4 &&
    (await pv.getByTestId("advanced-filters-locked").count()) === 0,
);
await pv.getByLabel("Sexe — je cherche").selectOption("");
await pv.getByLabel("Activité récente").selectOption("7");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Premium, « Actifs cette semaine » : Rmana, Rmbea",
  names.join(",") === "Rmana,Rmbea",
  names.join(","),
);
const pf = await login(emails.f, PWD);
await pf.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pf.getByTestId("search-form").waitFor({ timeout: 8000 });
await pf.waitForTimeout(1000);
check(
  "Membre gratuit : champ désactivé, mention « Réservé aux membres Premium »",
  (await pf.getByLabel("Activité récente").isDisabled()) &&
    (await pf.getByTestId("advanced-filters-locked").textContent()).includes(
      "Réservé aux membres Premium",
    ),
);
check(
  "Membre gratuit : les autres filtres restent disponibles",
  !(await pf.getByLabel("Pays").isDisabled()),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes et abonnements de test supprimés", cleanup());
finish();
