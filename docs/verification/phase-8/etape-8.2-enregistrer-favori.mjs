// YONA — Phase 8 / Étape 8.2 — Vérification de l'enregistrement d'un favori.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.2-enregistrer-favori.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("f82", {
  v: ["male", "Fepaul"],
  a: ["female", "Fegrace"],
  b: ["female", "Feruth"],
  h: ["female", "Fehanna"],
  k: ["female", "Felea"],
  m: ["female", "Femarie"],
  s: ["female", "Fesarah"],
});
const matchId = match(id, "v", "m");
const favs = (u = id.v) =>
  sql(
    `select string_agg(favorite_user_id::text, ',' order by favorite_user_id) from public.favorites where user_id='${u}'`,
  );
const has = (x, u = id.v) =>
  sql(`select count(*) from public.favorites where user_id='${u}' and favorite_user_id='${x}'`) ===
  "1";

const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.waitForTimeout(1500);
const card = (name) => pv.locator("article").filter({ hasText: `${name} ` });
const star = (name) => card(name).getByTestId("favorite-button");

// A. Ajout depuis Découvrir
await star("Fegrace").click();
const t1 = await toastText(pv);
check("Découvrir : message « Ajouté à vos favoris. »", t1.includes("Ajouté à vos favoris."), t1);
check("Découvrir : favori enregistré dans la base", has(id.a));
check(
  "Découvrir : l'étoile devient « Retirer Fegrace des favoris », enfoncée et pleine",
  (await star("Fegrace").getAttribute("aria-label")) === "Retirer Fegrace des favoris" &&
    (await star("Fegrace").getAttribute("aria-pressed")) === "true" &&
    (await star("Fegrace").locator("svg.fill-gold").count()) === 1,
);
check(
  "Date d'ajout fixée par le serveur (il y a moins d'une minute)",
  sql(
    `select (now() - created_at) < interval '1 minute' from public.favorites where user_id='${id.v}' and favorite_user_id='${id.a}'`,
  ) === "t",
);
check(
  "Le profil reste dans Découvrir (un favori n'est pas un like)",
  (await card("Fegrace").count()) === 1 &&
    sql(`select count(*) from public.likes where sender_id='${id.v}'`) === "1",
);
await pv.reload({ waitUntil: "networkidle" });
await pv.waitForTimeout(1500);
check(
  "Après rechargement : l'étoile de Fegrace est toujours pleine",
  (await star("Fegrace").getAttribute("aria-pressed")) === "true",
);

// B. Profil devenu indisponible entre l'affichage et le clic
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
await star("Fehanna").click();
const t2 = await toastText(pv);
check(
  "Profil masqué entre-temps : « Ce profil n'est plus disponible. »",
  t2.includes("Ce profil n'est plus disponible."),
  t2,
);
await pv.waitForTimeout(800);
check(
  "Profil masqué : rien d'enregistré et l'étoile redevient vide",
  !has(id.h) &&
    ((await star("Fehanna").count()) === 0 ||
      (await star("Fehanna").getAttribute("aria-pressed")) === "false"),
);

// C. Ajout depuis le profil d'un Match
await pv.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pv.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pv.getByRole("button", { name: "Ajouter Femarie aux favoris" }).click();
const t3 = await toastText(pv);
check(
  "Profil du Match : « Ajouté à vos favoris. » et favori enregistré",
  t3.includes("Ajouté à vos favoris.") && has(id.m),
  t3,
);
check(
  "Profil du Match : bouton devenu « Retirer Femarie des favoris »",
  (await pv.getByRole("button", { name: "Retirer Femarie des favoris" }).count()) === 1,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// D. Sécurité côté serveur (appels directs à la base)
const tv = await tokenOf(emails.v, PWD);
const ins = (token, body) => rest(token, "favorites", "POST", body);
let r = await ins(tv, { user_id: id.v, favorite_user_id: id.b });
check("Appel direct valide : accepté (201)", r.status === 201 && has(id.b), r.text.slice(0, 80));
r = await ins(tv, { user_id: id.b, favorite_user_id: id.k });
check(
  "Ajouter au nom d'un autre membre : refusé",
  r.status >= 400 && !has(id.k, id.b),
  `${r.status}`,
);
r = await ins(null, { user_id: id.v, favorite_user_id: id.k });
check("Visiteur non connecté : refusé", r.status >= 400 && !has(id.k), `${r.status}`);
r = await ins(tv, { user_id: id.v, favorite_user_id: id.h });
check("Profil masqué : refusé", r.status >= 400 && !has(id.h), `${r.status}`);
sql(`update public.profiles set status='suspended' where user_id='${id.s}'`);
r = await ins(tv, { user_id: id.v, favorite_user_id: id.s });
check("Profil suspendu : refusé", r.status >= 400 && !has(id.s), `${r.status}`);
sql(`update public.profiles set status='active' where user_id='${id.s}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
r = await ins(tv, { user_id: id.v, favorite_user_id: id.k });
check("Membre qui m'a bloqué : refusé", r.status >= 400 && !has(id.k), `${r.status}`);
sql(`delete from public.blocks where blocker_id='${id.k}'`);
sql(`update public.profiles set status='suspended' where user_id='${id.v}'`);
r = await ins(tv, { user_id: id.v, favorite_user_id: id.s });
check("Mon propre profil suspendu : refusé", r.status >= 400 && !has(id.s), `${r.status}`);
sql(`update public.profiles set status='active' where user_id='${id.v}'`);
r = await ins(tv, {
  user_id: id.v,
  favorite_user_id: id.k,
  created_at: "2000-01-01T00:00:00Z",
});
check(
  "Date d'ajout imposée par le client : ignorée (date du serveur)",
  r.status === 201 &&
    sql(
      `select extract(year from created_at) > 2000 from public.favorites where user_id='${id.v}' and favorite_user_id='${id.k}'`,
    ) === "t",
  `${r.status}`,
);
r = await rest(tv, `favorites?user_id=eq.${id.v}&favorite_user_id=eq.${id.k}`, "PATCH", {
  favorite_user_id: id.s,
});
check(
  "Modifier un favori existant : refusé",
  r.status >= 400 && has(id.k) && !has(id.s),
  `${r.status}`,
);
check(
  "Aucun favori enregistré pour un autre membre par ces appels",
  sql(
    `select count(*) from public.favorites where user_id<>'${id.v}' and user_id in ('${Object.values(id).join("','")}')`,
  ) === "0",
);
check(
  "Favoris finaux de Fepaul : Fegrace, Feruth, Felea, Femarie",
  favs() === [id.a, id.b, id.k, id.m].sort().join(","),
);
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() && sql(`select count(*) from public.favorites where user_id='${id.v}'`) === "0",
);
finish();
