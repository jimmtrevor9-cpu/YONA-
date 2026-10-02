// YONA — Profils d'exemple (page des profils) et bouton « Installer l'application ».
// Vérifie : profils d'exemple affichés après les vrais membres, filtres respectés (genre,
// âge, pays en premier), même liste pour tout le monde, like / passer sans rien écrire en
// base, avatar neutre sans photo, un profil masqué par vrai inscrit (fonction fermée aux
// visiteurs), installation de l'application (proposition de Chrome, explication sinon).
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/inscription/profils-virtuels-installation.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const accounts = createAccounts("virt", {
  a: ["male", "Paul"],
  b: ["male", "Pierre"],
  c: ["female", "Claire"],
});
const { id, emails, PWD, cleanup } = accounts;
const prefs = (who, gender, min, max, country) =>
  sql(
    `update public.preferences set preferred_gender=${gender ? `'${gender}'` : "null"}, min_age=${min}, max_age=${max} where user_id='${id[who]}';
     update public.profiles set country='${country}' where user_id='${id[who]}';`,
  );
prefs("a", "female", 25, 35, "Cameroun");
prefs("b", "female", 25, 35, "Cameroun");
prefs("c", "male", 18, 99, "Seychelles");

const { browser, jsErrors, login } = await openBrowser();
async function closeDialogs(page) {
  for (let i = 0; i < 6 && (await page.getByRole("dialog").count()) > 0; i++) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}
async function virtualCards(page) {
  await page
    .getByTestId("virtual-profile")
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  return page.locator("article:has([data-testid=virtual-profile])").evaluateAll((els) =>
    els.map((el) => {
      const v = el.querySelector("[data-testid=virtual-profile]");
      return {
        id: v.dataset.virtualId,
        gender: v.dataset.virtualGender,
        age: Number(el.querySelector("h3")?.textContent?.match(/(\d+) ans/)?.[1] ?? 0),
        place: el.querySelector("header + p")?.textContent ?? "",
        label: v.textContent.includes("Profil d'exemple"),
        avatar: !!v.querySelector("[role=img]"),
      };
    }),
  );
}

/* A. Affichage et filtres */
const pageA = await login(emails.a, PWD);
const restCalls = [];
pageA.on("request", (r) => {
  if (r.url().includes("/rest/v1/") && decodeURIComponent(r.url()).includes("virtual-"))
    restCalls.push(r.url());
});
await closeDialogs(pageA);
const listA = await virtualCards(pageA);
check("V1 : profils d'exemple affichés (page jamais vide)", listA.length >= 5, `${listA.length}`);
check(
  "V2 : chaque profil d'exemple est signalé « Profil d'exemple »",
  listA.every((c) => c.label),
);
check(
  "V3 : genre recherché respecté (femmes seulement)",
  listA.every((c) => c.gender === "female"),
);
check(
  "V4 : tranche d'âge respectée (25 à 35 ans)",
  listA.every((c) => c.age >= 25 && c.age <= 35),
  listA.map((c) => c.age).join(","),
);
check(
  "V5 : pays du membre en premier (Cameroun)",
  listA[0]?.place.includes("Cameroun") ?? false,
  listA[0]?.place,
);
check(
  "V6 : sans photo déposée, avatar neutre de secours",
  listA.every((c) => c.avatar),
);

/* B. Même liste pour tous les visiteurs (mêmes filtres) */
const pageB = await login(emails.b, PWD);
await closeDialogs(pageB);
const listB = await virtualCards(pageB);
check(
  "V7 : même liste, même ordre pour un autre membre aux mêmes filtres",
  listB.map((c) => c.id).join() === listA.map((c) => c.id).join(),
);

/* C. Like / passer : rien n'est écrit en base */
const likesBefore = sql(`select count(*) from public.likes where sender_id='${id.a}'`);
const first = pageA.locator("article:has([data-testid=virtual-profile])").first();
await first.getByRole("button", { name: /^Liker le profil/ }).click();
const toast = await pageA
  .locator("[data-sonner-toast]")
  .last()
  .textContent()
  .catch(() => "");
