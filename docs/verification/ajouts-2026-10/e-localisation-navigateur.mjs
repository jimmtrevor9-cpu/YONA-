// Tâche E — Vérifications dans le navigateur de la localisation des membres :
// visite par un « VPN » (adresse IP en France, fuseau de Paris), ville déclarée retenue,
// position GPS de l'appareil (géocodage inverse par le serveur), drapeau d'incohérence
// visible par l'administration. Environnement LOCAL uniquement (en-têtes Vercel simulés).
// Usage : source /var/tmp/yona-e2e/env.sh && node docs/verification/ajouts-2026-10/e-localisation-navigateur.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "/var/tmp/yona-e2e/shots";
const sql = (q) => execFileSync("psql", ["-X", "-At", "-c", q], { encoding: "utf8" }).trim();
const checks = [];
const check = (name, ok, detail = "") =>
  checks.push([ok ? "OK" : "ÉCHEC", name, String(detail).slice(0, 220)]);
const AWA = sql("select id from public.users where email='awa@test.local'");
const loc = () =>
  sql(
    `select source || '|' || coalesce(city,'?') || '|' || coalesce(country,'?') || '|' || inconsistent || '|' || array_to_string(inconsistency, ',') from public.profile_locations where user_id='${AWA}'`,
  );

// Départ : aucune position pour Awa (profil : Libreville, Gabon).
sql(
  `delete from public.profile_locations where user_id='${AWA}'; delete from public.location_history where user_id='${AWA}'`,
);
sql(
  `update public.profiles set country='Gabon', region='Estuaire', city='Libreville' where user_id='${AWA}'`,
);

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const VPN = {
  "x-vercel-ip-country": "FR",
  "x-vercel-ip-city": "Paris",
  "x-vercel-ip-latitude": "48.8566",
  "x-vercel-ip-longitude": "2.3522",
};
async function session(email, opts = {}) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    locale: "fr-FR",
    ...opts,
  });
  const pg = await ctx.newPage();
  pg.errs = [];
  pg.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !m.text().includes("ERR_CERT") &&
      !m.text().includes("realtime/v1/websocket") &&
      pg.errs.push(m.text().slice(0, 200)),
  );
  pg.on("pageerror", (e) => pg.errs.push("pageerror: " + String(e).slice(0, 200)));
  await pg.goto(BASE + "/login", { waitUntil: "networkidle" });
  await pg.fill("#email", email);
  await pg.fill("#password", "Motdepasse-Test-2026");
  await pg.keyboard.press("Enter");
  await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  await pg.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes("welcome")) localStorage.setItem(k, "1");
    }
  });
  return pg;
}
const waitFor = async (fn, ms = 8000) => {
  for (let t = 0; t < ms; t += 250) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return fn();
};

// 1. Connexion par un VPN en France (IP française, navigateur réglé sur Paris)
const awa = await session("awa@test.local", { extraHTTPHeaders: VPN, timezoneId: "Europe/Paris" });
await waitFor(() => loc() !== "");
check(
  "VPN (IP en France) : la ville déclarée (Libreville, Gabon) est retenue, pas Paris",
  loc().startsWith("declared|Libreville|Gabon|true|"),
  loc(),
);
check(
  "Indices relevés : IP en France et fuseau de Paris",
  loc().endsWith("ip_country:FR,timezone:Europe/Paris"),
  loc(),
);

