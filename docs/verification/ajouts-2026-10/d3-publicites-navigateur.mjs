// Tâche D3 — Vérifications dans le navigateur des publicités : création par l'admin (image,
// vidéo, aperçu, refus des mauvais fichiers et liens), affichage aux membres gratuits dans
// Découvrir (Sponsorisé, Passer, bouton, vidéo sans son + bouton son, preload=metadata),
// jamais pour un membre Premium ni pour l'admin, statistiques.
// Environnement LOCAL uniquement (images de test : /var/tmp/yona-e2e/make-ad-media.mjs).
// Usage : source /var/tmp/yona-e2e/env.sh && node docs/verification/ajouts-2026-10/d3-publicites-navigateur.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "/var/tmp/yona-e2e/shots";
const IMG = "/var/tmp/yona-e2e/img";
const BIG = process.env.BIG_VIDEO ?? "";
const sql = (q) => execFileSync("psql", ["-X", "-At", "-c", q], { encoding: "utf8" }).trim();
const checks = [];
const check = (name, ok, detail = "") =>
  checks.push([ok ? "OK" : "ÉCHEC", name, String(detail).slice(0, 200)]);

// Départ propre : pas de publicité, fréquence par défaut, Awa gratuite.
sql("delete from public.ads; update public.ad_settings set discover_every = 5, list_every = 6");
sql(
  "delete from public.subscriptions where user_id = (select id from public.users where email='awa@test.local')",
);
sql(
  "delete from public.likes where sender_id = (select id from public.users where email='awa@test.local')",
);