check(
  "V8 : like sur un profil d'exemple → message clair, aucun like envoyé",
  (toast ?? "").includes("profil d'exemple") &&
    sql(`select count(*) from public.likes where sender_id='${id.a}'`) === likesBefore,
  toast ?? "",
);
const second = pageA.locator("article:has([data-testid=virtual-profile])").first();
await second.getByRole("button", { name: /^Passer le profil/ }).click();
await pageA.waitForTimeout(300);
const afterAct = await virtualCards(pageA);
check(
  "V9 : profils likés / passés retirés de la liste",
  !afterAct.some((c) => c.id === listA[0].id || c.id === listA[1].id),
);
check(
  "V10 : aucune donnée de profil d'exemple lue ni écrite en base",
  restCalls.length === 0 &&
    sql(`select count(*) from public.likes where sender_id='${id.a}'`) === likesBefore &&
    sql(`select count(*) from public.profiles where first_name like 'virtual-%'`) === "0",
  restCalls.slice(0, 2).join(" "),
);
await pageA.reload({ waitUntil: "networkidle" });
await closeDialogs(pageA);
const afterReload = await virtualCards(pageA);
check(
  "V11 : toujours retirés après rechargement (sur cet appareil)",
  !afterReload.some((c) => c.id === listA[0].id || c.id === listA[1].id),
);

/* D. Un profil d'exemple de moins par vrai inscrit */
const anon = await rest(null, "rpc/count_registered_members", "POST", {});
const member = await rest(await tokenOf(emails.a, PWD), "rpc/count_registered_members", "POST", {});
check(
  "V12 : nombre d'inscrits : fonction fermée aux visiteurs et aux membres (serveur seulement)",
  anon.status >= 400 && member.status >= 400,
  `visiteur ${anon.status}, membre ${member.status}`,
);
const counted = sql(`set role service_role; select public.count_registered_members();`);
check(
  "V13 : la fonction renvoie uniquement le nombre de profils créés",
  counted === sql(`select count(*) from public.profiles where onboarding_completed_at is not null`),
  counted,
);
const pageC = await login(emails.c, PWD);
await closeDialogs(pageC);
const localBefore = (await virtualCards(pageC)).filter((c) => c.place.includes("Seychelles"));
const more = createAccounts(
  "virtx",
  Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`n${i}`, ["female", `N${i}`]])),
);
await pageC.reload({ waitUntil: "networkidle" });
await closeDialogs(pageC);
const localAfter = (await virtualCards(pageC)).filter((c) => c.place.includes("Seychelles"));
check(
  "V14 : 40 nouveaux inscrits → des profils d'exemple disparaissent, aucun n'apparaît",
  localAfter.every((c) => localBefore.some((b) => b.id === c.id)) &&
    localAfter.length <= localBefore.length,
  `${localBefore.length} → ${localAfter.length}`,
);
check("Comptes supplémentaires supprimés", more.cleanup());

/* E. Application installable */
const install = await browser.newPage({ viewport: { width: 390, height: 800 } });
install.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await install.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await install.getByTestId("install-app").click();
check(
  "I1 : installation non proposée par le navigateur → courte explication, sans erreur",
  await install.getByTestId("install-help").isVisible(),
  await install
    .getByTestId("install-help")
    .textContent()
    .catch(() => ""),
);
await install.reload({ waitUntil: "networkidle" });
await install.evaluate(() => {
  const e = new Event("beforeinstallprompt", { cancelable: true });
  e.prompt = () => {
    window.__promptCalled = true;
    return Promise.resolve();
  };
  e.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(e);
});
await install.getByTestId("install-app").click();
await install.waitForTimeout(300);
check(
  "I2 : proposition de Chrome gardée → le clic ouvre directement l'installation",
  (await install.evaluate(() => window.__promptCalled === true)) &&
    (await install.getByTestId("install-app").count()) === 0,
);
const manifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
const icons = await Promise.all(
  manifest.icons.map(
    async (i) => `${i.sizes}:${i.purpose}:${(await fetch(`${BASE}${i.src}`)).status}`,
  ),
);
check(
  "I3 : manifeste valide (nom, start_url /, standalone, couleurs, icônes 192/512/maskable)",
  manifest.name.startsWith("YONA") &&
    manifest.short_name === "YONA" &&
    manifest.start_url === "/" &&
    manifest.display === "standalone" &&
    !!manifest.theme_color &&
    !!manifest.background_color &&
    icons.includes("192x192:any:200") &&
    icons.includes("512x512:any:200") &&
    icons.includes("512x512:maskable:200"),
  icons.join(" "),
);
const sw = await fetch(`${BASE}/sw.js`);
const registered = await install.evaluate(async () => {
  for (let i = 0; i < 30; i++) {
    if (await navigator.serviceWorker.getRegistration()) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
});
check(
  "I4 : service worker servi et enregistré",
  sw.status === 200 && registered,
  `HTTP ${sw.status}`,
);

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Comptes de test supprimés", cleanup());
finish();
