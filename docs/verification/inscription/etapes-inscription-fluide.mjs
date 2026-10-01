// YONA — Nouvelle inscription « fluide » (parcours des captures d'écran + Google).
// Vérifie : écran d'accueil de l'inscription, parcours en 4 étapes, conditions (18 ans),
// création du compte par e-mail (même appareil et autre appareil), bouton Google,
// retour de Google (profil créé depuis le brouillon), connexion Google directe,
// fenêtres d'accueil après inscription, formulaire complet gardé pour la foi.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/inscription/etapes-inscription-fluide.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { BASE, createAccounts, createChecker, rest, sql } from "../outils/base-favoris.mjs";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";
const { check, finish } = createChecker();
const stamp = Date.now();
const PREFIX = "insc";
const mail = (tag) => `test-${PREFIX}-${tag}-${stamp}@example.test`;
const PWD = "TestInscr!2026";
sql(`delete from auth.users where email like 'test-${PREFIX}-%@example.test';`);
// Un membre visible récent, pour la bulle « … vient de s'inscrire ».
const { cleanup } = createAccounts("inscv", { v: ["female", "Rebecca Nkoulou"] });
sql(
  `update public.profiles p set country='Gabon' from auth.users a where a.id=p.user_id and a.email like 'test-inscv-%'`,
);

const png = readFileSync(new URL("../../../public/icon-192.png", import.meta.url));
const photo = (n) => ({ name: `photo-${n}.png`, mimeType: "image/png", buffer: png });

