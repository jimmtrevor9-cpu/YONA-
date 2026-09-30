// YONA — Phase 9 / Étape 9.4 — Vérification : Premium voit ses visiteurs.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-9/etape-9.4-visiteurs-premium.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("v94", {
  v: ["male", "Vdpaul"],
  a: ["female", "Vdgrace"],
  b: ["female", "Vdruth"],
  c: ["female", "Vdeve"],
  h: ["female", "Vdhanna"],
  k: ["female", "Vdlea"],
  m: ["female", "Vdmarie"],
  f: ["male", "Vdfree"],
  w: ["male", "Vdwill"],
});
const matchId = match(id, "v", "m");
for (const u of ["v", "w"])
  sql(
    `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id[u]}', 'active', now() - interval '1 day', now() + interval '30 days')`,
  );
const visit = (x, y, ago) =>
  sql(
    `insert into public.profile_visits (visitor_id, visited_user_id, visited_at) values ('${id[x]}','${id[y]}', now() - interval '${ago}')`,
  );
visit("a", "v", "2 hours");
visit("a", "v", "10 minutes");
visit("b", "v", "1 hour");
visit("c", "v", "30 minutes");
visit("h", "v", "5 minutes");
visit("k", "v", "5 minutes");
visit("a", "f", "5 minutes");
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
const today = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const { browser, jsErrors, login } = await openBrowser();
// Visite réelle : Vdmarie ouvre le profil complet de Vdpaul (leur Match).
const pm = await login(emails.m, PWD);
await pm.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pm.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pm.waitForTimeout(1000);

// A. Base
const tv = await tokenOf(emails.v, PWD);
let r = await rest(tv, "rpc/get_profile_visitors", "POST", {});
const rows = r.json ?? [];
check(
  "Premium : 4 visiteurs, dernière visite d'abord (Vdmarie, Vdgrace, Vdeve, Vdruth)",
  rows.map((x) => x.first_name).join(",") === "Vdmarie,Vdgrace,Vdeve,Vdruth",
  rows.map((x) => x.first_name).join(","),
);
check(
  "Un visiteur par ligne, nombre de visites (Vdgrace : 2)",
  rows.find((x) => x.first_name === "Vdgrace")?.visit_count === 2 &&
    rows.find((x) => x.first_name === "Vdruth")?.visit_count === 1,
);
check(
  "Données limitées au profil public",
  rows.length > 0 &&
    Object.keys(rows[0]).sort().join(",") ===
      "birth_date,city,country,first_name,visit_count,visited_at,visitor_id",
  rows.length ? Object.keys(rows[0]).join(",") : "",
);
check(
  "Profil masqué et membre bloquant : non renvoyés",
  !rows.some((x) => x.visitor_id === id.h || x.visitor_id === id.k),
);
const tf = await tokenOf(emails.f, PWD);
r = await rest(tf, "rpc/get_profile_visitors", "POST", {});
check(
  "Membre gratuit (visité par Vdgrace) : aucune donnée renvoyée",
  !(r.json ?? []).length || r.status >= 400,
  `${r.status} ${r.text.slice(0, 50)}`,
);
r = await rest(null, "rpc/get_profile_visitors", "POST", {});
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Page Premium
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
const items = pv.getByTestId("visitor-item");
await items.first().waitFor({ timeout: 8000 });
const names = await items.locator("h2").allTextContents();
check(
  "Page : 4 cartes dans l'ordre, « 4 visiteurs »",
  names.length === 4 &&
    names[0].startsWith("Vdmarie") &&
    names[3].startsWith("Vdruth") &&
    (await pv.getByTestId("visitors-count").textContent()).trim() === "4 visiteurs",
  names.join(" | "),
);
const grace = await items.filter({ hasText: "Vdgrace" }).textContent();
check(
  `Carte : âge, ville, « Dernière visite le ${today} · 2 visites »`,
  grace.includes("34 ans") &&
    grace.includes("Douala") &&
    grace.includes(`Dernière visite le ${today} · 2 visites`),
  grace,
);
check(
  "Profil masqué et bloquant absents de la page",
  !(await pv.locator("main").textContent()).includes("Vdhanna") &&
    !(await pv.locator("main").textContent()).includes("Vdlea"),
);
await items
  .filter({ hasText: "Vdruth" })
  .getByRole("button", { name: "Ajouter Vdruth aux favoris" })
  .click();
const t = await toastText(pv);
check(
  "Mettre un visiteur en favori depuis la page",
  t.includes("Ajouté à vos favoris.") &&
    sql(
      `select count(*) from public.favorites where user_id='${id.v}' and favorite_user_id='${id.b}'`,
    ) === "1",
  t,
);

// C. Premium sans visiteur ; gratuit ; expiré
const pw = await login(emails.w, PWD);
await pw.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await pw.getByTestId("visitors-empty").waitFor({ timeout: 8000 });
check(
  "Premium sans visiteur : « Personne n'a encore visité votre profil. »",
  (await pw.getByTestId("visitors-empty").textContent()).trim() ===
    "Personne n'a encore visité votre profil.",
);
const pf = await login(emails.f, PWD);
await pf.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await pf.getByTestId("visitors-page").waitFor({ timeout: 8000 });
await pf.waitForTimeout(1500);
check(
  "Membre gratuit : aucune carte, aucun prénom",
  (await pf.getByTestId("visitor-item").count()) === 0 &&
    !(await pf.locator("main").textContent()).includes("Vdgrace"),
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.v}'`,
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByTestId("visitors-page").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1500);
r = await rest(tv, "rpc/get_profile_visitors", "POST", {});
check(
  "Premium expiré : plus aucune donnée ni carte",
  (!(r.json ?? []).length || r.status >= 400) &&
    (await pv.getByTestId("visitor-item").count()) === 0,
);
const small = await login(emails.w, PWD, 320);
await small.goto(`${BASE}/visiteurs`, { waitUntil: "networkidle" });
await small.getByTestId("visitors-empty").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes, abonnements, visites et favoris de test supprimés",
  cleanup() &&
    sql(
      `select count(*) from public.profile_visits where visited_user_id in ('${id.v}','${id.f}')`,
    ) === "0",
);
finish();