// 2. Position de l'appareil (GPS à Libreville), toujours derrière le VPN
await awa.context().grantPermissions(["geolocation"], { origin: BASE });
await awa.context().setGeolocation({ latitude: 0.4162, longitude: 9.4673, accuracy: 30 });
await awa.goto(BASE + "/profile", { waitUntil: "networkidle" });
const panel = awa.getByTestId("my-location");
await panel.scrollIntoViewIfNeeded();
await panel.getByRole("button", { name: /Utiliser ma position|Mettre à jour ma position/ }).click();
await waitFor(() => loc().startsWith("device|"));
check(
  "GPS de l'appareil : Libreville, Gabon (géocodage inverse du serveur)",
  loc().startsWith("device|Libreville|Gabon|"),
  loc(),
);
check(
  "Pays retenu Gabon (retrait des profils de démo, publicités)",
  sql(`select public.member_country('${AWA}')`) === "Gabon",
);
await awa.waitForTimeout(800);
check(
  "Le membre voit l'origine de sa position",
  (await awa.getByTestId("my-location-status").innerText()).includes(
    "Libreville, Gabon — position de votre appareil",
  ),
  await awa.getByTestId("my-location-status").innerText(),
);
await panel.screenshot({ path: `${OUT}/e-position-membre-390.png` });

// 3. Autres villes : Douala (Cameroun), Paris (France)
for (const [lat, lng, city, country] of [
  [4.0511, 9.7679, "Douala", "Cameroun"],
  [48.8566, 2.3522, "Paris", "France"],
  [-4.2634, 15.2429, "Brazzaville", "Congo-Brazzaville"],
]) {
  await awa.context().setGeolocation({ latitude: lat, longitude: lng, accuracy: 50 });
  await panel.getByRole("button", { name: /Mettre à jour ma position/ }).click();
  await waitFor(() => loc().includes(`|${city}|`));
  check(
    `Géocodage inverse : ${lat}, ${lng} → ${city}, ${country}`,
    loc().startsWith(`device|${city}|${country}|`),
    loc(),
  );
}
await awa.context().setGeolocation({ latitude: 0.4162, longitude: 9.4673, accuracy: 30 });
await panel.getByRole("button", { name: /Mettre à jour ma position/ }).click();
await waitFor(() => loc().includes("|Libreville|"));
check("Aucune erreur JavaScript (membre)", awa.errs.length === 0, awa.errs.join(" | "));
await awa.context().close();

// 4. Administration : fiche du membre et journal « Localisation »
const adm = await session("admin@test.local", { viewport: { width: 1440, height: 900 } });
await adm.goto(BASE + "/admin", { waitUntil: "networkidle" });
await adm.getByTestId("admin-tab-users").click();
await adm.getByTestId("admin-user-search").fill("awa");
await adm.waitForTimeout(900);
await adm.getByTestId("admin-user-row").first().click();
await adm.getByTestId("admin-user-location").waitFor();
const card = await adm.getByTestId("admin-user-location").innerText();
check(
  "Fiche du membre : position retenue « Appareil (GPS) » et indices",
  card.includes("Libreville") && card.includes("Appareil (GPS)") && card.includes("Europe/Paris"),
  card.replace(/\n/g, " | "),
);
check(
  "Fiche du membre : incohérence signalée (VPN possible)",
  (await adm.getByTestId("admin-location-flag").count()) === 1 &&
    card.includes("Adresse IP en France"),
);
await adm.getByTestId("admin-user-location").screenshot({ path: `${OUT}/e-admin-fiche-1440.png` });
await adm.getByTestId("admin-tab-logs").click();
await adm.getByTestId("admin-log-location_history").click();
await adm.getByTestId("admin-log-kind").selectOption("true");
await adm.waitForTimeout(1000);
const rows = await adm.getByTestId("admin-log-row").allInnerTexts();
check(
  "Journal « Localisation » : incohérences filtrées",
  rows.length > 0 && rows.every((r) => /Adresse IP en|Fuseau horaire|Pays affiché/.test(r)),
  String(rows.length),
);
await adm.screenshot({ path: `${OUT}/e-admin-journal-1440.png`, fullPage: true });
check("Aucune erreur JavaScript (administration)", adm.errs.length === 0, adm.errs.join(" | "));

for (const c of checks) console.log(c.join(" | "));
console.log(
  `${checks.filter((c) => c[0] === "OK").length} / ${checks.length} vérifications réussies`,
);
await b.close();
