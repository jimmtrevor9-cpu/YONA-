// YONA — Phase 11 / Étape 11.9 — Vérification du filtre engagement chrétien.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-11/etape-11.9-filtre-engagement.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";
import { cardNames, invalid, search } from "../outils/base-recherche.mjs";

const { check, finish } = createChecker();
const P = "Ri";
const { id, emails, PWD, cleanup } = createAccounts("r119", {
  v: ["male", "Ripaul"],
  a: ["female", "Riana"],
  b: ["female", "Ribea"],
  c: ["female", "Ricleo"],
  n: ["female", "Rinone"],
});
const faith = (u, denomination, commitment) =>
  sql(`insert into public.christian_profiles (user_id, denomination, faith_commitment) values ('${id[u]}', '${denomination}', '${commitment}')
       on conflict (user_id) do update set denomination = excluded.denomination, faith_commitment = excluded.faith_commitment`);
faith("a", "Évangélique", "Engagée dans un ministère de louange");
faith("b", "Catholique", "Groupe de maison chaque semaine");
faith("c", "Évangélique", "Pratiquante, groupe de prière");
const tv = await tokenOf(emails.v, PWD);
const s = (f) => search(tv, f, P);

// A. Serveur
let r = await s({ faith_commitment: "ministere" });
check("« ministere » (sans accent) : Riana", r.names?.join(",") === "Riana", r.names?.join(","));
r = await s({ faith_commitment: "groupe" });
check("« groupe » : Ribea et Ricleo", r.names?.join(",") === "Ribea,Ricleo", r.names?.join(","));
r = await s({ faith_commitment: "groupe", denomination: "evangelique" });
check(
  "Engagement combiné à la dénomination : Ricleo",
  r.names?.join(",") === "Ricleo",
  r.names?.join(","),
);
r = await s({ faith_commitment: "jeûne" });
check("Engagement sans profil : aucun résultat", r.status === 200 && r.names?.length === 0);
check(
  "Profil sans engagement renseigné : jamais retenu",
  !(await s({ faith_commitment: "e" })).names?.includes("Rinone"),
);
for (const [label, f] of [
  ["texte vide", { faith_commitment: " " }],
  ["plus de 100 caractères", { faith_commitment: "a".repeat(101) }],
  ["liste", { faith_commitment: ["groupe"] }],
]) {
  r = await s(f);
  check(`Refus « invalid_filter » : ${label}`, invalid(r), `${r.status} ${r.text.slice(0, 60)}`);
}
r = await rest(tv, "rpc/list_search_values", "POST", { _field: "faith_commitment" });
const mine = (r.json ?? []).map((x) => x.value).filter((v) => /ministère|maison|prière/.test(v));
check("Suggestions d'engagement : les 3 valeurs réelles", mine.length === 3, mine.join(" | "));

// B. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.waitForTimeout(800);
const opts = await pv
  .locator("#searchFaithCommitment-suggestions option")
  .evaluateAll((o) => o.map((x) => x.value));
check(
  "Champ « Engagement chrétien » avec suggestions réelles",
  opts.includes("Groupe de maison chaque semaine"),
  opts.join(" | "),
);
await pv.getByLabel("Engagement chrétien").fill("Groupe");
await pv.getByRole("button", { name: "Rechercher" }).click();
const names = await cardNames(pv, P);
check("Page, « Groupe » : Ribea, Ricleo", names.join(",") === "Ribea,Ricleo", names.join(","));
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
