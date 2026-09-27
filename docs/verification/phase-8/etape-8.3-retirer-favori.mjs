// YONA — Phase 8 / Étape 8.3 — Vérification du retrait d'un favori.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.3-retirer-favori.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("f83", {
  v: ["male", "Fipaul"],
  a: ["female", "Figrace"],
  b: ["female", "Firuth"],
  h: ["female", "Fihanna"],
  k: ["female", "Filea"],
  m: ["female", "Fimarie"],
  o: ["male", "Fiomer"],
});
const matchId = match(id, "v", "m");
const fav = (u, x) => `('${id[u]}','${id[x]}')`;
sql(
  `insert into public.favorites (user_id, favorite_user_id) values ${[
    fav("v", "a"),
    fav("v", "b"),
    fav("v", "h"),
    fav("v", "k"),
    fav("v", "m"),
    fav("o", "a"),
  ].join(",")}`,
);
const has = (x, u = "v") =>
  sql(
    `select count(*) from public.favorites where user_id='${id[u]}' and favorite_user_id='${id[x]}'`,
  ) === "1";
const waitToastGone = async (p) => {
  for (let i = 0; i < 80 && (await p.locator("[data-sonner-toast]").count()) > 0; i++)
    await p.waitForTimeout(100);
};

const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.waitForTimeout(1500);
const card = (name) => pv.locator("article").filter({ hasText: `${name} ` });
const star = (name) => card(name).getByTestId("favorite-button");

// A. Retrait depuis Découvrir
check(
  "Découvrir : Figrace en favori (« Retirer Figrace des favoris »)",
  (await star("Figrace").getAttribute("aria-label")) === "Retirer Figrace des favoris",
);
await star("Figrace").click();
const t1 = await toastText(pv);
check("Clic : message « Retiré de vos favoris. »", t1.includes("Retiré de vos favoris."), t1);
check("Favori supprimé de la base", !has("a"));
check(
  "L'étoile redevient « Ajouter Figrace aux favoris », non enfoncée et vide",
  (await star("Figrace").getAttribute("aria-label")) === "Ajouter Figrace aux favoris" &&
    (await star("Figrace").getAttribute("aria-pressed")) === "false" &&
    (await star("Figrace").locator("svg.fill-gold").count()) === 0,
);
check("Le favori d'un autre membre sur Figrace n'est pas touché", has("a", "o"));
check("Les autres favoris de Fipaul restent", has("b") && has("m"));
await pv.reload({ waitUntil: "networkidle" });
await pv.waitForTimeout(1500);
check(
  "Après rechargement : l'étoile de Figrace reste vide",
  (await star("Figrace").getAttribute("aria-pressed")) === "false",
);
await star("Figrace").click();
const t2 = await toastText(pv);
check(
  "Ajouter à nouveau après retrait : accepté",
  t2.includes("Ajouté à vos favoris.") && has("a"),
  t2,
);
await waitToastGone(pv);
await star("Figrace").click();
const t3 = await toastText(pv);
check("Puis retirer encore : accepté", t3.includes("Retiré de vos favoris.") && !has("a"), t3);

// B. Retrait depuis le profil d'un Match
await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pv.getByRole("button", { name: "Retirer Fimarie des favoris" }).click();
const t4 = await toastText(pv);
check(
  "Profil du Match : « Retiré de vos favoris. » et favori supprimé",
  t4.includes("Retiré de vos favoris.") && !has("m"),
  t4,
);
check(
  "Profil du Match : bouton redevenu « Ajouter Fimarie aux favoris »",
  (await pv.getByRole("button", { name: "Ajouter Fimarie aux favoris" }).count()) === 1,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// C. Sécurité côté serveur (appels directs à la base)
const tv = await tokenOf(emails.v, PWD);
const to = await tokenOf(emails.o, PWD);
const del = (token, u, x) =>
  rest(token, `favorites?user_id=eq.${id[u]}&favorite_user_id=eq.${id[x]}`, "DELETE");
let r = await del(to, "v", "b");
check(
  "Un autre membre ne peut pas retirer mes favoris",
  has("b") && (r.status >= 400 || r.json?.length === 0),
  `${r.status}`,
);
r = await del(null, "v", "b");
check("Visiteur non connecté : refusé", has("b") && r.status >= 400, `${r.status}`);
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
r = await del(tv, "v", "h");
check("Retrait d'un profil masqué depuis : possible", r.status === 200 && !has("h"), `${r.status}`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
r = await del(tv, "v", "k");
check(
  "Retrait d'un membre qui m'a bloqué : possible",
  r.status === 200 && !has("k"),
  `${r.status}`,
);
r = await del(tv, "v", "a");
check(
  "Retirer un profil qui n'est pas en favori : sans effet ni erreur",
  r.status === 200 && r.json?.length === 0,
  `${r.status}`,
);
check(
  "Favoris finaux : Fipaul → Firuth seulement ; Fiomer → Figrace",
  sql(`select count(*) from public.favorites where user_id='${id.v}'`) === "1" &&
    has("b") &&
    has("a", "o"),
);
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.favorites where user_id in ('${id.v}','${id.o}')`) === "0",
);
finish();
