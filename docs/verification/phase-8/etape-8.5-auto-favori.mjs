// YONA — Phase 8 / Étape 8.5 — Vérification : impossible de se mettre soi-même en favori.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-8/etape-8.5-auto-favori.mjs
import {
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  sqlError,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("f85", {
  v: ["male", "Fupaul"],
  a: ["female", "Fugrace"],
});
const selfRows = () =>
  sql(`select count(*) from public.favorites where user_id=favorite_user_id and user_id='${id.v}'`);
const tv = await tokenOf(emails.v, PWD);

// A. Base et règles d'accès
let r = await rest(tv, "favorites", "POST", { user_id: id.v, favorite_user_id: id.v });
check("Appel direct V → V : refusé", r.status >= 400 && selfRows() === "0", `${r.status}`);
r = await rest(tv, "favorites", "POST", { user_id: id.v, favorite_user_id: id.v.toUpperCase() });
check(
  "Appel direct V → V (MAJUSCULES) : refusé",
  r.status >= 400 && selfRows() === "0",
  `${r.status}`,
);
const e1 = sqlError(
  `insert into public.favorites (user_id, favorite_user_id) values ('${id.v}','${id.v}')`,
);
check(
  "Même avec les droits complets (serveur) : contrainte favorites_no_self",
  e1.includes("favorites_no_self") && selfRows() === "0",
  e1.split("\n")[0],
);
sql(`insert into public.favorites (user_id, favorite_user_id) values ('${id.v}','${id.a}')`);
r = await rest(tv, `favorites?user_id=eq.${id.v}`, "PATCH", { favorite_user_id: id.v });
check(
  "Transformer un favori en auto-favori (membre) : refusé",
  r.status >= 400 && selfRows() === "0",
  `${r.status}`,
);
const e2 = sqlError(`update public.favorites set favorite_user_id=user_id where user_id='${id.v}'`);
check(
  "Transformer un favori en auto-favori (droits complets) : contrainte favorites_no_self",
  e2.includes("favorites_no_self") && selfRows() === "0",
  e2.split("\n")[0],
);
sql(`delete from public.favorites where user_id='${id.v}'`);

// B. Interface et fonction serveur
const { browser, jsErrors, login } = await openBrowser();
let captured = null;
const pv = await login(emails.v, PWD);
pv.on("request", (req) => {
  if (req.url().includes("/_serverFn/") && req.method() === "POST" && !captured)
    captured = { url: req.url(), headers: req.headers(), body: req.postData() };
});
await pv.waitForTimeout(1500);
check(
  "Découvrir : son propre profil n'est jamais proposé (aucune étoile « Fupaul »)",
  (await pv.getByRole("button", { name: /Fupaul/ }).count()) === 0 &&
    (await pv.locator("article").filter({ hasText: "Fupaul " }).count()) === 0,
);
await pv.locator("article").filter({ hasText: "Fugrace " }).getByTestId("favorite-button").click();
const t = await toastText(pv);
check("Ajouter un autre profil fonctionne toujours", t.includes("Ajouté à vos favoris."), t);

const replay = async (profileId) => {
  if (!captured) return { status: 0, text: "" };
  const res = await fetch(captured.url, {
    method: "POST",
    headers: Object.fromEntries(
      Object.entries(captured.headers).filter(
        ([k]) => !["host", "content-length", "connection"].includes(k),
      ),
    ),
    body: captured.body.replace(id.a, profileId),
  });
  return { status: res.status, text: await res.text() };
};
const own = "Vous ne pouvez pas ajouter votre propre profil à vos favoris.";
const s1 = await replay(id.v);
check(
  "Fonction serveur avec son propre identifiant : refus « Vous ne pouvez pas ajouter votre propre profil… »",
  captured !== null && s1.text.includes(own) && selfRows() === "0",
  `${s1.status}`,
);
const s2 = await replay(id.v.toUpperCase());
check(
  "Fonction serveur avec son propre identifiant en MAJUSCULES : même refus",
  s2.text.includes(own) && selfRows() === "0",
  `${s2.status}`,
);
check(
  "Aucun détail technique de base de données renvoyé",
  !/favorites_no_self|violates|42501|23514/.test(s1.text + s2.text),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Aucun auto-favori dans toute la base",
  sql(`select count(*) from public.favorites where user_id=favorite_user_id`) === "0",
);
check(
  "Nettoyage : comptes et favoris de test supprimés",
  cleanup() && sql(`select count(*) from public.favorites where user_id='${id.v}'`) === "0",
);
finish();
