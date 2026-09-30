// YONA — Phase 9 / Étape 9.1 — Vérification de l'enregistrement d'une visite.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-9/etape-9.1-enregistrer-visite.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  sqlError,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("v91", {
  v: ["male", "Vapaul"],
  a: ["female", "Vagrace"],
  m: ["female", "Vamarie"],
  h: ["female", "Vahanna"],
  s: ["female", "Vasarah"],
  k: ["female", "Valea"],
  j: ["female", "Vajudith"],
});
const matchId = match(id, "v", "m");
const visits = (u, x) =>
  sql(
    `select count(*) from public.profile_visits where visitor_id='${id[u]}' and visited_user_id='${id[x]}'`,
  );
const allVisits = () =>
  sql(
    `select count(*) from public.profile_visits where visitor_id in ('${Object.values(id).join("','")}') or visited_user_id in ('${Object.values(id).join("','")}')`,
  );

// A. Interface : ouvrir le profil complet d'un Match enregistre une visite
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.waitForTimeout(1500);
check("Parcourir Découvrir n'enregistre aucune visite (cartes seulement)", allVisits() === "0");
await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1000);
check("Profil du Match ouvert : 1 visite Vapaul → Vamarie", visits("v", "m") === "1");
check(
  "Date de visite fixée par le serveur (il y a moins d'une minute)",
  sql(
    `select (now() - visited_at) < interval '1 minute' from public.profile_visits where visitor_id='${id.v}' and visited_user_id='${id.m}'`,
  ) === "t",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// B. Fonction serveur
const tv = await tokenOf(emails.v, PWD);
const rpc = (token, x) => rest(token, "rpc/record_profile_visit", "POST", { _visited_user_id: x });
let r = await rpc(tv, id.a);
check(
  "Visite valide : true, enregistrée",
  r.status === 200 && r.json === true && visits("v", "a") === "1",
  r.text,
);
r = await rpc(tv, id.v);
check("Soi-même : false, rien d'enregistré", r.json === false && visits("v", "v") === "0", r.text);
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
r = await rpc(tv, id.h);
check("Profil masqué : false", r.json === false && visits("v", "h") === "0", r.text);
sql(`update public.profiles set status='suspended' where user_id='${id.s}'`);
r = await rpc(tv, id.s);
check("Profil suspendu : false", r.json === false && visits("v", "s") === "0", r.text);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
r = await rpc(tv, id.k);
check("Membre qui m'a bloqué : false", r.json === false && visits("v", "k") === "0", r.text);
sql(`delete from public.blocks where blocker_id='${id.k}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.v}','${id.k}')`);
r = await rpc(tv, id.k);
check("Membre que j'ai bloqué : false", r.json === false && visits("v", "k") === "0", r.text);
r = await rpc(tv, "00000000-0000-4000-8000-000000000000");
check("Membre inexistant : false", r.status === 200 && r.json === false, r.text);
sql(`update public.profiles set status='suspended' where user_id='${id.v}'`);
r = await rpc(tv, id.j);
check("Mon propre profil suspendu : false", r.json === false && visits("v", "j") === "0", r.text);
sql(`update public.profiles set status='active' where user_id='${id.v}'`);
r = await rpc(null, id.j);
check("Visiteur non connecté : refusé", r.status >= 400 && visits("v", "j") === "0", `${r.status}`);

// C. Écritures directes et lecture
r = await rest(tv, "profile_visits", "POST", { visitor_id: id.v, visited_user_id: id.j });
check(
  "Écrire une visite directement : refusé",
  r.status >= 400 && visits("v", "j") === "0",
  `${r.status}`,
);
r = await rest(tv, `profile_visits?visitor_id=eq.${id.v}`, "PATCH", {
  visited_at: "2000-01-01T00:00:00Z",
});
check(
  "Modifier la date d'une visite : refusé",
  r.status >= 400 &&
    sql(
      `select count(*) from public.profile_visits where visitor_id='${id.v}' and visited_at < '2001-01-01'`,
    ) === "0",
  `${r.status}`,
);
r = await rest(tv, `profile_visits?visitor_id=eq.${id.v}`, "DELETE");
check("Effacer ses visites : refusé", r.status >= 400 && visits("v", "a") === "1", `${r.status}`);
const ta = await tokenOf(emails.a, PWD);
r = await rest(ta, `profile_visits?visited_user_id=eq.${id.a}`);
check(
  "Le membre visité ne lit pas la table directement (réservé Premium, étape 9.4)",
  r.status === 200 && (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
r = await rest(tv, `profile_visits?visitor_id=eq.${id.v}&select=visited_user_id`);
check(
  "Le visiteur retrouve ses propres visites (2)",
  (r.json ?? []).length === 2,
  r.text.slice(0, 60),
);
const selfErr = sqlError(
  `insert into public.profile_visits (visitor_id, visited_user_id) values ('${id.v}','${id.v}')`,
);
check(
  "Contrainte de base : auto-visite impossible même avec les droits complets",
  selfErr.includes("profile_visits_no_self") && visits("v", "v") === "0",
  selfErr.split("\n")[0],
);
check("Nettoyage : comptes et visites de test supprimés", cleanup() && allVisits() === "0");
finish();
