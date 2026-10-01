// YONA — Phase 8 / Étape 8.7 — Vérification de l'affichage des favoris.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.7-afficher-favoris.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  sql,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("f87", {
  v: ["male", "Fbpaul"],
  a: ["female", "Fbgrace"],
  b: ["female", "Fbruth"],
  m: ["female", "Fbmarie"],
  h: ["female", "Fbhanna"],
  k: ["female", "Fblea"],
  c: ["female", "Fbeve"],
  n: ["female", "Fbnoemi"],
  o: ["male", "Fbomer"],
});
const matchId = match(id, "v", "m");
// Favoris ajoutés l'un après l'autre (date fixée par le serveur).
for (const x of ["a", "b", "m", "h", "k"]) {
  sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id.v}','${id[x]}')`);
  sql("select pg_sleep(0.05)");
}
sql(`update public.profiles set country='Cameroun' where user_id='${id.a}'`);
sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id.o}','${id.c}')`);
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
const today = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await pv.getByTestId("favorite-item").first().waitFor({ timeout: 8000 });
const items = pv.getByTestId("favorite-item");
const names = await items.locator("h2").allTextContents();
check(
  "3 favoris visibles, les plus récents d'abord : Fbmarie, Fbruth, Fbgrace",
  names.length === 3 &&
    names[0].startsWith("Fbmarie") &&
    names[1].startsWith("Fbruth") &&
    names[2].startsWith("Fbgrace"),
  names.join(" | "),
);
check(
  "Nombre affiché : « 3 profils en favori »",
  (await pv.getByTestId("favorites-count").textContent()).trim() === "3 profils en favori",
);
const grace = items.filter({ hasText: "Fbgrace" });
const graceText = await grace.textContent();
check(
  "Carte : prénom, âge (34 ans), ville et pays",
  graceText.includes("Fbgrace · 34 ans") && graceText.includes("Douala, Cameroun"),
  graceText,
);
check(`Carte : « Ajouté le ${today} »`, graceText.includes(`Ajouté le ${today}`));
check(
  "Sans photo : initiale affichée",
  (await grace.locator("img").count()) === 0 && graceText.includes("F"),
);
check(
  "Étoile pleine « Retirer Fbgrace des favoris » sur chaque carte",
  (await grace
    .getByRole("button", { name: "Retirer Fbgrace des favoris" })
    .getAttribute("aria-pressed")) === "true" &&
    (await items.getByTestId("favorite-button").count()) === 3,
);
const marie = items.filter({ hasText: "Fbmarie" });
check(
  "Favori avec qui un Match existe : lien « Voir le profil »",
  (await marie.getByRole("link", { name: "Voir le profil" }).getAttribute("href")) ===
    `/matches/${matchId}` &&
    (await grace.getByRole("link", { name: "Voir le profil" }).count()) === 0,
);
const page = await pv.locator("main").textContent();
check(
  "Profils masqué / bloquant non affichés ; « 2 favoris ne sont plus disponibles pour le moment. »",
  !page.includes("Fbhanna") &&
    !page.includes("Fblea") &&
    (await pv.getByTestId("favorites-unavailable").textContent()).trim() ===
      "2 favoris ne sont plus disponibles pour le moment.",
);
check("Favoris des autres membres non affichés (Fbeve)", !page.includes("Fbeve"));

// Retrait depuis la page
await grace.getByTestId("favorite-button").click();
const t1 = await toastText(pv);
await pv.waitForTimeout(1200);
check(
  "Retrait depuis la page : « Retiré de vos favoris. », carte retirée, « 2 profils en favori »",
  t1.includes("Retiré de vos favoris.") &&
    (await items.filter({ hasText: "Fbgrace" }).count()) === 0 &&
    (await pv.getByTestId("favorites-count").textContent()).trim() === "2 profils en favori",
  t1,
);

// Lien vers le profil d'un Match
await marie.getByRole("link", { name: "Voir le profil" }).click();
await pv.waitForURL(new RegExp(`/matches/${matchId}$`), { timeout: 8000 });
await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pv
  .getByRole("button", { name: "Retirer Fbmarie des favoris" })
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "« Voir le profil » ouvre le profil du Match (étoile pleine)",
  (await pv.getByRole("button", { name: "Retirer Fbmarie des favoris" }).count()) === 1,
);

// Ajout depuis Découvrir, puis visible en tête de liste
await pv.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1500);
await pv.locator("article").filter({ hasText: "Fbnoemi " }).getByTestId("favorite-button").click();
await toastText(pv);
await pv.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await items.first().waitFor({ timeout: 8000 });
check(
  "Ajout depuis Découvrir : Fbnoemi apparaît en tête de liste",
  (await items.first().locator("h2").textContent()).startsWith("Fbnoemi"),
);

// Profil redevenu visible : réapparaît
sql(`update public.profiles set visibility='visible' where user_id='${id.h}'`);
await pv.reload({ waitUntil: "networkidle" });
await items.first().waitFor({ timeout: 8000 });
check(
  "Profil de nouveau visible : Fbhanna réapparaît, « 1 favori n'est plus disponible… »",
  (await items.filter({ hasText: "Fbhanna" }).count()) === 1 &&
    (await pv.getByTestId("favorites-unavailable").textContent()).trim() ===
      "1 favori n'est plus disponible pour le moment.",
);

// Petit écran
const small = await login(emails.v, PWD, 320);
await small.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await small.getByTestId("favorite-item").first().waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : étoile visible, sans débordement",
  (await small.getByTestId("favorite-item").first().getByTestId("favorite-button").isVisible()) &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.favorites where user_id in ('${id.v}','${id.o}')`) === "0",
);
finish();