const browser = await chromium.launch();
const jsErrors = [];
async function newPage(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 820 },
    permissions: [],
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 160)));
  return page;
}
const heading = (page) => page.locator("main h1").first().textContent();
async function toast(page) {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 60 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const text = (
    (await list
      .last()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return text;
}
const next = (page) => page.getByTestId("signup-next").click();
const userId = (email) => sql(`select id from auth.users where email='${email}'`);
const profileOf = (id) =>
  sql(
    `select concat_ws('|', first_name, gender, birth_date, city, region, country, status, visibility, array_length(interests,1), (terms_accepted_at is not null)) from public.profiles where user_id='${id}'`,
  );

async function confirmLink(email) {
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
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/** Remplit les étapes 1 à 3. */
async function fillSteps(page, { firstName, gender = "Femme", looking = "Hommes", photos = 0 }) {
  if (photos) {
    await page
      .getByTestId("photo-gallery")
      .setInputFiles(Array.from({ length: photos }, (_, i) => photo(i + 1)));
  }
  await page.fill("#firstName", firstName);
  await page.fill("#birthDate", "1995-06-15");
  await page.getByTestId("choice-gender").getByRole("radio", { name: gender }).click();
  await page.getByTestId("choice-looking-for").getByRole("radio", { name: looking }).click();
  await next(page);
  await page.getByTestId("chips-passions").getByRole("checkbox", { name: "Louange" }).click();
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.fill("#country", "Cameroun");
  await page.fill("#region", "Centre");
  await page.fill("#city", "Yaoundé");
  await page
    .getByTestId("choice-purpose")
    .getByRole("radio", { name: "Relation sérieuse" })
    .click();
  await next(page);
}

async function acceptTerms(page) {
  await page.getByTestId("terms-dialog").waitFor();
  await page.locator("#certify").click();
  await page.getByTestId("terms-accept").click();
}

async function passwordLogin(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
}

/* ------------------------------------------------------------------ */
/* A. Écran d'accueil de l'inscription                                  */
/* ------------------------------------------------------------------ */
const page = await newPage();
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
check(
  "A1 : page /register (titre « Créer un compte »)",
  (await page.title()).includes("Créer un compte"),
);
check(
  "A2 : bouton principal « Créer mon compte »",
  await page.getByTestId("signup-start").isVisible(),
);
check(
  "A3 : « ou continuer avec » Google et E-mail",
  (await page.getByText("ou continuer avec").isVisible()) &&
    (await page.getByTestId("signup-google").isVisible()) &&
    (await page.getByTestId("signup-email").isVisible()),
);
check(
  "A4 : « Déjà membre ? Se connecter »",
  await page.getByRole("link", { name: "Se connecter" }).isVisible(),
);
check("A5 : bouton « Installer l'application »", await page.getByTestId("install-app").isVisible());
await page
  .getByTestId("recent-signup")
  .waitFor({ timeout: 5000 })
  .catch(() => {});
const bubble =
  (await page
    .getByTestId("recent-signup")
    .textContent()
    .catch(() => "")) ?? "";
check(
  "A6 : bulle « Rebecca (Gabon) vient de s'inscrire » (vrai membre, prénom seul)",
  bubble.includes("Rebecca (Gabon) vient de s'inscrire") && !bubble.includes("Nkoulou"),
  bubble,
);
check("A7 : bandeau cookies affiché", await page.getByTestId("cookie-banner").isVisible());
await page.getByTestId("cookie-banner").getByRole("button", { name: "OK" }).click();
await page.reload({ waitUntil: "networkidle" });
check(
  "A8 : bandeau cookies retenu après « OK »",
  (await page.getByTestId("cookie-banner").count()) === 0,
);
check(
  "A9 : 390 px sans défilement horizontal",
  await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);

/* ------------------------------------------------------------------ */
/* B. Parcours complet par e-mail (même appareil)                       */
/* ------------------------------------------------------------------ */
await page.getByTestId("signup-start").click();
check(
  "B1 : étape 1 sur 4 « Crée ton profil » avec barre de progression",
  (await page.getByText("Étape 1 sur 4").isVisible()) &&
    (await heading(page)) === "Crée ton profil" &&
    (await page.getByTestId("signup-progress").isVisible()),
);
check(
  "B2 : 3 emplacements photo (Galerie / Photo)",
  (await page.getByText("Galerie").count()) === 3,
);
check(
  "B3 : « continuer sans photo » expliqué",
  await page.getByText("continuer sans photo").isVisible(),
);
await next(page);
let t = await toast(page);
check(
  "B4 : Suivant sans prénom → message clair, on reste",
  t.includes("prénom") && (await heading(page)) === "Crée ton profil",
  t,
);
await page.getByTestId("photo-gallery").setInputFiles([photo(1), photo(2)]);
check(
  "B5 : 2 photos affichées en aperçu",
  (await page.getByTestId("signup-photos").locator("img").count()) === 2,
);
await page.fill("#firstName", "Élise");
const now = new Date();
await page.fill(
  "#birthDate",
  `${now.getFullYear() - 17}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
);
await page.getByTestId("choice-gender").getByRole("radio", { name: "Femme" }).click();
await next(page);
t = await toast(page);
check("B6 : moins de 18 ans refusé", t.includes("18 ans"), t);
await page.fill("#birthDate", "1996-04-12");
const genders = await page.getByTestId("choice-gender").getByRole("radio").allTextContents();
check("B7 : « Je suis » Homme / Femme", genders.join(",") === "Homme,Femme", genders.join(","));
const looking = await page.getByTestId("choice-looking-for").getByRole("radio").allTextContents();
check(
  "B8 : « Je cherche » Hommes / Femmes / Tous",
  looking.join(",") === "Hommes,Femmes,Tous",
  looking.join(","),
);
await page.getByTestId("choice-looking-for").getByRole("radio", { name: "Hommes" }).click();
check(
  "B9 : âge des profils par défaut 25 – 45 ans",
  (await page.getByTestId("age-range").textContent()) === "25 – 45 ans",
);
const thumbs = page.getByRole("slider");
await thumbs.nth(0).focus();
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowRight");
await thumbs.nth(1).focus();
await page.keyboard.press("End");
check(
  "B10 : curseur double 27 – 60+",
  (await page.getByTestId("age-range").textContent()) === "27 – 60+ ans",
  await page.getByTestId("age-range").textContent(),
);
await next(page);
check("B11 : étape 2 « Ta bio en 30 s »", (await heading(page)) === "Ta bio en 30 s");
for (const p of ["Louange", "Musique", "Lecture", "Cuisine"])
  await page.getByTestId("chips-passions").getByRole("checkbox", { name: p }).click();
check(
  "B12 : 4 passions au maximum (5e grisée)",
  await page.getByTestId("chips-passions").getByRole("checkbox", { name: "Voyages" }).isDisabled(),
);
await page
  .getByTestId("chips-weekend")
  .getByRole("checkbox", { name: "Culte puis repas en famille" })
  .click();
await page.getByTestId("chips-quality").getByRole("checkbox", { name: "La fidélité" }).click();
const bio = await page.inputValue("#bio");
check(
  "B13 : bio proposée à partir des puces",
  bio.includes("louange, musique, lecture et cuisine") &&
    bio.includes("culte puis repas") &&
    bio.includes("fidélité"),
  bio,
);
check(
  "B14 : « Passer cette étape » proposé",
  await page.getByText("Passer cette étape").isVisible(),
);
await page.getByRole("button", { name: "Retour" }).click();
check(
  "B15 : Retour → valeurs de l'étape 1 conservées",
  (await page.inputValue("#firstName")) === "Élise",
);
await next(page);
check("B16 : bio conservée", (await page.inputValue("#bio")) === bio);
await page.getByRole("button", { name: "Continuer" }).click();
check("B17 : étape 3 « Où es-tu ? »", (await heading(page)) === "Où es-tu ?");
const purposes = await page.getByTestId("choice-purpose").getByRole("radio").allTextContents();
check(
  "B18 : « Pourquoi tu es là ? » adapté à YONA",
  purposes.some((p) => p.includes("Me marier")) &&
    purposes.some((p) => p.includes("Amitié chrétienne")),
  purposes.join(" / "),
);
await page.fill("#country", "Cameroun");
await page.fill("#region", "Littoral");
await page.fill("#city", "Douala");
await next(page);
t = await toast(page);
check("B19 : sans « Pourquoi tu es là ? » → message clair", t.includes("pourquoi"), t);
await page.getByTestId("choice-purpose").getByRole("radio", { name: "Me marier" }).click();
await next(page);
check("B20 : étape 4 « Reste au courant »", (await heading(page)) === "Reste au courant");
await page.getByTestId("choice-marketing").getByRole("radio", { name: "Oui" }).click();
check(
  "B21 : bouton « M'inscrire »",
  (await page.getByTestId("signup-next").textContent()) === "M'inscrire",
);
await page.fill("#email", "pas-un-email");
await page.fill("#password", PWD);
await next(page);
t = await toast(page);
check("B22 : e-mail invalide refusé", t.includes("e-mail"), t);
const emailB = mail("b");
await page.fill("#email", emailB);
await page.fill("#password", "court");
await next(page);
t = await toast(page);
check("B23 : mot de passe de moins de 8 caractères refusé", t.includes("8 caractères"), t);
await page.fill("#password", PWD);
await next(page);
await page.getByTestId("terms-dialog").waitFor();
check(
  "B24 : fenêtre des conditions affichée",
  await page.getByText("Je certifie avoir 18 ans ou plus").isVisible(),
);
check(
  "B25 : « J'accepte » grisé tant que la case n'est pas cochée",
  await page.getByTestId("terms-accept").isDisabled(),
);
await page.getByRole("button", { name: "Annuler" }).click();
await page.getByTestId("terms-dialog").waitFor({ state: "hidden" });
check("B26 : Annuler → aucun compte créé", userId(emailB) === "");
await next(page);
await acceptTerms(page);
await page.getByText("Consultez votre boîte mail").waitFor({ timeout: 10000 });
check(
  "B27 : compte créé → « Consultez votre boîte mail »",
  await page.getByText(emailB).isVisible(),
);
const idB = userId(emailB);
check(
  "B28 : réponses gardées avec le compte (métadonnées, sans photo)",
  sql(`select raw_user_meta_data->'signup_draft'->>'city' from auth.users where id='${idB}'`) ===
    "Douala",
);
check(
  "B29 : profil pas encore visible avant confirmation",
  sql(`select status from public.profiles where user_id='${idB}'`) === "incomplete",
);
const linkB = await confirmLink(emailB);
await page.goto(linkB, { waitUntil: "networkidle" });
await page.waitForURL(/\/discover$/, { timeout: 20000 }).catch(() => {});
check(
  "B30 : lien de confirmation → profil créé automatiquement → /discover",
  page.url().endsWith("/discover"),
  page.url(),
);
check(
  "B31 : profil complet enregistré",
  profileOf(idB) === "Élise|female|1996-04-12|Douala|Littoral|Cameroun|active|visible|4|t",
  profileOf(idB),
);
check(
  "B32 : bio enregistrée",
  sql(`select bio from public.profiles where user_id='${idB}'`) === bio,
);
check(
  "B33 : préférences (Hommes, 27 à 99 ans, Mariage)",
  sql(
    `select concat_ws('|', preferred_gender, min_age, max_age, relationship_goal) from public.preferences where user_id='${idB}'`,
  ) === "male|27|99|Mariage",
);
check(
  "B34 : « Reste au courant : Oui » enregistré",
  sql(`select marketing_emails from public.user_settings where user_id='${idB}'`) === "t",
);
check(
  "B35 : 2 photos envoyées (en attente de vérification)",
  sql(`select count(*) from public.photos where user_id='${idB}'`) === "2",
);
check(
  "B36 : brouillon effacé du navigateur",
  (await page.evaluate(() => localStorage.getItem("yona.signup.draft"))) === null,
);

// Fenêtres d'accueil
await page
  .getByTestId("welcome-welcome")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check("B37 : fenêtre « Bienvenue Élise ! »", await page.getByText("Bienvenue Élise !").isVisible());
await page.getByRole("button", { name: "C'est parti" }).click();
await page.waitForTimeout(300);
check(
  "B38 : 2 photos déjà là → fenêtre photo sautée",
  (await page.getByTestId("welcome-photo").count()) === 0,
);
check(
  "B39 : fenêtre « Découvre qui est tout près »",
  await page.getByText("Découvre qui est tout près").isVisible(),
);
await page.getByRole("button", { name: "Plus tard" }).click();
await page.waitForTimeout(300);
check(
  "B40 : fenêtre « Complète ton profil en 20 secondes »",
  await page.getByText("Complète ton profil en 20 secondes").isVisible(),
);
await page.getByRole("radiogroup", { name: "Enfants" }).getByRole("radio", { name: "Non" }).click();
await page.fill("#origin", "Camerounaise");
await page.fill("#welcomeDenomination", "Évangélique");
await page
  .getByRole("radiogroup", { name: "Culte" })
  .getByRole("radio", { name: "Chaque semaine" })
  .click();
await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
await page.waitForTimeout(1200);
check(
  "B41 : enfants, origine, église, culte enregistrés",
  sql(
    `select concat_ws('|', p.has_children, p.origin, c.denomination, c.church_attendance) from public.profiles p join public.christian_profiles c using (user_id) where p.user_id='${idB}'`,
  ) === "f|Camerounaise|Évangélique|Chaque semaine",
);
check("B42 : plus de fenêtre ouverte", (await page.getByRole("dialog").count()) === 0);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
check("B43 : les fenêtres ne reviennent pas", (await page.getByRole("dialog").count()) === 0);

/* ------------------------------------------------------------------ */
/* C. Lien de confirmation ouvert sur un autre appareil                 */
/* ------------------------------------------------------------------ */
const pageC = await newPage();
await pageC.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await pageC.getByTestId("signup-email").click();
await fillSteps(pageC, { firstName: "Josué", gender: "Homme", looking: "Femmes", photos: 1 });
await pageC.getByTestId("choice-marketing").getByRole("radio", { name: "Non merci" }).click();
const emailC = mail("c");
await pageC.fill("#email", emailC);
await pageC.fill("#password", PWD);
await next(pageC);
await acceptTerms(pageC);
await pageC.getByText("Consultez votre boîte mail").waitFor({ timeout: 10000 });
const otherDevice = await newPage();
await otherDevice.goto(await confirmLink(emailC), { waitUntil: "networkidle" });
await otherDevice.waitForURL(/\/discover$/, { timeout: 20000 }).catch(() => {});
const idC = userId(emailC);
check(
  "C1 : autre appareil → profil créé depuis le compte → /discover",
  otherDevice.url().endsWith("/discover"),
  otherDevice.url(),
);
check(
  "C2 : infos du parcours bien reprises",
  profileOf(idC) === "Josué|male|1995-06-15|Yaoundé|Centre|Cameroun|active|visible|1|t",
  profileOf(idC),
);
check(
  "C3 : « Non merci » enregistré",
  sql(`select marketing_emails from public.user_settings where user_id='${idC}'`) === "f",
);
await otherDevice.getByRole("button", { name: "C'est parti" }).click();
await otherDevice.waitForTimeout(300);
check(
  "C4 : aucune photo → « Ajoute ta première photo »",
  await otherDevice.getByText("Ajoute ta première photo").isVisible(),
);
await otherDevice.getByTestId("welcome-photo-input").setInputFiles([photo(1)]);
await otherDevice
  .getByText("Découvre qui est tout près")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "C5 : photo ajoutée depuis la fenêtre",
  sql(`select count(*) from public.photos where user_id='${idC}'`) === "1",
);

/* ------------------------------------------------------------------ */
/* D. Parcours Google                                                   */
/* ------------------------------------------------------------------ */
const pageD = await newPage();
let authorizeUrl = "";
await pageD.route(/\/auth\/v1\/authorize/, (route) => {
  authorizeUrl = route.request().url();
  return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" });
});
await pageD.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await pageD.getByTestId("signup-google").click();
check(
  "D1 : Google → même parcours (étape 1 sur 4)",
  await pageD.getByText("Étape 1 sur 4").isVisible(),
);
await fillSteps(pageD, { firstName: "Grâce", photos: 1 });
check(
  "D2 : dernière étape sans e-mail ni mot de passe",
  (await pageD.locator("#email").count()) === 0,
);
check(
  "D3 : bouton « M'inscrire avec Google »",
  (await pageD.getByTestId("signup-next").textContent()) === "M'inscrire avec Google",
);
await next(pageD);
await acceptTerms(pageD);
for (let i = 0; i < 50 && !authorizeUrl; i++) await pageD.waitForTimeout(100);
const auth = authorizeUrl ? new URL(authorizeUrl) : null;
check(
  "D4 : départ vers Google (provider=google, retour sur /login)",
  auth?.searchParams.get("provider") === "google" &&
    auth?.searchParams.get("redirect_to") === `${BASE}/login`,
  authorizeUrl.slice(0, 140),
);
// Retour de Google simulé : compte créé par Google (nom complet, pas de first_name).
const emailD = mail("d");
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${emailD}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"google","providers":["google"]}','{"full_name":"Grace Mbeki","email_verified":true}',now(),now(),'','','','');`,
);
const idD = userId(emailD);
check(
  "D5 : compte Google → prénom tiré du nom complet (« Grace »)",
  sql(`select first_name from public.profiles where user_id='${idD}'`) === "Grace",
);
await pageD.unroute(/\/auth\/v1\/authorize/);
await passwordLogin(pageD, emailD);
await pageD.waitForURL(/\/discover$/, { timeout: 20000 }).catch(() => {});
check(
  "D6 : retour connecté → profil créé depuis le brouillon → /discover",
  pageD.url().endsWith("/discover"),
  pageD.url(),
);
check(
  "D7 : profil Google complet (prénom choisi dans le parcours)",
  profileOf(idD) === "Grâce|female|1995-06-15|Yaoundé|Centre|Cameroun|active|visible|1|t",
  profileOf(idD),
);
check(
  "D8 : photo du parcours envoyée",
  sql(`select count(*) from public.photos where user_id='${idD}'`) === "1",
);

/* ------------------------------------------------------------------ */
/* E. Connexion Google directe (sans parcours fait avant)               */
/* ------------------------------------------------------------------ */
const pageE = await newPage();
await pageE.goto(`${BASE}/login`, { waitUntil: "networkidle" });
check(
  "E1 : « Continuer avec Google » sur la page de connexion",
  await pageE.getByTestId("login-google").isVisible(),
);
const emailE = mail("e");
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${emailE}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"google","providers":["google"]}','{"name":"Samuel Ouédraogo","email_verified":true}',now(),now(),'','','','');`,
);
const idE = userId(emailE);
await passwordLogin(pageE, emailE);
await pageE.waitForURL(/\/onboarding$/, { timeout: 15000 }).catch(() => {});
await pageE
  .getByText("Étape 1 sur 4")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "E2 : nouveau compte Google → parcours sur /onboarding",
  pageE.url().endsWith("/onboarding") && (await pageE.getByText("Étape 1 sur 4").isVisible()),
);
check(
  "E3 : prénom Google pré-rempli",
  (await pageE.inputValue("#firstName")) === "Samuel",
  await pageE.inputValue("#firstName"),
);
await fillSteps(pageE, { firstName: "Samuel", gender: "Homme", looking: "Femmes" });
check(
  "E4 : dernière étape « Terminer », sans e-mail",
  (await pageE.getByTestId("signup-next").textContent()) === "Terminer" &&
    (await pageE.locator("#email").count()) === 0,
);
await next(pageE);
await acceptTerms(pageE);
await pageE.waitForURL(/\/discover$/, { timeout: 15000 }).catch(() => {});
check(
  "E5 : profil enregistré → /discover",
  pageE.url().endsWith("/discover") &&
    profileOf(idE) === "Samuel|male|1995-06-15|Yaoundé|Centre|Cameroun|active|visible|1|t",
  profileOf(idE),
);

