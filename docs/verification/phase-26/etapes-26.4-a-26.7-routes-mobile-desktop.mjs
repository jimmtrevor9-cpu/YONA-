// YONA — Phase 26 — Routes, mobile et ordinateur (26.4, 26.6, 26.7).
// Chaque page connectée est ouverte en 320 px, 390 px et 1280 px : page affichée, pas de
// défilement horizontal, aucune erreur JavaScript. Les pages protégées renvoient vers
// /login sans connexion.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-26/etapes-26.4-a-26.7-routes-mobile-desktop.mjs
import { createRequire } from "node:module";

import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  sql,
} from "../outils/base-favoris.mjs";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("c26", {
  a: ["male", "Ecranadmin"],
  b: ["female", "Ecranamie"],
});
sql(`insert into public.user_roles (user_id, role) values ('${id.a}','admin')`);
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.a}','premium_yearly','active', now() - interval '1 day', now() + interval '300 days')`,
);
const matchId = match(id, "a", "b");
const conv = sql(`select id from public.conversations where match_id='${matchId}'`);

const PAGES = [
  "/discover",
  "/search",
  "/matches",
  `/matches/${matchId}`,
  "/messages",
  `/messages/${conv}`,
  "/demandes",
  "/favoris",
  "/visiteurs",
  "/notifications",
  "/profile",
  "/premium",
  "/settings",
  "/support",
  "/roi-salomon",
  "/admin",
];

// 26.4 — sans connexion, les pages protégées renvoient vers /login.
const anon = await (await chromium.launch()).newPage();
let redirected = 0;
for (const path of PAGES) {
  await anon.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await anon.waitForTimeout(200);
  if (anon.url().includes("/login")) redirected++;
}
check(
  "26.4 : pages protégées → /login sans connexion",
  redirected === PAGES.length,
  `${redirected}/${PAGES.length}`,
);
await anon.context().browser().close();

const { browser, jsErrors, login } = await openBrowser();
for (const width of [320, 390, 1280]) {
  const page = await login(emails.a, PWD, width);
  const bad = [];
  for (const path of PAGES) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    const shown = (await page.locator("main").count()) > 0;
    if (!res?.ok() || overflow || !shown || !page.url().includes(path.split("/")[1]))
      bad.push(`${path}${overflow ? " (débordement)" : ""}`);
  }
  check(
    `${width < 1000 ? "26.6 mobile" : "26.7 ordinateur"} ${width} px : ${PAGES.length} pages affichées sans débordement`,
    bad.length === 0,
    bad.join(", "),
  );
  await page.context().close();
}
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
