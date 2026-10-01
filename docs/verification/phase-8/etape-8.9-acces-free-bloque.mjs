// YONA — Phase 8 / Étape 8.9 — Vérification : « Qui m'a mis en favori » bloqué aux Free.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.9-acces-free-bloque.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("f89", {
  f: ["male", "Fdpaul"],
  a: ["female", "Fdgrace"],
  b: ["female", "Fdruth"],
  c: ["female", "Fdeve"],
});
for (const x of ["a", "b"])
  sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id[x]}','${id.f}')`);
const tf = await tokenOf(emails.f, PWD);
const call = () => rest(tf, "rpc/get_favorited_by", "POST", {});
const refused = (r) =>
  r.status >= 400 &&
  r.text.includes("premium_required") &&
  !r.text.includes("Fdgrace") &&
  !r.text.includes("Fdruth");
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
r = await rest(tf, "subscriptions", "POST", {
  user_id: id.f,
  status: "active",
  starts_at: new Date(Date.now() - 86400000).toISOString(),
  expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
});
check(
  "Se déclarer Premium soi-même (écriture directe) : refusé",
  r.status >= 400 &&
    sql(`select count(*) from public.subscriptions where user_id='${id.f}'`) === "0",
  `${r.status}`,
);
check("Toujours refusé ensuite", refused(await call()));
r = await rest(null, "rpc/get_favorited_by", "POST", {});
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Interface gratuite
const { browser, jsErrors, login } = await openBrowser();
const pf = await login(emails.f, PWD);
const bodies = [];
pf.on("response", async (res) => {
  if (!/54321|_serverFn/.test(res.url())) return;
  bodies.push(await res.text().catch(() => ""));
});
await pf.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
const locked = pf.getByTestId("favorited-by-locked");
await locked.waitFor({ timeout: 8000 });
const lockedText = await locked.textContent();
check(
  "Page Favoris : « Ils vous ont mis en favori » verrouillé, « Réservé aux membres Premium »",
  lockedText.includes("Ils vous ont mis en favori") &&
    lockedText.includes("Réservé aux membres Premium"),
  lockedText,
);
check(
  "Aucun prénom ni nombre affiché dans l'encart verrouillé",
  !/Fdgrace|Fdruth|\d/.test(lockedText) &&
    (await pf.getByTestId("favorited-by-item").count()) === 0,
);
await pf.waitForTimeout(800);
check(
  "Aucune réponse du serveur reçue par la page ne contient les prénoms des membres concernés",
  bodies.length > 0 && !bodies.some((b) => b.includes("Fdgrace") || b.includes("Fdruth")),
  `${bodies.length} réponses`,
);
await pf.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pf.waitForTimeout(1500);
await pf.locator("article").filter({ hasText: "Fdeve " }).getByTestId("favorite-button").click();
const t = await toastText(pf);
check(
  "Le membre gratuit peut toujours ajouter ses propres favoris",
  t.includes("Ajouté à vos favoris."),
  t,
);
await pf.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await pf.getByTestId("favorite-item").first().waitFor({ timeout: 8000 });
check(
  "… et les voir dans « Vos favoris »",
  (await pf.getByTestId("favorite-item").filter({ hasText: "Fdeve" }).count()) === 1,
);

// C. Devenir Premium, puis expiration
setSub("active", "-1 day", "30 days");
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("favorited-by").waitFor({ timeout: 8000 });
check(
  "Devenu Premium : la liste remplace l'encart (Fdruth, Fdgrace)",
  (await pf.getByTestId("favorited-by-locked").count()) === 0 &&
    (await pf.getByTestId("favorited-by-item").count()) === 2,
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.f}'`,
);
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("favorited-by-locked").waitFor({ timeout: 8000 });
check(
  "Premium expiré : de nouveau verrouillé, plus aucune carte",
  (await pf.getByTestId("favorited-by-item").count()) === 0,
);
const small = await login(emails.f, PWD, 320);
await small.goto(`${BASE}/favoris`, { waitUntil: "networkidle" });
await small.getByTestId("favorited-by-locked").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : encart visible, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes, abonnements et favoris de test supprimés",
  cleanup() && sql(`select count(*) from public.subscriptions where user_id='${id.f}'`) === "0",
);
finish();