/* ------------------------------------------------------------------ */
/* F. Foi et attentes : formulaire complet gardé                        */
/* ------------------------------------------------------------------ */
await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
check(
  "F1 : lien « Ma foi et mes attentes » sur le profil",
  await page.getByTestId("faith-link").isVisible(),
);
await page.getByTestId("faith-link").click();
await page.waitForURL(/\/onboarding$/);
await page
  .getByText("Étape 1 sur 3")
  .waitFor({ timeout: 8000 })
  .catch(() => {});
check(
  "F2 : profil terminé → formulaire complet (Vous / Votre foi / Vos attentes)",
  (await heading(page)) === "Vous",
);
await page.getByRole("button", { name: "Continuer" }).click();
check(
  "F3 : église déjà saisie reprise",
  (await page.inputValue("#denomination")) === "Évangélique",
);

/* ------------------------------------------------------------------ */
/* G. Serveur                                                           */
/* ------------------------------------------------------------------ */
const anon = await rest(null, "rpc/recent_signups", "POST", {});
check(
  "G1 : derniers inscrits : fonction fermée aux visiteurs (lue par le serveur seulement)",
  anon.status >= 400,
  `HTTP ${anon.status}`,
);
const rows = sql(
  `set role service_role; select string_agg(first_name || ':' || coalesce(country,'∅'), ',') from public.recent_signups();`,
);
check(
  "G2 : seuls les profils terminés et visibles apparaissent (prénom seul)",
  rows.includes("Rebecca:Gabon") && !rows.includes("Nkoulou") && !rows.includes("Grace:∅"),
  rows,
);
sql(`update public.profiles set terms_accepted_at = null where user_id='${idB}'`);
check(
  "G3 : date d'acceptation des conditions impossible à effacer",
  sql(`select terms_accepted_at is not null from public.profiles where user_id='${idB}'`) === "t",
);
check(
  "G4 : origine limitée à 60 caractères",
  sql(
    `select count(*) from pg_constraint where conname in ('profiles_origin_length','profiles_region_length')`,
  ) === "2",
);

/* ------------------------------------------------------------------ */
/* H. Pages et application installable                                 */
/* ------------------------------------------------------------------ */
const cgu = await newPage();
await cgu.goto(`${BASE}/cgu`, { waitUntil: "networkidle" });
check(
  "H1 : page des conditions /cgu",
  (await heading(cgu)) === "Conditions générales d'utilisation",
);
const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json().catch(() => null);
const icon = await fetch(`${BASE}/icon-512.png`);
check(
  "H2 : application installable (manifeste + icônes)",
  manifest?.display === "standalone" && icon.status === 200,
);
check(
  "H3 : 320 px sans défilement horizontal (parcours)",
  await (async () => {
    const p = await newPage(320);
    await p.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await p.getByTestId("signup-start").click();
    return p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  })(),
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email like 'test-${PREFIX}-%@example.test';`);
check("Comptes de test supprimés", cleanup());
finish();