const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
async function session(email, width = 1440) {
  const ctx = await b.newContext({
    viewport: { width, height: width <= 400 ? 780 : 900 },
    locale: "fr-FR",
  });
  const pg = await ctx.newPage();
  pg.errs = [];
  // (La pile locale n'a pas de serveur « temps réel » : ces erreurs de connexion sont ignorées.)
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

// ---------- Administration ----------
const adm = await session("admin@test.local");
await adm.goto(BASE + "/admin", { waitUntil: "networkidle" });
await adm.getByTestId("admin-tab-ads").click();
await adm.getByTestId("admin-ads").waitFor();
// Fréquence : une publicité toutes les 2 cartes (pour l'essai)
const freq = adm.locator("form").filter({ hasText: "Découvrir : 1 publicité" });
await freq.locator("input").first().fill("2");
await freq.getByRole("button", { name: "Enregistrer" }).click();
await adm.waitForTimeout(800);
check(
  "Réglage : 1 publicité toutes les 2 cartes",
  sql("select discover_every from public.ad_settings") === "2",
);

// Publicité image
await adm.getByTestId("ad-new").click();
await adm.getByTestId("ad-editor").waitFor();
await adm.getByTestId("ad-media-input").setInputFiles(`${IMG}/pub-test.jpg`);
await adm.getByTestId("ad-title").fill("Boutique Béthel : -20 % ce mois-ci");
await adm
  .getByLabel("Texte (300 caractères max.)")
  .fill("Robes, costumes et accessoires pour vos grandes occasions à Libreville.");
await adm.getByLabel("Annonceur (facultatif)").fill("Boutique Béthel");
await adm.getByLabel("Texte du bouton").fill("En savoir plus");
await adm.getByTestId("ad-url").fill("http://exemple.test");
await adm.getByTestId("ad-status").selectOption("active");
await adm.getByTestId("ad-save").click();
await adm.waitForTimeout(500);
check(
  "Lien en http:// refusé avec un message clair",
  (await adm.getByRole("alert").innerText()).includes("https://"),
);
await adm.getByTestId("ad-url").fill("https://exemple.yona.test/bethel");
await adm.waitForTimeout(300);
check(
  "Aperçu avant publication affiché",
  (await adm.getByTestId("ad-preview").getByTestId("sponsored-card").count()) === 1,
);
await adm.getByTestId("ad-editor").screenshot({ path: `${OUT}/d3-editeur-1440.png` });
await adm.getByTestId("ad-save").click();
await adm.getByTestId("ad-list").waitFor({ timeout: 20000 });
await adm.waitForTimeout(500);
check(
  "Publicité image créée et publiée",
  sql("select count(*) from public.ads where media_type='image' and status='active'") === "1",
);

// Publicité vidéo (aperçu de la vidéo créé automatiquement)
await adm.getByTestId("ad-new").click();
if (BIG) {
  await adm.getByTestId("ad-media-input").setInputFiles(BIG);
  await adm.waitForTimeout(400);
  check(
    "Vidéo de plus de 15 Mo refusée",
    (await adm.locator("[data-sonner-toast]").filter({ hasText: "trop lourd" }).count()) === 1,
  );
}
await adm.getByTestId("ad-media-input").setInputFiles(`${IMG}/pub-test.webm`);
await adm.getByTestId("ad-title").fill("Conférence couples chrétiens");
await adm.getByLabel("Texte du bouton").fill("Contacter");
await adm.getByTestId("ad-url").fill("https://wa.me/24100000000");
await adm.getByLabel("Icône du bouton").selectOption("message");
await adm.getByLabel("Liste des messages").check();
await adm.getByTestId("ad-status").selectOption("active");
await adm.getByTestId("ad-save").click();
await adm.getByTestId("ad-list").waitFor({ timeout: 30000 });
await adm.waitForTimeout(500);
check(
  "Publicité vidéo créée, image d'aperçu fabriquée automatiquement",
  sql("select count(*) from public.ads where media_type='video' and poster_path is not null") ===
    "1",
);
await adm.screenshot({ path: `${OUT}/d3-admin-1440.png`, fullPage: true });

// L'administrateur ne voit pas de publicité dans Découvrir
await adm.goto(BASE + "/discover", { waitUntil: "networkidle" });
for (let i = 0; i < 4 && (await adm.getByTestId("discover-pass").count()); i++) {
  await adm.getByTestId("discover-pass").last().click();
  await adm.waitForTimeout(350);
}
check(
  "Administrateur : aucune publicité dans Découvrir",
  (await adm.getByTestId("sponsored-card").count()) === 0,
);

// ---------- Membre gratuit ----------
async function passUntilAd(pg, max = 6) {
  for (let i = 0; i < max; i++) {
    if (await pg.getByTestId("sponsored-card").count()) return true;
    if (!(await pg.getByTestId("discover-pass").count())) return false;
    await pg.getByTestId("discover-pass").last().click();
    await pg.waitForTimeout(400);
  }
  return (await pg.getByTestId("sponsored-card").count()) > 0;
}
for (const width of [320, 768, 1440]) {
  const awa = await session("awa@test.local", width);
  await awa.goto(BASE + "/discover", { waitUntil: "networkidle" });
  await awa.getByTestId("discover-card").first().waitFor({ timeout: 15000 });
  const shown = await passUntilAd(awa);
  check(`Membre gratuit (${width} px) : publicité après 2 cartes`, shown);
  if (!shown) continue;
  const card = awa.getByTestId("sponsored-card");
  await awa.waitForTimeout(1600); // vue comptée après 1 s visible
  const txt = await card.innerText();
  check(
    `${width} px : étiquette « Sponsorisé », Passer et bouton d'action`,
    txt.includes("Sponsorisé") &&
      txt.includes("Passer") &&
      (await card.getByTestId("ad-cta").count()) === 1,
    txt.replace(/\n/g, " | "),
  );
  check(
    `${width} px : pas de débordement`,
    !(await awa.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
  );
  await awa.screenshot({ path: `${OUT}/d3-decouvrir-${width}.png` });
  // Passer → retour aux profils
  await card.getByTestId("ad-skip").click();
  await awa.waitForTimeout(400);
  check(
    `${width} px : « Passer » ferme la publicité`,
    (await awa.getByTestId("sponsored-card").count()) === 0 &&
      (await awa.getByTestId("discover-card").count()) > 0,
  );
  if (width === 1440) {
    // Deuxième publicité : la vidéo
    // Publicité vidéo : la suivante (l'ordre entre publicités de même priorité varie).
    const video = awa.getByTestId("sponsored-card").getByTestId("ad-video");
    let again = false;
    for (let k = 0; k < 3 && !again; k++) {
      if (!(await passUntilAd(awa))) break;
      if (await video.count()) again = true;
      else {
        await awa.getByTestId("ad-skip").click();
        await awa.waitForTimeout(300);
      }
    }
    if (again) {
      const v = await video.evaluate((el) => ({
        muted: el.muted,
        preload: el.preload,
        autoplay: !el.paused || el.readyState >= 0,
      }));
      check(
        "Vidéo : sans son et preload=metadata",
        v.muted === true && v.preload === "metadata",
        JSON.stringify(v),
      );
      await awa.waitForTimeout(1200);
      check(
        "Vidéo : lecture automatique quand elle est visible",
        await video.evaluate((el) => !el.paused),
      );
      await awa.getByTestId("ad-sound").click();
      check(
        "Bouton son : active le son",
        (await video.evaluate((el) => el.muted)) === false &&
          (await awa.getByTestId("ad-sound").getAttribute("aria-label")) === "Couper le son",
      );
      await awa.screenshot({ path: `${OUT}/d3-decouvrir-video-1440.png` });
      // Clic sur le bouton d'action : ouvre le lien dans un nouvel onglet
      const cta = awa.getByTestId("sponsored-card").getByTestId("ad-cta");
      const link = {
        href: await cta.getAttribute("href"),
        target: await cta.getAttribute("target"),
        rel: await cta.getAttribute("rel"),
      };
      const [popup] = await Promise.all([
        awa
          .context()
          .waitForEvent("page", { timeout: 5000 })
          .catch(() => null),
        cta.click(),
      ]);
      // (wa.me est injoignable depuis l'environnement de test : on vérifie l'adresse du lien et l'ouverture d'un onglet.)
      check(
        "Bouton d'action : lien https de l'annonceur, nouvel onglet, sans transmission de la page d'origine",
        !!popup &&
          link.href === "https://wa.me/24100000000" &&
          link.target === "_blank" &&
          /noopener/.test(link.rel) &&
          /noreferrer/.test(link.rel),
        JSON.stringify(link),
      );
      await popup?.close();
      await awa.waitForTimeout(300);
      check(
        "Après le clic, la publicité laisse place aux profils",
        (await awa.getByTestId("sponsored-card").count()) === 0,
      );
    } else check("Deuxième publicité (vidéo) affichée", false);
  }
  check(`${width} px : aucune erreur JavaScript`, awa.errs.length === 0, awa.errs.join(" | "));
  await awa.context().close();
}
await new Promise((r) => setTimeout(r, 800));
check(
  "Vues, « Passer » et clic comptés par YONA",
  Number(sql("select count(*) from public.ad_events where event='view'")) >= 1 &&
    Number(sql("select count(*) from public.ad_events where event='skip'")) >= 1 &&
    Number(sql("select count(*) from public.ad_events where event='click'")) >= 1,
  sql(
    "select string_agg(event || '=' || n, ', ') from (select event, count(*) n from public.ad_events group by 1) x",
  ),
);
check(
  "Pays du membre enregistré avec la vue",
  sql("select string_agg(distinct coalesce(country, '?'), ',') from public.ad_events") === "Gabon",
);

// ---------- Listes : publicité dans « Messages » (emplacement choisi), pas dans « Matchs » ----------
sql(`select set_config('request.jwt.claim.sub', '', false)`);
sql(
  `delete from public.likes l using public.users a, public.users j where a.email='awa@test.local' and j.email='jean@test.local' and ((l.sender_id=a.id and l.receiver_id=j.id) or (l.sender_id=j.id and l.receiver_id=a.id))`,
);
sql(
  `insert into public.likes (sender_id, receiver_id, kind) select a.id, j.id, 'like' from public.users a, public.users j where a.email='awa@test.local' and j.email='jean@test.local'`,
);
sql(
  `insert into public.likes (sender_id, receiver_id, kind) select j.id, a.id, 'like' from public.users a, public.users j where a.email='awa@test.local' and j.email='jean@test.local'`,
);
const lists = await session("awa@test.local", 390);
await lists.goto(BASE + "/messages", { waitUntil: "networkidle" });
await lists.waitForTimeout(1500);
const banner = lists.getByTestId("sponsored-banner");
check(
  "Liste des messages : une publicité (emplacement « messages »)",
  (await banner.count()) === 1 && (await banner.innerText()).includes("Sponsorisé"),
);
await lists.screenshot({ path: `${OUT}/d3-messages-390.png` });
if (await banner.count()) {
  await banner.getByTestId("ad-hide").click();
  await lists.waitForTimeout(300);
  check(
    "Liste des messages : « Masquer » retire la publicité",
    (await lists.getByTestId("sponsored-banner").count()) === 0,
  );
}
await lists.goto(BASE + "/matches", { waitUntil: "networkidle" });
await lists.waitForTimeout(1200);
check(
  "Liste des Matchs : aucune publicité (emplacement non choisi)",
  (await lists.getByTestId("sponsored-banner").count()) === 0,
);
check("Listes : aucune erreur JavaScript", lists.errs.length === 0, lists.errs.join(" | "));
await lists.context().close();

// ---------- Awa passe Premium : plus aucune publicité ----------
sql(
  `insert into public.subscriptions (user_id, plan, amount, currency, status, starts_at, expires_at) select id, 'premium_monthly', 500, 'USD', 'active', now() - interval '1 minute', now() + interval '30 days' from public.users where email='awa@test.local'`,
);
const prem = await session("awa@test.local", 390);
await prem.goto(BASE + "/discover", { waitUntil: "networkidle" });
await prem.getByTestId("discover-card").first().waitFor({ timeout: 15000 });
const premAd = await passUntilAd(prem, 5);
check("Membre Premium : aucune publicité, même après plusieurs cartes", !premAd);
await prem.goto(BASE + "/messages", { waitUntil: "networkidle" });
check(
  "Membre Premium : aucune publicité dans les messages",
  (await prem.getByTestId("sponsored-banner").count()) === 0,
);
await prem.context().close();
sql(
  "delete from public.subscriptions where user_id = (select id from public.users where email='awa@test.local')",
);

// ---------- Statistiques ----------
await adm.goto(BASE + "/admin", { waitUntil: "networkidle" });
await adm.getByTestId("admin-tab-ads").click();
await adm.getByTestId("ad-stats").waitFor();
await adm.waitForTimeout(1200);
check(
  "Statistiques : vues affichées",
  Number((await adm.getByTestId("ad-kpi-Vues").innerText()).replace(/\D/g, "")) >= 1,
);
await adm.screenshot({ path: `${OUT}/d3-admin-stats-1440.png`, fullPage: true });
const admSmall = await session("admin@test.local", 320);
await admSmall.goto(BASE + "/admin", { waitUntil: "networkidle" });
await admSmall.getByTestId("admin-tab-ads").click();
await admSmall.getByTestId("ad-list").waitFor();
await admSmall.waitForTimeout(800);
check(
  "Administration des publicités à 320 px sans débordement",
  !(await admSmall.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
await admSmall.screenshot({ path: `${OUT}/d3-admin-320.png`, fullPage: true });
// Pause : la publicité n'est plus proposée
await adm.getByTestId("ad-pause").first().click();
await adm.waitForTimeout(800);
check("Mise en pause", sql("select count(*) from public.ads where status='paused'") === "1");
check(
  "Administration : aucune erreur JavaScript",
  adm.errs.length === 0 && admSmall.errs.length === 0,
  [...adm.errs, ...admSmall.errs].join(" | "),
);

for (const c of checks) console.log(c.join(" | "));
console.log(
  `${checks.filter((c) => c[0] === "OK").length} / ${checks.length} vérifications réussies`,
);
await b.close();
