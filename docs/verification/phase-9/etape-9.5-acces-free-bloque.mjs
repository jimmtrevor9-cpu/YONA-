// YONA — Phase 9 / Étape 9.5 — Vérification : « Qui a visité mon profil » bloqué aux Free.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-9/etape-9.5-acces-free-bloque.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("v95", {
  f: ["male", "Vepaul"],
  a: ["female", "Vegrace"],
  m: ["female", "Vemarie"],
});
const matchId = match(id, "f", "m");
sql(
  `insert into public.profile_visits (visitor_id, visited_user_id, visited_at) values ('${id.a}','${id.f}', now() - interval '20 minutes')`,
);
const tf = await tokenOf(emails.f, PWD);
const call = () => rest(tf, "rpc/get_profile_visitors", "POST", {});
const refused = (r) =>
  r.status >= 400 &&
  r.text.includes("premium_required") &&
  !r.text.includes("Vegrace") &&
  !r.text.includes("Vemarie");
const setSub = (status, starts, expires) => {
  sql(`delete from public.subscriptions where user_id='${id.f}'`);
  if (status)
    sql(
      `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id.f}', '${status}', now() + interval '${starts}', now() + interval '${expires}')`,
    );
};

// A. Base : refus explicite, sans aucune information
let r = await call();
check(
  "Membre gratuit : refus « premium_required », aucun prénom transmis",
  refused(r),
  `${r.status} ${r.text.slice(0, 80)}`,
);
setSub("pending", "-1 day", "30 days");
check("Abonnement en attente de paiement : refusé", refused(await call()));
setSub("active", "-40 days", "-1 hour");
check("Abonnement expiré : refusé", refused(await call()));
setSub("active", "1 day", "31 days");
check("Abonnement qui n'a pas encore commencé : refusé", refused(await call()));
setSub("cancelled", "-1 day", "30 days");
check("Abonnement annulé : refusé", refused(await call()));
setSub(null);
r = await rest(tf, `profile_visits?visited_user_id=eq.${id.f}`);
check(
  "Contournement par lecture directe de la table : aucune visite reçue",
  r.status === 200 && (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
r = await rest(null, "rpc/get_profile_visitors", "POST", {});
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Interface gratuite
const { browser, jsErrors, login } = await openBrowser();
// Visite réelle vers le membre gratuit : elle est enregistrée même s'il ne peut pas la voir.
const pm = await login(emails.m, PWD);
await pm.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pm.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pm.waitForTimeout(1000);
check(
  "Les visites vers un membre gratuit sont bien enregistrées (2)",
  sql(`select count(*) from public.profile_visits where visited_user_id='${id.f}'`) === "2",
);
const pf = await login(emails.f, PWD);
const bodies = [];
pf.on("response", async (res) => {
  if (!/54321|_serverFn/.test(res.url())) return;
  bodies.push(await res.text().catch(() => ""));
});
await pf.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
const locked = pf.getByTestId("visitors-locked");
await locked.waitFor({ timeout: 8000 });
const lockedText = await locked.textContent();
check(
  "Page Visiteurs : encart « Réservé aux membres Premium »",
  lockedText.includes("Réservé aux membres Premium") &&
    lockedText.includes("découvrez qui a visité votre profil"),
  lockedText,
);
check(
  "Aucun prénom ni nombre de visiteurs affiché",
  !/Vegrace|Vemarie/.test(await pf.locator("main").textContent()) &&
    (await pf.getByTestId("visitor-item").count()) === 0 &&
    (await pf.getByTestId("visitors-count").count()) === 0,
);
await pf.waitForTimeout(800);
check(
  "Aucune réponse du serveur reçue par la page ne contient les prénoms des visiteurs",
  bodies.length > 0 && !bodies.some((b) => b.includes("Vegrace") || b.includes("Vemarie")),
  `${bodies.length} réponses`,
);

// C. Devenir Premium, puis expiration
setSub("active", "-1 day", "30 days");
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("visitor-item").first().waitFor({ timeout: 8000 });
check(
  "Devenu Premium : l'encart disparaît et les visites passées s'affichent (Vemarie, Vegrace)",
  (await pf.getByTestId("visitors-locked").count()) === 0 &&
    (await pf.getByTestId("visitor-item").count()) === 2,
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.f}'`,
);
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("visitors-locked").waitFor({ timeout: 8000 });
check(
  "Premium expiré : de nouveau verrouillé, plus aucune carte",
  (await pf.getByTestId("visitor-item").count()) === 0,
);
const small = await login(emails.f, PWD, 320);
await small.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await small.getByTestId("visitors-locked").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : encart visible, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes, abonnements et visites de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.profile_visits where visited_user_id='${id.f}'`) === "0",
);
finish();
