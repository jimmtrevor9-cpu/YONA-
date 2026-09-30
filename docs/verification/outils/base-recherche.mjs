// YONA — Outil commun des tests de la phase 11 (recherche).
import { rest } from "./base-favoris.mjs";

/** Appel de la recherche serveur ; renvoie { status, names (triés), text }. */
export async function search(token, filters, prefix) {
  const r = await rest(token, "rpc/search_profiles", "POST", { _filters: filters, _limit: 50 });
  const names = Array.isArray(r.json)
    ? r.json
        .map((p) => p.first_name)
        .filter((n) => !prefix || n?.startsWith(prefix))
        .sort()
    : null;
  return { status: r.status, names, text: r.text };
}

/** Refus « invalid_filter » du serveur. */
export const invalid = (r) => r.status >= 400 && r.text.includes("invalid_filter");

/** Prénoms des cartes affichées sur la page Recherche (triés). */
export async function cardNames(page, prefix) {
  await page.waitForTimeout(1200);
  const names = await page.locator("article h2, article h3").allTextContents();
  return names
    .map((n) => n.split("·")[0].trim())
    .filter((n) => !prefix || n.startsWith(prefix))
    .sort();
}
