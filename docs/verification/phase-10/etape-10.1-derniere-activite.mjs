// YONA — Phase 10 / Étape 10.1 — Vérification de l'enregistrement de la dernière activité.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-10/etape-10.1-derniere-activite.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("p101", {
  v: ["male", "Papaul"],
  a: ["female", "Pagrace"],
});
const OLD = "now() - interval '2 days'";
const age = (u, col = "last_seen_at") =>
  sql(
    `select extract(epoch from now() - ${col})::int from public.user_activity where user_id='${id[u]}'`,
  );
const recent = (u, col) => {
  const s = age(u, col);
  return s !== "" && Number(s) < 60;
};
sql(
  `update public.user_activity set last_seen_at = ${OLD}, is_online = false where user_id in ('${id.v}','${id.a}')`,
);
sql(`update public.users set last_active_at = ${OLD} where id='${id.v}'`);

// A. Interface : ouvrir l'espace connecté enregistre l'activité
const { browser, jsErrors, login } = await openBrowser();
const anon = await (await browser.newContext()).newPage();
await anon.goto(`${BASE}/`, { waitUntil: "networkidle" });
await anon.goto(`${BASE}/login`, { waitUntil: "networkidle" });
check("Pages publiques (accueil, connexion) : aucune activité enregistrée", !recent("v"));
const pv = await login(emails.v, PWD);
await pv.waitForTimeout(1500);
check("Connexion puis Découvrir : dernière activité enregistrée (< 1 min)", recent("v"));
check(
  "Compte : dernière activité (users.last_active_at) mise à jour, marqué en activité",
  sql(
    `select (now() - last_active_at) < interval '1 minute' from public.users where id='${id.v}'`,
  ) === "t" && sql(`select is_online from public.user_activity where user_id='${id.v}'`) === "t",
);
check("L'activité des autres membres n'est pas touchée", !recent("a"));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// B. Fonction serveur
const tv = await tokenOf(emails.v, PWD);
const touch = (token) => rest(token, "rpc/touch_activity", "POST", {});
sql(`update public.user_activity set last_seen_at = ${OLD} where user_id='${id.v}'`);
let r = await touch(tv);
check("Appel valide : true, date fixée par le serveur", r.json === true && recent("v"), r.text);
r = await touch(null);
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);
sql(`delete from public.user_activity where user_id='${id.v}'`);
r = await touch(tv);
check("Ligne d'activité manquante : recréée", r.json === true && recent("v"), r.text);
sql(`update public.user_activity set last_seen_at = ${OLD} where user_id='${id.v}'`);
sql(`update public.users set status='suspended' where id='${id.v}'`);
r = await touch(tv);
check("Compte suspendu : false, rien d'enregistré", r.json === false && !recent("v"), r.text);
sql(`update public.users set status='active' where id='${id.v}'`);

// C. Écritures directes et lecture
r = await rest(tv, `user_activity?user_id=eq.${id.v}`, "PATCH", {
  last_seen_at: "2099-01-01T00:00:00Z",
  is_online: true,
});
check(
  "Modifier sa dernière activité directement : refusé",
  r.status >= 400 && !recent("v"),
  `${r.status}`,
);
r = await rest(tv, `user_activity?user_id=eq.${id.v}`, "DELETE");
check(
  "Effacer sa ligne d'activité : refusé",
  r.status >= 400 &&
    sql(`select count(*) from public.user_activity where user_id='${id.v}'`) === "1",
  `${r.status}`,
);
sql(`delete from public.user_activity where user_id='${id.v}'`);
r = await rest(tv, "user_activity", "POST", {
  user_id: id.v,
  last_seen_at: "2099-01-01T00:00:00Z",
});
check(
  "Créer sa ligne d'activité directement : refusé",
  r.status >= 400 &&
    sql(`select count(*) from public.user_activity where user_id='${id.v}'`) === "0",
  `${r.status}`,
);
await touch(tv);
const ta = await tokenOf(emails.a, PWD);
r = await rest(ta, `user_activity?user_id=eq.${id.v}`);
check(
  "Un autre membre ne lit pas l'activité exacte de Papaul",
  r.status === 200 && (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
r = await rest(tv, `user_activity?user_id=eq.${id.v}&select=last_seen_at`);
check("Papaul lit sa propre activité", (r.json ?? []).length === 1, r.text.slice(0, 60));
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
