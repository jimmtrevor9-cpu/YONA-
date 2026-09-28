// YONA — Phase 9 / Étape 9.2 — Vérification de la limitation des visites répétées.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-9/etape-9.2-limiter-visites.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("v92", {
  v: ["male", "Vbpaul"],
  a: ["female", "Vbgrace"],
  b: ["female", "Vbruth"],
  c: ["female", "Vbeve"],
  d: ["female", "Vblea"],
  m: ["female", "Vbmarie"],
});
const matchId = match(id, "v", "m");
const visits = (u, x) =>
  sql(
    `select count(*) from public.profile_visits where visitor_id='${id[u]}' and visited_user_id='${id[x]}'`,
  );
const tv = await tokenOf(emails.v, PWD);
const ta = await tokenOf(emails.a, PWD);
const rpc = async (token, x) =>
  (await rest(token, "rpc/record_profile_visit", "POST", { _visited_user_id: id[x] })).json;

// A. Une visite par heure et par profil
check("1re visite Vbpaul → Vbgrace : enregistrée", (await rpc(tv, "a")) === true);
check(
  "Visite répétée dans l'heure : ignorée, toujours 1 ligne",
  (await rpc(tv, "a")) === false && visits("v", "a") === "1",
);
const burst = await Promise.all(Array.from({ length: 20 }, () => rpc(tv, "b")));
check(
  "20 appels simultanés Vbpaul → Vbruth : 1 seul enregistré, 1 seule ligne",
  burst.filter((x) => x === true).length === 1 && visits("v", "b") === "1",
  `${burst.filter((x) => x === true).length} vrai(s), ${visits("v", "b")} ligne(s)`,
);
check(
  "Autre profil dans la même heure : enregistré (limite par profil)",
  (await rpc(tv, "c")) === true,
);
check(
  "Sens inverse (Vbgrace → Vbpaul) : visite distincte enregistrée",
  (await rpc(ta, "v")) === true && visits("a", "v") === "1",
);
sql(
  `update public.profile_visits set visited_at = visited_at - interval '61 minutes' where visitor_id='${id.v}' and visited_user_id='${id.a}'`,
);
check(
  "Plus d'une heure après : nouvelle visite enregistrée (2 lignes)",
  (await rpc(tv, "a")) === true && visits("v", "a") === "2",
);

// B. Profil d'un Match ouvert plusieurs fois
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
for (let i = 0; i < 3; i++) {
  await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
  await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
  await pv.waitForTimeout(600);
}
check("Profil du Match ouvert 3 fois de suite : 1 seule visite", visits("v", "m") === "1");
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// C. Au plus 100 visites par visiteur sur 24 heures
sql(`delete from public.profile_visits where visitor_id='${id.v}'`);
sql(
  `insert into public.profile_visits (visitor_id, visited_user_id, visited_at) select '${id.v}', '${id.c}', now() - interval '2 hours' from generate_series(1, 99)`,
);
check("99 visites sur 24 h : la 100e est enregistrée", (await rpc(tv, "b")) === true);
check(
  "100 visites sur 24 h : la suivante est ignorée (sans erreur)",
  (await rpc(tv, "d")) === false && visits("v", "d") === "0",
);
check("La limite d'un visiteur ne touche pas les autres", (await rpc(ta, "d")) === true);
sql(
  `update public.profile_visits set visited_at = now() - interval '25 hours' where visitor_id='${id.v}'`,
);
check(
  "Au-delà de 24 h, les anciennes visites ne comptent plus : enregistrée",
  (await rpc(tv, "d")) === true && visits("v", "d") === "1",
);
check(
  "Nettoyage : comptes et visites de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.profile_visits where visitor_id in ('${id.v}','${id.a}')`) ===
      "0",
);
finish();
