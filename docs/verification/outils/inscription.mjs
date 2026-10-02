// YONA — Outils communs : inscription (parcours du 2 octobre 2026).
// Parcours : /register → compte (e-mail + mot de passe) → e-mail de confirmation (Mailpit)
// → /onboarding : création du profil en 4 étapes (profil, bio, lieu, « reste au courant »)
// → fenêtre des conditions → page des profils.

const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";

/**
 * Crée le compte depuis /register. Laisse la page sur l'écran affiché ensuite
 * (« Consultez votre boîte mail », /onboarding si la confirmation est désactivée, ou le
 * formulaire si une erreur est apparue).
 * @param {import("playwright").Page} page
 * @param {{ base: string, email: string, password: string }} o
 */
export async function creerCompte(page, o) {
  await page.goto(`${o.base}/register`, { waitUntil: "networkidle" });
  await page.getByTestId("signup-start").click();
  await page.fill("#email", o.email);
  await page.fill("#password", o.password);
  await page.getByTestId("account-submit").click();
  await Promise.race([
    page.getByText("Consultez votre boîte mail").waitFor({ timeout: 8000 }),
    page.waitForURL(/\/onboarding$/, { timeout: 8000 }),
    page.locator("[data-sonner-toast]").first().waitFor({ timeout: 8000 }),
  ]).catch(() => {});
}

/** Lien de confirmation reçu dans Mailpit pour cette adresse (ou null). */
export async function lienDeConfirmation(page, email) {
  for (let i = 0; i < 30; i++) {
    const list = await (
      await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)
    ).json();
    if (list.messages?.[0]) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      const link = (full.HTML || full.Text)
        .match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]
        ?.replaceAll("&amp;", "&");
      if (link) return link;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

/** Choisit une valeur dans une liste Pays / Province / Ville (recherche puis clic). */
export async function choisirLieu(page, id, value) {
  await page.getByTestId(`place-${id}`).click();
  await page.getByTestId(`place-${id}-search`).fill(value);
  const exact = page.getByRole("option", { name: value, exact: true });
  if (await exact.count()) await exact.first().click();
  else await page.getByRole("button", { name: `Utiliser « ${value} »` }).click();
}

/**
 * Remplit les 4 étapes de la création du profil puis accepte les conditions.
 * S'arrête sur l'étape où un message d'erreur apparaît.
 * @param {import("playwright").Page} page
 * @param {{ firstName: string, gender?: "Homme" | "Femme", birthDate?: string,
 *   country?: string, region?: string, city?: string, accept?: boolean }} o
 */
export async function remplirParcours(page, o) {
  const next = () => page.getByTestId("signup-next").click();
  await page.getByText("Étape 1 sur 4").waitFor({ timeout: 10000 });
  await page.fill("#firstName", o.firstName);
  await page.fill("#birthDate", o.birthDate ?? "1995-06-15");
  await page
    .getByTestId("choice-gender")
    .getByRole("radio", { name: o.gender ?? "Femme", exact: true })
    .click();
  await next();
  if (!(await page.getByText("Étape 2 sur 4").isVisible())) return;
  await page.getByRole("button", { name: "Continuer" }).click();
  await choisirLieu(page, "country", o.country ?? "Cameroun");
  await choisirLieu(page, "region", o.region ?? "Littoral");
  await choisirLieu(page, "city", o.city ?? "Douala");
  await page.getByTestId("choice-purpose").getByRole("radio", { name: "Me marier" }).click();
  await next();
  if (!(await page.getByText("Étape 4 sur 4").isVisible())) return;
  await page.getByTestId("choice-marketing").getByRole("radio", { name: "Non merci" }).click();
  await next();
  if (o.accept === false) return;
  const dialog = page.getByTestId("terms-dialog");
  await dialog.waitFor({ timeout: 3000 }).catch(() => {});
  if (!(await dialog.isVisible())) return;
  await page.locator("#certify").click();
  await page.getByTestId("terms-accept").click();
}

/**
 * Inscription complète par e-mail : compte, confirmation, puis création du profil.
 * Laisse la page sur l'écran affiché à la fin (normalement /discover).
 * @param {import("playwright").Page} page
 * @param {{ base: string, firstName: string, email: string, password: string,
 *   gender?: "Homme" | "Femme", birthDate?: string, city?: string, region?: string,
 *   country?: string }} o
 */
export async function inscrireParEmail(page, o) {
  await creerCompte(page, o);
  if (await page.getByText("Consultez votre boîte mail").isVisible()) {
    const link = await lienDeConfirmation(page, o.email);
    if (!link) return;
    await page.goto(link, { waitUntil: "networkidle" });
  }
  await page.waitForURL(/\/onboarding$/, { timeout: 10000 }).catch(() => {});
  if (!page.url().endsWith("/onboarding")) return;
  await remplirParcours(page, o);
}
