// YONA — Phase 11 / Étape 11.14 — Vérification : filtres Premium protégés côté serveur.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.14-filtres-premium-serveur.mjs
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
const P = "Rn";
const { id, emails, PWD, cleanup } = createAccounts("r1114", {
  f: ["male", "Rnfred"],
  v: ["male", "Rnpaul"],
  a: ["female", "Rnana"],
  b: ["female", "Rnbea"],
});
sql(
  `update public.user_activity set last_seen_at = now() - interval '60 days' where user_id='${id.b}'`,
);
const setSub = (u, status, starts, expires) => {
  sql(`delete from public.subscriptions where user_id='${id[u]}'`);
  if (status)
    sql(
      `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id[u]}', '${status}', now() + interval '${starts}', now() + interval '${expires}')`,
    );
};
setSub("v", "active", "-1 day", "30 days");
const tf = await tokenOf(emails.f, PWD);
const tv = await tokenOf(emails.v, PWD);
const refused = (r) =>
  r.status >= 400 &&
  r.text.includes("premium_required") &&
  !r.text.includes("Rnana") &&
  !r.text.includes("Rnbea");

// A. Serveur
let r = await search(tf, { active_within_days: 7 }, P);
check(
  "Membre gratuit + filtre avancé : refus « premium_required », aucun profil renvoyé",
  refused(r),
  `${r.status} ${r.text.slice(0, 70)}`,
);
for (const [label, st, a, b] of [
  ["abonnement en attente", "pending", "-1 day", "30 days"],
  ["abonnement expiré", "active", "-40 days", "-1 hour"],
  ["abonnement pas encore commencé", "active", "1 day", "31 days"],
  ["abonnement annulé", "cancelled", "-1 day", "30 days"],
]) {
  setSub("f", st, a, b);
  check(`Refus pour ${label}`, refused(await search(tf, { active_within_days: 7 }, P)));
}
setSub("f", null);
r = await search(tf, { active_within_days: 7, gender: "female", country: "Cameroun" }, P);
check("Filtre avancé caché parmi des filtres de base : refusé quand même", refused(r));
r = await search(tf, { gender: "female" }, P);
check(
  "Membre gratuit, filtres de base seulement : accepté",
  r.status === 200 && r.names?.join(",") === "Rnana,Rnbea",
  r.names?.join(","),
);
r = await search(tf, { active_within_days: 3 }, P);
check(
  "Valeur invalide : refus « invalid_filter » (validation d'abord)",
  invalid(r),
  r.text.slice(0, 60),
);
r = await search(tv, { active_within_days: 7 }, P);
check(
  "Membre Premium actif : accepté (Rnana et Rnfred actifs, Rnbea inactive depuis 60 jours)",
  r.status === 200 && r.names?.join(",") === "Rnana,Rnfred",
  r.names?.join(","),
);
r = await rest(null, "rpc/search_profiles", "POST", { _filters: { active_within_days: 7 } });
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Page : abonnement qui expire en cours de session
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1000);
await pv.getByLabel("Sexe — je cherche").selectOption("");
await pv.getByLabel("Activité récente").selectOption("7");
await pv.getByRole("button", { name: "Rechercher" }).click();
let names = await cardNames(pv, P);
check(
  "Premium : « Actifs cette semaine » → Rnana, Rnfred",
  names.join(",") === "Rnana,Rnfred",
  names.join(","),
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.v}'`,
);
await pv.getByLabel("Activité récente").selectOption("30");
await pv.getByRole("button", { name: "Rechercher" }).click();
await pv.getByTestId("search-failed").waitFor({ timeout: 8000 });
check(
  "Abonnement expiré pendant la session : le serveur refuse, message clair",
  (await pv.getByTestId("search-failed").textContent()).includes("réservés aux membres Premium") &&
    (await cardNames(pv, P)).length === 0,
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1200);
check(
  "Après rechargement : filtre avancé verrouillé, recherche de base fonctionnelle",
  (await pv.getByLabel("Activité récente").isDisabled()) &&
    (await pv.getByTestId("search-failed").count()) === 0 &&
    (await cardNames(pv, P)).length > 0,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes et abonnements de test supprimés", cleanup());
finish();
