// YONA — Phase 10 / Étape 10.3 — Vérification de la règle du statut en ligne.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-10/etape-10.3-statut-en-ligne.mjs
import {
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("p103", {
  v: ["male", "Pcpaul"],
  a: ["female", "Pcgrace"],
  h: ["female", "Pchanna"],
  k: ["female", "Pclea"],
  s: ["female", "Pcsarah"],
});
const setSeen = (u, ago, online = true) =>
  sql(
    `update public.user_activity set last_seen_at = ${ago === null ? "null" : `now() - interval '${ago}'`}, is_online = ${online} where user_id='${id[u]}'`,
  );
// Depuis l'étape 10.5, la présence des autres membres est réservée à Premium.
sql(
  `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id.v}', 'active', now() - interval '1 day', now() + interval '30 days')`,
);
const tv = await tokenOf(emails.v, PWD);
const presence = async (token, u) =>
  (await rest(token, "rpc/get_presence", "POST", { _user_id: id[u] })).json;

// A. Règle
setSeen("a", "1 minute");
check("Connectée et active il y a 1 min : « online »", (await presence(tv, "a")) === "online");
setSeen("a", "2 minutes 50 seconds");
check("Active il y a 2 min 50 : toujours « online »", (await presence(tv, "a")) === "online");
setSeen("a", "4 minutes");
check("Active il y a 4 min (plus de signal) : « recent »", (await presence(tv, "a")) === "recent");
setSeen("a", "30 seconds", false);
check(
  "Déconnectée il y a 30 s : « recent » (plus en ligne)",
  (await presence(tv, "a")) === "recent",
);
setSeen("a", "23 hours");
check("Active il y a 23 h : « recent »", (await presence(tv, "a")) === "recent");
setSeen("a", "2 days");
check("Active il y a 2 jours : « this_week »", (await presence(tv, "a")) === "this_week");
setSeen("a", "10 days");
check("Active il y a 10 jours : « inactive »", (await presence(tv, "a")) === "inactive");
setSeen("a", null);
check("Aucune activité connue : « unknown »", (await presence(tv, "a")) === "unknown");
const raw = await rest(tv, "rpc/get_presence", "POST", { _user_id: id.a });
check("Jamais d'horodatage exact dans la réponse", /^"[a-z_]+"$/.test(raw.text), raw.text);

// B. Qui peut consulter
for (const u of ["h", "k", "s"]) setSeen(u, "1 minute");
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
check("Profil masqué (en ligne) : « unknown »", (await presence(tv, "h")) === "unknown");
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
check("Membre qui m'a bloqué (en ligne) : « unknown »", (await presence(tv, "k")) === "unknown");
sql(`update public.users set status='suspended' where id='${id.s}'`);
check("Compte suspendu (en ligne) : « unknown »", (await presence(tv, "s")) === "unknown");
await rest(tv, "rpc/touch_activity", "POST", {});
check("Son propre statut : « online »", (await presence(tv, "v")) === "online");
let r = await rest(null, "rpc/get_presence", "POST", { _user_id: id.a });
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);
r = await rest(null, "rpc/mark_offline", "POST", {});
check("mark_offline sans connexion : refusé", r.status >= 400, `${r.status}`);

// C. Déconnexion : n'apparaît plus en ligne
const { browser, jsErrors, login } = await openBrowser();
const pa = await login(emails.a, PWD);
await pa.waitForTimeout(1500);
check("Pcgrace se connecte : « online »", (await presence(tv, "a")) === "online");
await pa.getByRole("button", { name: "Quitter" }).click();
await pa.waitForURL(/\/login/, { timeout: 10000 });
await pa.waitForTimeout(800);
check(
  "Pcgrace se déconnecte : « recent », dernière activité conservée",
  (await presence(tv, "a")) === "recent" &&
    sql(
      `select last_seen_at is not null and not is_online from public.user_activity where user_id='${id.a}'`,
    ) === "t",
);
const pa2 = await login(emails.a, PWD);
await pa2.waitForTimeout(1500);
check("Pcgrace se reconnecte : de nouveau « online »", (await presence(tv, "a")) === "online");
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
