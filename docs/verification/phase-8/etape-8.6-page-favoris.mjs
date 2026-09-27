// YONA — Phase 8 / Étape 8.6 — Vérification de la page Favoris.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.6-page-favoris.mjs
import { BASE, createAccounts, createChecker, openBrowser, sql } from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("f86", {
  v: ["male", "Fypaul"],
  a: ["female", "Fygrace"],
  b: ["female", "Fyruth"],
  o: ["male", "Fyomer"],
});
// Favoris d'un autre membre : ne doivent jamais compter pour Fypaul.
sql(
  `insert into public.favorites (user_id, favorite_user_id) values ('${id.o}','${id.a}'),('${id.o}','${id.v}')`,
);

const { browser, jsErrors, login } = await openBrowser();

// A. Accès réservé aux membres connectés
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await anon.waitForTimeout(800);
check("Visiteur non connecté : renvoyé vers la connexion", /\/login/.test(anon.url()), anon.url());

// B. Accès depuis le profil, page vide
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
const link = pv.getByTestId("favorites-link");
await link.waitFor({ timeout: 8000 });
await pv.waitForTimeout(800);
check(
  "Profil : lien « Mes favoris » avec « 0 profil en favori »",
  (await link.textContent()).includes("Mes favoris") &&
    (await link.textContent()).includes("0 profil en favori"),
  await link.textContent(),
);
await link.click();
await pv.waitForURL(/\/favoris$/, { timeout: 8000 });
await pv.getByTestId("favorites-page").waitFor({ timeout: 8000 });
check("Clic : page /favoris ouverte", pv.url().endsWith("/favoris"));
check(
  "Titre de page « Mes favoris » (onglet et en-tête)",
  (await pv.title()).startsWith("Mes favoris") &&
    (await pv.locator("h1").textContent()).trim() === "Mes favoris",
  await pv.title(),
);
await pv.getByTestId("favorites-empty").waitFor({ timeout: 8000 });
check(
  "Aucun favori : message « Vous n'avez pas encore de favori… »",
  (await pv.getByTestId("favorites-empty").textContent()).includes(
    "Vous n'avez pas encore de favori.",
  ),
);
check(
  "Navigation du bas présente",
  (await pv.getByRole("link", { name: "Découvrir" }).count()) >= 1,
);
await pv.getByRole("link", { name: "Découvrir des profils" }).click();
await pv.waitForURL(/\/discover$/, { timeout: 8000 });
check("Bouton « Découvrir des profils » : ouvre Découvrir", pv.url().endsWith("/discover"));

// C. Avec des favoris (état réel lu en base)
sql(
  `insert into public.favorites (user_id, favorite_user_id) values ('${id.v}','${id.a}'),('${id.v}','${id.b}')`,
);
await pv.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await pv.getByTestId("favorites-count").waitFor({ timeout: 8000 });
check(
  "2 favoris : « 2 profils en favori » (favoris des autres membres non comptés)",
  (await pv.getByTestId("favorites-count").textContent()).trim() === "2 profils en favori",
  await pv.getByTestId("favorites-count").textContent(),
);
check(
  "Plus de message « pas encore de favori »",
  (await pv.getByTestId("favorites-empty").count()) === 0,
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByTestId("favorites-count").waitFor({ timeout: 8000 });
check("Rechargement direct de /favoris : page affichée", pv.url().endsWith("/favoris"));
await pv.getByRole("link", { name: "Retour au profil" }).click();
await pv.waitForURL(/\/profile$/, { timeout: 8000 });
await pv.waitForTimeout(800);
check(
  "« Retour au profil », et le lien indique « 2 profils en favori »",
  pv.url().endsWith("/profile") &&
    (await pv.getByTestId("favorites-link").textContent()).includes("2 profils en favori"),
);

// D. Petit écran
const small = await login(emails.v, PWD, 320);
await small.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await small.getByTestId("favorites-page").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
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
