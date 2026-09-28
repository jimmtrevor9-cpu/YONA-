// YONA — Phase 11 / Étape 11.1 — Vérification du filtre âge.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.1-filtre-age.mjs
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
const P = "Ra";
const { id, emails, PWD, cleanup } = createAccounts("r111", {
  v: ["male", "Rapaul"],
  a: ["female", "Raana"],
  b: ["female", "Rabea"],
  c: ["female", "Racleo"],
  d: ["female", "Radina"],
  e: ["female", "Raeva"],
  f: ["female", "Rafaye"],
  n: ["female", "Ranone"],
  h: ["female", "Rahide"],
  k: ["female", "Rakira"],
});
const born = (u, expr) =>
  sql(`update public.profiles set birth_date = ${expr} where user_id='${id[u]}'`);
born("a", "current_date - interval '20 years 10 days'"); // 20 ans
born("b", "current_date - interval '30 years 10 days'"); // 30 ans
born("c", "current_date - interval '45 years 10 days'"); // 45 ans
born("d", "current_date - interval '60 years 10 days'"); // 60 ans
born("e", "current_date - interval '25 years'"); // 25 ans aujourd'hui
born("f", "current_date - interval '51 years' + interval '1 day'"); // 50 ans, 51 demain
born("h", "current_date - interval '30 years 10 days'");
born("k", "current_date - interval '30 years 10 days'");
// Profil sans date de naissance (données anciennes) : ne peut pas correspondre à un âge.
sql(`alter table public.profiles disable trigger user;
     update public.profiles set birth_date = null where user_id='${id.n}';
     alter table public.profiles enable trigger user;`);
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({});
check(
  "Sans filtre : tous les profils visibles (dont celui sans date de naissance), ni soi-même, ni masqué, ni bloquant",
  r.names?.join(",") === "Raana,Rabea,Racleo,Radina,Raeva,Rafaye,Ranone",
  r.names?.join(","),
);
r = await s({ min_age: 25, max_age: 50 });
check(
  "25 à 50 ans : Rabea (30), Racleo (45), Raeva (25 aujourd'hui), Rafaye (50)",
  r.names?.join(",") === "Rabea,Racleo,Raeva,Rafaye",
  r.names?.join(","),
);
r = await s({ min_age: 26 });
check(
  "26 ans et plus : Raeva (25) exclue",
  r.names?.join(",") === "Rabea,Racleo,Radina,Rafaye",
  r.names?.join(","),
);
r = await s({ max_age: 49 });
check(
  "49 ans au plus : Rafaye (50) et Radina (60) exclues",
  r.names?.join(",") === "Raana,Rabea,Racleo,Raeva",
  r.names?.join(","),
);
r = await s({ min_age: 30, max_age: 30 });
check("Exactement 30 ans : Rabea", r.names?.join(",") === "Rabea", r.names?.join(","));
r = await s({ min_age: 70, max_age: 99 });
check(
  "70 à 99 ans : aucun résultat",
  r.status === 200 && r.names?.length === 0,
  r.text.slice(0, 40),
);
check(
  "Profil sans date de naissance exclu dès qu'un âge est demandé",
  !(await s({ max_age: 99 })).names?.includes("Ranone"),
);
for (const [label, f] of [
  ["âge minimum 17", { min_age: 17 }],
  ["âge maximum 100", { max_age: 100 }],
  ["minimum supérieur au maximum", { min_age: 40, max_age: 30 }],
  ["âge en texte", { min_age: "30" }],
  ["âge décimal", { min_age: 30.5 }],
  ["âge négatif", { min_age: -5 }],
  ["filtre inconnu", { salaire: 1000 }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await rest(null, "rpc/search_profiles", "POST", { _filters: {} });
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);
sql(`update public.profiles set status='suspended' where user_id='${id.v}'`);
r = await s({});
check(
  "Mon profil suspendu : aucun résultat",
  r.status === 200 && r.names?.length === 0,
  r.text.slice(0, 40),
);
sql(`update public.profiles set status='active' where user_id='${id.v}'`);

// B. Page Recherche
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
check(
  "Page : champs « De (ans) » et « À (ans) » sous « Âge »",
  (await pv.getByLabel("De (ans)").count()) === 1 && (await pv.getByLabel("À (ans)").count()) === 1,
);
await pv.getByLabel("De (ans)").fill("25");
await pv.getByLabel("À (ans)").fill("50");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Page, 25 à 50 ans : les 4 bons profils",
  names.join(",") === "Rabea,Racleo,Raeva,Rafaye",
  names.join(","),
);
check(
  "Les âges affichés sont dans la tranche",
  (await pv.locator("article h3").allTextContents())
    .filter((t) => t.startsWith(P))
    .every((t) => {
      const age = Number(t.match(/(\d+) ans/)?.[1]);
      return age >= 25 && age <= 50;
    }),
);
await pv.getByLabel("De (ans)").fill("40");
await pv.getByLabel("À (ans)").fill("30");
await pv.getByRole("button", { name: "Rechercher" }).click();
check(
  "Minimum supérieur au maximum : message clair, résultats précédents conservés",
  (await pv.getByTestId("search-error").textContent()).includes(
    "L'âge minimum ne peut pas dépasser l'âge maximum.",
  ) && (await cardNames(pv, P)).join(",") === "Rabea,Racleo,Raeva,Rafaye",
);
await pv.getByLabel("De (ans)").fill("12");
await pv.getByLabel("À (ans)").fill("");
await pv.getByRole("button", { name: "Rechercher" }).click();
check(
  "Âge hors limites : message « entre 18 et 99 ans »",
  (await pv.getByTestId("search-error").textContent()).includes("entre 18 et 99 ans"),
);
await pv.getByLabel("De (ans)").fill("");
await pv.getByRole("button", { name: "Rechercher" }).click();
names = await cardNames(pv, P);
check(
  "Champs vidés : message retiré, tous les profils",
  (await pv.getByTestId("search-error").count()) === 0 && names.length === 7,
  names.join(","),
);
await pv.getByLabel("De (ans)").fill("70");
await pv.getByRole("button", { name: "Rechercher" }).click();
await pv.getByTestId("search-empty").waitFor({ timeout: 8000 });
check("Aucun résultat : « Aucun profil ne correspond. »", (await cardNames(pv, P)).length === 0);
const small = await login(emails.v, PWD, 320);
await small.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await small.getByTestId("search-form").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
