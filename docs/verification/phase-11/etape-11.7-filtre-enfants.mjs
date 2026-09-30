// YONA — Phase 11 / Étape 11.7 — Vérification du filtre enfants.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.7-filtre-enfants.mjs
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
const P = "Rg";
const { id, emails, PWD, cleanup } = createAccounts("r117", {
  v: ["male", "Rgpaul"],
  a: ["female", "Rgana"],
  b: ["female", "Rgbea"],
  c: ["female", "Rgcleo"],
  n: ["female", "Rgnone"],
});
sql(`update public.profiles set has_children = true, children_count = 2 where user_id='${id.a}';
     update public.profiles set has_children = true where user_id='${id.b}';
     update public.profiles set has_children = false where user_id='${id.c}'`);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);
const patch = (body) => rest(tv, `profiles?user_id=eq.${id.v}`, "PATCH", body);

// A. Base : cohérence
let r = await patch({ has_children: false, children_count: 2 });
check(
  "« Pas d'enfant » avec un nombre d'enfants : refusé",
  r.status >= 400 && r.text.includes("profiles_children_check"),
  `${r.status}`,
);
r = await patch({ has_children: true, children_count: 0 });
check("Nombre 0 : refusé", r.status >= 400, `${r.status}`);
r = await patch({ has_children: true, children_count: 21 });
check("Nombre 21 : refusé", r.status >= 400, `${r.status}`);
r = await patch({ has_children: true, children_count: 3 });
check("Enfants, nombre 3 : accepté", r.status < 300, `${r.status}`);
r = await patch({ has_children: true, children_count: null });
check("Enfants sans nombre précisé : accepté", r.status < 300, `${r.status}`);

// B. Recherche
r = await s({ has_children: true });
check("Avec enfants : Rgana, Rgbea", r.names?.join(",") === "Rgana,Rgbea", r.names?.join(","));
r = await s({ has_children: false });
check("Sans enfant : Rgcleo", r.names?.join(",") === "Rgcleo", r.names?.join(","));
check("Sans filtre : le profil non précisé est inclus", (await s({})).names?.includes("Rgnone"));
r = await s({ has_children: true, gender: "female", min_age: 30, max_age: 40 });
check("Combiné au sexe et à l'âge", r.names?.join(",") === "Rgana,Rgbea", r.names?.join(","));
for (const [label, f] of [
  ["texte « true »", { has_children: "true" }],
  ["nombre 1", { has_children: 1 }],
  ["valeur nulle", { has_children: null }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}

// C. Pages
const { browser, jsErrors, login } = await openBrowser();
const pc = await login(emails.c, PWD);
await pc.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pc.getByLabel("Enfants").waitFor({ timeout: 8000 });
await pc.waitForTimeout(600);
check(
  "Profil : « Pas d'enfant » affiché, pas de champ nombre",
  (await pc.getByLabel("Enfants").inputValue()) === "no" &&
    (await pc.getByLabel("Combien ? (facultatif)").count()) === 0,
);
await pc.getByLabel("Enfants").selectOption("yes");
check(
  "Choix « J'ai des enfants » : champ nombre affiché",
  (await pc.getByLabel("Combien ? (facultatif)").count()) === 1,
);
await pc.getByLabel("Combien ? (facultatif)").fill("25");
await pc.getByRole("button", { name: "Enregistrer" }).click();
let t = await toastText(pc);
check(
  "Nombre 25 : message « entre 1 et 20 », rien enregistré",
  t.includes("entre 1 et 20") &&
    sql(`select has_children from public.profiles where user_id='${id.c}'`) === "f",
  t,
);
for (let i = 0; i < 80 && (await pc.locator("[data-sonner-toast]").count()) > 0; i++)
  await pc.waitForTimeout(100);
await pc.getByLabel("Combien ? (facultatif)").fill("1");
await pc.getByRole("button", { name: "Enregistrer" }).click();
t = await toastText(pc);
check(
  "Nombre 1 : enregistré (a des enfants, 1)",
  t.includes("Profil enregistré.") &&
    sql(
      `select has_children || ',' || children_count from public.profiles where user_id='${id.c}'`,
    ) === "true,1",
  t,
);
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.getByLabel("Enfants").selectOption("with");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Recherche « Avec enfants » : Rgana, Rgbea, Rgcleo (qui vient de changer)",
  names.join(",") === "Rgana,Rgbea,Rgcleo",
  names.join(","),
);
await pv.getByLabel("Enfants").selectOption("without");
await pv.getByRole("button", { name: "Rechercher" }).click();
await pv.getByTestId("search-empty").waitFor({ timeout: 8000 });
check("Recherche « Sans enfant » : aucun profil", (await cardNames(pv, P)).length === 0);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
