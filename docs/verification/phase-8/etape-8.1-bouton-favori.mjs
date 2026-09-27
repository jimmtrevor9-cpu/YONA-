// YONA — Phase 8 / Étape 8.1 — Vérification du bouton Favori.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.1-bouton-favori.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("f81", {
  v: ["male", "Fapaul"],
  a: ["female", "Fagrace"],
  b: ["female", "Faruth"],
  m: ["female", "Famarie"],
});
const matchId = match(id, "v", "m");
sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id.v}','${id.b}')`);
const favCount = () => sql(`select count(*) from public.favorites where user_id='${id.v}'`);

const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.waitForTimeout(1500);
const card = (name) => pv.locator("article").filter({ hasText: `${name} ` });
const star = (name) => card(name).getByTestId("favorite-button");

// A. Découvrir
check(
  "Carte Découvrir : bouton étoile « Ajouter Fagrace aux favoris »",
  (await card("Fagrace").getByRole("button", { name: "Ajouter Fagrace aux favoris" }).count()) ===
    1,
);
check(
  "Non favori : bouton non enfoncé, étoile vide",
  (await star("Fagrace").getAttribute("aria-pressed")) === "false" &&
    (await star("Fagrace").locator("svg.fill-gold").count()) === 0,
);
check(
  "Déjà favori (Faruth) : « Retirer Faruth des favoris », enfoncé, étoile pleine",
  (await card("Faruth").getByRole("button", { name: "Retirer Faruth des favoris" }).count()) ===
    1 &&
    (await star("Faruth").getAttribute("aria-pressed")) === "true" &&
    (await star("Faruth").locator("svg.fill-gold").count()) === 1,
);
check(
  "Like et Passer toujours présents sur la carte",
  (await card("Fagrace")
    .getByRole("button", { name: /^Liker le profil/ })
    .count()) === 1 &&
    (await card("Fagrace")
      .getByRole("button", { name: /^Passer le profil/ })
      .count()) === 1,
);
await star("Fagrace").click();
const t = await toastText(pv);
check(
  "Clic : « L'ajout aux favoris arrive très bientôt. » (enregistrement : étape 8.2)",
  t.includes("L'ajout aux favoris arrive très bientôt."),
  t,
);
check("Rien n'est enregistré par ce clic", favCount() === "1");
await star("Fagrace").focus();
check(
  "Bouton atteignable au clavier",
  await star("Fagrace").evaluate((el) => el === document.activeElement),
);

// B. Profil d'un Match
await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
check(
  "Profil du Match : bouton « Ajouter Famarie aux favoris »",
  (await pv.getByRole("button", { name: "Ajouter Famarie aux favoris" }).count()) === 1,
);

// C. Petit écran
const small = await login(emails.v, PWD, 320);
await small.waitForTimeout(1500);
check(
  "Petit écran (320 px) : étoile visible dans la carte, sans débordement",
  (await small
    .locator("article")
    .filter({ hasText: "Fagrace " })
    .getByTestId("favorite-button")
    .isVisible()) &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() && sql(`select count(*) from public.favorites where user_id='${id.v}'`) === "0",
);
finish();
