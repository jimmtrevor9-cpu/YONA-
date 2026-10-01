// YONA — Outil commun : inscription par e-mail avec le nouveau parcours en 4 étapes
// (profil, bio, lieu, « reste au courant ») puis la fenêtre des conditions.
// Laisse la page sur l'écran affiché après « J'accepte » (normalement « Consultez votre
// boîte mail »), ou sur l'étape où un message d'erreur est apparu.

/**
 * @param {import("playwright").Page} page
 * @param {{ base: string, firstName: string, email: string, password: string,
 *   gender?: "Homme" | "Femme", birthDate?: string, city?: string, country?: string }} o
 */
export async function inscrireParEmail(page, o) {
  const next = () => page.getByTestId("signup-next").click();
  await page.goto(`${o.base}/register`, { waitUntil: "networkidle" });
  await page.getByTestId("signup-start").click();
  await page.fill("#firstName", o.firstName);
  await page.fill("#birthDate", o.birthDate ?? "1995-06-15");
  await page
    .getByTestId("choice-gender")
    .getByRole("radio", { name: o.gender ?? "Femme", exact: true })
    .click();
  await next();
  if (!(await page.getByText("Étape 2 sur 4").isVisible())) return;
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.fill("#country", o.country ?? "Cameroun");
  await page.fill("#city", o.city ?? "Douala");
  await page.getByTestId("choice-purpose").getByRole("radio", { name: "Me marier" }).click();
  await next();
  await page.getByTestId("choice-marketing").getByRole("radio", { name: "Non merci" }).click();
  await page.fill("#email", o.email);
  await page.fill("#password", o.password);
  await next();
  const dialog = page.getByTestId("terms-dialog");
  await dialog.waitFor({ timeout: 3000 }).catch(() => {});
  if (!(await dialog.isVisible())) return;
  await page.locator("#certify").click();
  await page.getByTestId("terms-accept").click();
}
