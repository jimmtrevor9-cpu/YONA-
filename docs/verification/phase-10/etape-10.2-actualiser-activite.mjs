// YONA — Phase 10 / Étape 10.2 — Vérification de l'actualisation de l'activité.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-10/etape-10.2-actualiser-activite.mjs
// L'horloge de la page est simulée (Playwright `clock`) pour avancer de plusieurs minutes.
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("p102", { v: ["male", "Pbpaul"] });
const setOld = (ago = "2 days") =>
  sql(
    `update public.user_activity set last_seen_at = now() - interval '${ago}' where user_id='${id.v}'`,
  );
const seenAge = () =>
  Number(
    sql(
      `select extract(epoch from now() - last_seen_at) from public.user_activity where user_id='${id.v}'`,
    ),
  );
const seenAt = () => sql(`select last_seen_at from public.user_activity where user_id='${id.v}'`);

const { browser, jsErrors } = await openBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
await context.clock.install({ time: Date.now() });
const page = await context.newPage();
page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
let calls = 0;
page.on("request", (r) => {
  if (r.url().includes("/rpc/touch_activity")) calls++;
});
const settle = () => page.waitForTimeout(1200);
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", emails.v);
await page.fill("#password", PWD);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover$/, { timeout: 10000 });
await settle();
check("Ouverture de l'espace connecté : 1 signal d'activité", calls === 1, `${calls}`);

// A. Actualisation chaque minute tant que la page est visible
setOld();
let before = calls;
await context.clock.runFor(61 * 1000);
await settle();
check(
  "Après 1 minute sur la page : activité actualisée (1 signal, < 1 min)",
  calls - before === 1 && seenAge() < 60,
  `${calls - before} signal(aux)`,
);
setOld();
before = calls;
await context.clock.runFor(3 * 60 * 1000 + 1000);
await settle();
check(
  "Après 3 minutes de plus : 3 signaux, activité à jour",
  calls - before === 3 && seenAge() < 60,
  `${calls - before}`,
);

// B. Page cachée : rien n'est envoyé
const setVisibility = (state) =>
  page.evaluate((s) => {
    Object.defineProperty(document, "visibilityState", { get: () => s, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
await setVisibility("hidden");
setOld();
before = calls;
await context.clock.runFor(2 * 60 * 1000 + 1000);
await settle();
check(
  "Page cachée pendant 2 minutes : aucun signal, activité non actualisée",
  calls === before && seenAge() > 3600,
  `${calls - before}`,
);
await setVisibility("visible");
await settle();
check(
  "Retour sur la page : activité actualisée aussitôt",
  calls - before === 1 && seenAge() < 60,
  `${calls - before}`,
);
before = calls;
for (let i = 0; i < 5; i++) await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await settle();
check(
  "5 retours rapides sur la page : aucun signal en double",
  calls === before,
  `${calls - before}`,
);

// C. Côté serveur : écritures limitées
const tv = await tokenOf(emails.v, PWD);
setOld();
let r = await rest(tv, "rpc/touch_activity", "POST", {});
const first = seenAt();
r = await rest(tv, "rpc/touch_activity", "POST", {});
check(
  "Deux signaux à moins de 30 s : le 2e répond true sans rien réécrire",
  r.json === true && seenAt() === first,
  r.text,
);
setOld("40 seconds");
r = await rest(tv, "rpc/touch_activity", "POST", {});
check("Signal après plus de 30 s : activité réécrite", r.json === true && seenAge() < 5, r.text);
sql(`update public.users set status='suspended' where id='${id.v}'`);
setOld();
r = await rest(tv, "rpc/touch_activity", "POST", {});
check(
  "Compte suspendu en cours de route : false, rien d'écrit",
  r.json === false && seenAge() > 3600,
  r.text,
);
sql(`update public.users set status='active' where id='${id.v}'`);

// D. Déconnexion : plus aucun signal
await page.getByRole("button", { name: "Quitter" }).click();
await page.waitForURL(/\/login|\/$/, { timeout: 10000 });
await settle();
before = calls;
await context.clock.runFor(2 * 60 * 1000 + 1000);
await settle();
check("Après déconnexion : plus aucun signal", calls === before, `${calls - before}`);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : compte de test supprimé", cleanup());
finish();
