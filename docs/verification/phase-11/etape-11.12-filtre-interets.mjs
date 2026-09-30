// YONA — Phase 11 / Étape 11.12 — Vérification du filtre centres d'intérêt.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.12-filtre-interets.mjs
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
const P = "Rl";
const { id, emails, PWD, cleanup } = createAccounts("r1112", {
  v: ["male", "Rlpaul"],
  a: ["female", "Rlana"],
  b: ["female", "Rlbea"],
  c: ["female", "Rlcleo"],
  n: ["female", "Rlnone"],
});
const set = (u, arr) =>
  sql(
    `update public.profiles set interests = array[${arr.map((x) => `'${x}'`).join(",")}]::text[] where user_id='${id[u]}'`,
  );
set("a", ["Musique", "Randonnée"]);
set("b", ["musique", "Lecture"]);
set("c", ["Cuisine"]);
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);
const patch = (body) => rest(tv, `profiles?user_id=eq.${id.v}`, "PATCH", body);

// A. Base
let r = await patch({ interests: Array.from({ length: 11 }, (_, i) => `centre ${i}`) });
check(
  "11 centres d'intérêt : refusé",
  r.status >= 400 && r.text.includes("profiles_interests_count"),
  `${r.status}`,
);
r = await patch({ interests: ["x".repeat(41)] });
check("Centre d'intérêt de 41 caractères : refusé", r.status >= 400, `${r.status}`);
r = await patch({ interests: [""] });
check("Centre d'intérêt vide : refusé", r.status >= 400, `${r.status}`);
r = await patch({ interests: ["Chant", "Football"] });
check("2 centres d'intérêt valides : acceptés", r.status < 300, `${r.status}`);

// B. Recherche
r = await s({ interests: ["musique"] });
check(
  "« musique » : Rlana et Rlbea (casse ignorée)",
  r.names?.join(",") === "Rlana,Rlbea",
  r.names?.join(","),
);
r = await s({ interests: ["randonnee"] });
check("« randonnee » (sans accent) : Rlana", r.names?.join(",") === "Rlana", r.names?.join(","));
r = await s({ interests: ["lecture", "cuisine"] });
check(
  "« lecture » ou « cuisine » : Rlbea et Rlcleo",
  r.names?.join(",") === "Rlbea,Rlcleo",
  r.names?.join(","),
);
r = await s({ interests: ["musi"] });
check(
  "Mot partiel « musi » : aucune correspondance (centre d'intérêt exact)",
  r.names?.length === 0,
);
check(
  "Profil sans centre d'intérêt : jamais retenu",
  !(await s({ interests: ["musique", "cuisine", "lecture"] })).names?.includes("Rlnone"),
);
for (const [label, f] of [
  ["texte au lieu d'une liste", { interests: "musique" }],
  ["liste vide", { interests: [] }],
  ["6 éléments", { interests: ["a", "b", "c", "d", "e", "f"] }],
  ["élément de 41 caractères", { interests: ["x".repeat(41)] }],
  ["élément vide", { interests: [" "] }],
  ["nombre dans la liste", { interests: [7] }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await rest(tv, "rpc/list_search_values", "POST", { _field: "interests" });
const mine = (r.json ?? []).filter((x) => /musique|randonn|lecture|cuisine/i.test(x.value));
check(
  "Suggestions : « Musique » une seule fois (2 profils), Randonnée, Lecture, Cuisine",
  mine.length === 4 &&
    mine.find((x) => /musique/i.test(x.value))?.profiles === 2 &&
    mine.some((x) => x.value === "Musique"),
  JSON.stringify(mine),
);

// C. Pages
const { browser, jsErrors, login } = await openBrowser();
const pc = await login(emails.c, PWD);
await pc.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pc.getByLabel("Centres d'intérêt").waitFor({ timeout: 8000 });
await pc.waitForTimeout(600);
check(
  "Profil : centres d'intérêt actuels affichés",
  (await pc.getByLabel("Centres d'intérêt").inputValue()) === "Cuisine",
);
await pc.getByLabel("Centres d'intérêt").fill("Cuisine,  musique , cuisine, Lecture");
await pc.getByRole("button", { name: "Enregistrer" }).click();
let t = await toastText(pc);
check(
  "Profil : liste nettoyée (espaces, doublon) et enregistrée",
  t.includes("Profil enregistré.") &&
    sql(`select array_to_string(interests, '|') from public.profiles where user_id='${id.c}'`) ===
      "Cuisine|musique|Lecture",
  sql(`select array_to_string(interests, '|') from public.profiles where user_id='${id.c}'`),
);
for (let i = 0; i < 80 && (await pc.locator("[data-sonner-toast]").count()) > 0; i++)
  await pc.waitForTimeout(100);
await pc
  .getByLabel("Centres d'intérêt")
  .fill(Array.from({ length: 11 }, (_, i) => `c${i}`).join(","));
await pc.getByRole("button", { name: "Enregistrer" }).click();
t = await toastText(pc);
check(
  "Profil : 11 centres d'intérêt → message « 10 centres d'intérêt au plus »",
  t.includes("10 centres d'intérêt au plus"),
  t,
);
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(800);
const opts = await pv
  .locator("#searchInterests-suggestions option")
  .evaluateAll((o) => o.map((x) => x.value));
check(
  "Recherche : suggestions de centres d'intérêt réels (« musique » une seule fois, orthographe la plus fréquente)",
  opts.filter((o) => o.toLowerCase() === "musique").length === 1 && opts.includes("Cuisine"),
  opts.join(" | "),
);
await pv.getByLabel("Centres d'intérêt").fill("Musique");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Page, « Musique » : Rlana, Rlbea, Rlcleo (qui vient de l'ajouter)",
  names.join(",") === "Rlana,Rlbea,Rlcleo",
  names.join(","),
);
await pv.getByLabel("Centres d'intérêt").fill("a, b, c, d, e, f");
await pv.getByRole("button", { name: "Rechercher" }).click();
check(
  "Page : 6 centres d'intérêt → message « 5 centres d'intérêt au plus »",
  (await pv.getByTestId("search-error").textContent()).includes("5 centres d'intérêt au plus"),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
