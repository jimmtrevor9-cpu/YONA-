// YONA — Phase 9 / Étape 9.3 — Vérification de la page Visiteurs.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-9/etape-9.3-page-visiteurs.mjs
import { BASE, createAccounts, createChecker, openBrowser } from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { emails, PWD, cleanup } = createAccounts("v93", { v: ["male", "Vcpaul"] });
const { browser, jsErrors, login } = await openBrowser();

const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await anon.waitForTimeout(800);
check("Visiteur non connecté : renvoyé vers la connexion", /\/login/.test(anon.url()), anon.url());

const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
const link = pv.getByTestId("visitors-link");
await link.waitFor({ timeout: 8000 });
check(
  "Profil : entrée « Mes visiteurs — Qui a consulté votre profil »",
  (await link.textContent()).includes("Mes visiteurs") &&
    (await link.textContent()).includes("Qui a consulté votre profil"),
);
check(
  "L'entrée « Mes favoris » est toujours présente",
  (await pv.getByTestId("favorites-link").count()) === 1,
);
await link.click();
await pv.waitForURL(/\/visiteurs$/, { timeout: 8000 });
await pv.getByTestId("visitors-page").waitFor({ timeout: 8000 });
check("Clic : page /visiteurs ouverte", pv.url().endsWith("/visiteurs"));
check(
  "Titre de page « Mes visiteurs » (onglet et en-tête)",
  (await pv.title()).startsWith("Mes visiteurs") &&
    (await pv.locator("h1").textContent()).trim() === "Mes visiteurs",
  await pv.title(),
);
check(
  "Explication : une visite = profil complet ouvert, au plus une fois par heure",
  (await pv.getByTestId("visitors-explanation").textContent()).includes(
    "ouvre votre profil complet, au plus une fois par heure",
  ),
);
check(
  "Navigation du bas présente",
  (await pv.getByRole("link", { name: "Découvrir" }).count()) >= 1,
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByTestId("visitors-page").waitFor({ timeout: 8000 });
check("Rechargement direct de /visiteurs : page affichée", pv.url().endsWith("/visiteurs"));
await pv.getByRole("link", { name: "Retour au profil" }).click();
await pv.waitForURL(/\/profile$/, { timeout: 8000 });
check("« Retour au profil »", pv.url().endsWith("/profile"));
const small = await login(emails.v, PWD, 320);
await small.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await small.getByTestId("visitors-page").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : compte de test supprimé", cleanup());
finish();
