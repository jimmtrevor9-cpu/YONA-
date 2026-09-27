// YONA — Phase 8 / Étape 8.4 — Vérification : pas de favori en double.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.4-favoris-doublons.mjs
import {
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("f84", {
  v: ["male", "Fopaul"],
  a: ["female", "Fograce"],
  b: ["female", "Foruth"],
  c: ["female", "Foeve"],
  d: ["female", "Folea"],
});
const rows = (u, x) =>
  sql(
    `select count(*) from public.favorites where user_id='${id[u]}' and favorite_user_id='${id[x]}'`,
  );
const createdAt = (u, x) =>
  sql(
    `select created_at from public.favorites where user_id='${id[u]}' and favorite_user_id='${id[x]}'`,
  );

// A. Base : contrainte d'unicité
const tv = await tokenOf(emails.v, PWD);
const ta = await tokenOf(emails.a, PWD);
const insert = async (token, u, x) =>
  (await rest(token, "favorites", "POST", { user_id: id[u], favorite_user_id: id[x] })).status;
check("1er favori direct V → B : accepté (201)", (await insert(tv, "v", "b")) === 201);
check(
  "2e favori direct V → B : refusé (409), 1 seule ligne",
  (await insert(tv, "v", "b")) === 409 && rows("v", "b") === "1",
);
const burst = await Promise.all(Array.from({ length: 10 }, () => insert(tv, "v", "c")));
check(
  "10 favoris simultanés V → C : 1 accepté, 9 refusés, 1 seule ligne",
  burst.filter((s) => s === 201).length === 1 &&
    burst.filter((s) => s === 409).length === 9 &&
    rows("v", "c") === "1",
  burst.join(","),
);
check(
  "Sens inverse (A → V) : favori distinct autorisé",
  (await insert(ta, "a", "v")) === 201 && rows("a", "v") === "1",
);

// B. Deux onglets
const { browser, jsErrors, login } = await openBrowser();
let captured = null;
const tab1 = await login(emails.v, PWD);
const tab2 = await login(emails.v, PWD);
tab2.on("request", (r) => {
  if (r.url().includes("/_serverFn/") && r.method() === "POST" && !captured)
    captured = { url: r.url(), headers: r.headers(), body: r.postData() };
});
await tab1.waitForTimeout(1500);
await tab2.waitForTimeout(1500);
const star = (p, name) =>
  p
    .locator("article")
    .filter({ hasText: `${name} ` })
    .getByTestId("favorite-button");

await star(tab1, "Fograce").click();
const t1 = await toastText(tab1);
check("Onglet 1 : « Ajouté à vos favoris. »", t1.includes("Ajouté à vos favoris."), t1);
const firstDate = createdAt("v", "a");
check(
  "Onglet 2 (pas encore à jour) : étoile encore vide",
  (await star(tab2, "Fograce").getAttribute("aria-pressed")) === "false",
);
await star(tab2, "Fograce").click();
const t2 = await toastText(tab2);
check(
  "Onglet 2 : « Ce profil est déjà dans vos favoris. »",
  t2.includes("Ce profil est déjà dans vos favoris."),
  t2,
);
await tab2.waitForTimeout(800);
check(
  "Onglet 2 : l'étoile devient pleine (état réel)",
  (await star(tab2, "Fograce").getAttribute("aria-pressed")) === "true",
);
check(
  "1 seule ligne V → Fograce, date d'origine inchangée",
  rows("v", "a") === "1" && createdAt("v", "a") === firstDate,
);

// C. Même appel serveur rejoué 5 fois en parallèle
const replay = captured
  ? await Promise.all(
      Array.from({ length: 5 }, () =>
        fetch(captured.url, {
          method: "POST",
          headers: Object.fromEntries(
            Object.entries(captured.headers).filter(
              ([k]) => !["host", "content-length", "connection"].includes(k),
            ),
          ),
          body: captured.body,
        }).then(async (r) => ({ status: r.status, text: await r.text() })),
      ),
    )
  : [];
check(
  "Appel serveur rejoué 5 fois en parallèle : tous acceptés sans erreur, 1 seule ligne",
  replay.length === 5 &&
    replay.every((r) => r.status === 200 && r.text.includes("alreadyFavorite")) &&
    rows("v", "a") === "1" &&
    createdAt("v", "a") === firstDate,
  replay.map((r) => r.status).join(","),
);

// D. Retrait en double (deux onglets)
await star(tab1, "Fograce").click();
await tab1.waitForTimeout(300);
const t3 = await toastText(tab1);
check("Onglet 1 : « Retiré de vos favoris. »", t3.includes("Retiré de vos favoris."), t3);
for (let i = 0; i < 80 && (await tab2.locator("[data-sonner-toast]").count()) > 0; i++)
  await tab2.waitForTimeout(100);
await star(tab2, "Fograce").click();
const t4 = await toastText(tab2);
check(
  "Onglet 2 : « Ce profil n'était déjà plus dans vos favoris. »",
  t4.includes("Ce profil n'était déjà plus dans vos favoris."),
  t4,
);
await tab2.waitForTimeout(800);
check(
  "Onglet 2 : l'étoile devient vide ; aucune ligne",
  (await star(tab2, "Fograce").getAttribute("aria-pressed")) === "false" && rows("v", "a") === "0",
);

// E. Clics répétés très rapides : l'écran reste fidèle à la base
for (let i = 0; i < 6; i++) await star(tab1, "Folea").click({ force: true, delay: 0 });
await tab1.waitForTimeout(2500);
const pressed = await star(tab1, "Folea").getAttribute("aria-pressed");
check(
  "6 clics rapides : au plus 1 ligne, étoile conforme à la base",
  Number(rows("v", "d")) <= 1 && (pressed === "true") === (rows("v", "d") === "1"),
  `lignes ${rows("v", "d")}, étoile ${pressed}`,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Toujours au plus 1 favori par couple",
  sql(
    `select count(*) from (select 1 from public.favorites where user_id in ('${Object.values(id).join("','")}') group by user_id, favorite_user_id having count(*) > 1) t`,
  ) === "0",
);
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.favorites where user_id in ('${id.v}','${id.a}')`) === "0",
);
finish();
