// YONA — Phase 10 / Étape 10.4 — Vérification de l'affichage du statut en ligne.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-10/etape-10.4-afficher-statut.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  sql,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("p104", {
  v: ["male", "Pdpaul"],
  m: ["female", "Pdmarie"],
});
const matchId = match(id, "v", "m");
const conversationId = sql(`select id from public.conversations where match_id='${matchId}'`);
const setSeen = (ago, online) =>
  sql(
    `update public.user_activity set last_seen_at = ${ago === null ? "null" : `now() - interval '${ago}'`}, is_online = ${online} where user_id='${id.m}'`,
  );

// Depuis l'étape 10.5, la présence des autres membres est réservée à Premium.
sql(
  `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id.v}', 'active', now() - interval '1 day', now() + interval '30 days')`,
);
const { browser, jsErrors, login } = await openBrowser();
const pm = await login(emails.m, PWD);
await pm.waitForTimeout(1000);

const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
await context.clock.install({ time: Date.now() });
const pv = await context.newPage();
pv.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await pv.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await pv.fill("#email", emails.v);
await pv.fill("#password", PWD);
await pv.click("button[type=submit]");
await pv.waitForURL(/\/discover$/, { timeout: 10000 });

const badge = () => pv.getByTestId("presence");
const openProfile = async () => {
  await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
  await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
  await pv.waitForTimeout(1200);
};

// A. Profil du Match
await openProfile();
check(
  "Pdmarie connectée : « En ligne » sur son profil, pastille verte",
  (await badge().textContent()).trim() === "En ligne" &&
    (await badge().getAttribute("data-presence")) === "online" &&
    (await badge().locator("span.bg-success").count()) === 1,
);
const section = await pv.locator("section").filter({ hasText: "Pdmarie" }).first().textContent();
check("Le statut est placé avec le prénom, l'âge et la ville", section.includes("En ligne"));

// B. Mise à jour automatique pendant l'affichage
await pm.getByRole("button", { name: "Quitter" }).click();
await pm.waitForURL(/\/login/, { timeout: 10000 });
await context.clock.runFor(61 * 1000);
await pv.waitForTimeout(1500);
check(
  "Pdmarie se déconnecte : le profil affiché passe à « Actif récemment » en moins d'une minute",
  (await badge().textContent()).trim() === "Actif récemment" &&
    (await badge().locator("span.bg-success").count()) === 0,
  await badge().textContent(),
);

// C. Autres statuts
setSeen("2 days", false);
await openProfile();
check(
  "Active il y a 2 jours : « Actif cette semaine »",
  (await badge().textContent()).trim() === "Actif cette semaine",
);
setSeen("12 days", false);
await openProfile();
check(
  "Active il y a 12 jours : « Actif il y a plusieurs jours »",
  (await badge().textContent()).trim() === "Actif il y a plusieurs jours",
);
setSeen(null, false);
await openProfile();
check("Aucune activité connue : rien n'est affiché", (await badge().count()) === 0);
setSeen("30 seconds", true);
sql(`update public.profiles set visibility='hidden' where user_id='${id.m}'`);
await openProfile();
check(
  "Profil masqué : aucun statut affiché (profil non consultable)",
  (await badge().count()) === 0,
);
sql(`update public.profiles set visibility='visible' where user_id='${id.m}'`);

// D. Conversation
await pv.goto(`${BASE}/messages/${conversationId}`, { waitUntil: "networkidle" });
await pv.getByTestId("conversation-page").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1200);
check(
  "Conversation : « En ligne » sous le prénom",
  (await badge().textContent()).trim() === "En ligne",
);
check(
  "Conversation : « Voir son profil » toujours présent",
  (await pv.getByRole("link", { name: "Voir son profil" }).count()) === 1,
);

const small = await login(emails.v, PWD, 320);
await small.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await small.getByTestId("presence").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : statut visible, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
