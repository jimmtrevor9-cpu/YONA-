// YONA — Phase 8 / Étape 8.8 — Vérification : Premium voit qui l'a mis en favori.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.8-qui-ma-favorise.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("f88", {
  v: ["male", "Fcpaul"],
  a: ["female", "Fcgrace"],
  b: ["female", "Fcruth"],
  c: ["female", "Fceve"],
  h: ["female", "Fchanna"],
  k: ["female", "Fclea"],
  f: ["male", "Fcfree"],
  w: ["male", "Fcwill"],
});
const premium = (u, active = true) =>
  sql(
    `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id[u]}', 'active', now() - interval '1 day', now() + interval '${active ? "30 days" : "-1 hour"}')`,
  );
premium("v");
premium("w");
for (const x of ["a", "b", "c", "h", "k"]) {
  sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id[x]}','${id.v}')`);
  sql("select pg_sleep(0.05)");
}
sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id.a}','${id.f}')`);
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.v}','${id.k}')`);
const today = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

// A. Base
const tv = await tokenOf(emails.v, PWD);
const tf = await tokenOf(emails.f, PWD);
let r = await rest(tv, "rpc/get_favorited_by", "POST", {});
const rows = r.json ?? [];
check(
  "Premium : 3 membres (Fceve, Fcruth, Fcgrace), les plus récents d'abord",
  r.status === 200 && rows.map((x) => x.first_name).join(",") === "Fceve,Fcruth,Fcgrace",
  rows.map((x) => x.first_name).join(","),
);
check(
  "Données renvoyées limitées au profil public (prénom, naissance, ville, pays, date)",
  rows.length > 0 &&
    Object.keys(rows[0]).sort().join(",") ===
      "birth_date,city,country,favorited_at,first_name,user_id",
  rows.length ? Object.keys(rows[0]).join(",") : "",
);
check(
  "Profil masqué et membre bloqué : non renvoyés",
  !rows.some((x) => x.user_id === id.h || x.user_id === id.k),
);
r = await rest(tf, "rpc/get_favorited_by", "POST", {});
check(
  "Membre gratuit (mis en favori par Fcgrace) : aucune donnée renvoyée",
  !(r.json ?? []).length || r.status >= 400,
  `${r.status} ${r.text.slice(0, 60)}`,
);
r = await rest(null, "rpc/get_favorited_by", "POST", {});
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Interface Premium
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
const section = pv.getByTestId("favorited-by");
await section.waitFor({ timeout: 8000 });
const items = section.getByTestId("favorited-by-item");
await items.first().waitFor({ timeout: 8000 });
const names = await items.locator("h2").allTextContents();
check(
  "Page Favoris : section « Ils vous ont mis en favori » avec Fceve, Fcruth, Fcgrace",
  (await section.textContent()).includes("Ils vous ont mis en favori") &&
    names.length === 3 &&
    names[0].startsWith("Fceve") &&
    names[2].startsWith("Fcgrace"),
  names.join(" | "),
);
check(
  "« 3 membres vous ont mis en favori »",
  (await section.getByTestId("favorited-by-count").textContent()).trim() ===
    "3 membres vous ont mis en favori",
);
const grace = items.filter({ hasText: "Fcgrace" });
check(
  `Carte : âge, ville, « Vous a ajouté le ${today} »`,
  (await grace.textContent()).includes("34 ans") &&
    (await grace.textContent()).includes("Douala") &&
    (await grace.textContent()).includes(`Vous a ajouté le ${today}`),
  await grace.textContent(),
);
check(
  "Profil masqué et bloqué absents de la page",
  !(await section.textContent()).includes("Fchanna") &&
    !(await section.textContent()).includes("Fclea"),
);
await grace.getByRole("button", { name: "Ajouter Fcgrace aux favoris" }).click();
const t = await toastText(pv);
await pv.waitForTimeout(1200);
check(
  "Ajouter en retour depuis la section : enregistré, et visible dans « Vos favoris »",
  t.includes("Ajouté à vos favoris.") &&
    sql(
      `select count(*) from public.favorites where user_id='${id.v}' and favorite_user_id='${id.a}'`,
    ) === "1" &&
    (await pv.getByTestId("favorite-item").filter({ hasText: "Fcgrace" }).count()) === 1,
  t,
);

// C. Premium sans personne, gratuit, Premium expiré
const pw = await login(emails.w, PWD);
await pw.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await pw.getByTestId("favorited-by-empty").waitFor({ timeout: 8000 });
check(
  "Premium sans favori reçu : « Personne ne vous a encore mis en favori. »",
  (await pw.getByTestId("favorited-by-empty").textContent()).trim() ===
    "Personne ne vous a encore mis en favori.",
);
const pf = await login(emails.f, PWD);
await pf.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await pf.getByTestId("favorites-page").waitFor({ timeout: 8000 });
await pf.waitForTimeout(1500);
check(
  "Membre gratuit : aucune liste « Ils vous ont mis en favori », aucun prénom",
  (await pf.getByTestId("favorited-by-item").count()) === 0 &&
    !(await pf.locator("main").textContent()).includes("Fcgrace"),
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.v}'`,
);
r = await rest(tv, "rpc/get_favorited_by", "POST", {});
check(
  "Premium expiré : plus aucune donnée",
  !(r.json ?? []).length || r.status >= 400,
  `${r.status}`,
);
await pv.reload({ waitUntil: "networkidle" });
await pv.getByTestId("favorites-page").waitFor({ timeout: 8000 });
await pv.waitForTimeout(1500);
check(
  "Premium expiré : la liste disparaît de la page",
  (await pv.getByTestId("favorited-by-item").count()) === 0,
);

const small = await login(emails.w, PWD, 320);
await small.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await small.getByTestId("favorited-by").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes, abonnements et favoris de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.subscriptions where user_id in ('${id.v}','${id.w}')`) === "0",
);
finish();
