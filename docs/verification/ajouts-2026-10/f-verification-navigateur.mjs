// Tâche F — Vérifications dans le navigateur de la vérification d'identité automatique,
// avec le VRAI moteur (face-api, serveur) et une caméra simulée : la page reçoit, à la place
// de la caméra, un flux vidéo dessiné à partir de portraits générés par IA (profils de
// démonstration, aucune personne réelle). Le « tourner la tête » est simulé par une
// déformation de l'image : la rotation minimale est donc abaissée pendant l'essai.
// Environnement LOCAL uniquement (version Vercel servie en local).
// Usage : source /var/tmp/yona-e2e/env.sh && node docs/verification/ajouts-2026-10/f-verification-navigateur.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const { createClient } = require("@supabase/supabase-js");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "/var/tmp/yona-e2e/shots";
const F = "/var/tmp/yona-e2e/faces/";
const sql = (q) => execFileSync("psql", ["-X", "-At", "-c", q], { encoding: "utf8" }).trim();
const checks = [];
const check = (name, ok, detail = "") =>
  checks.push([ok ? "OK" : "ÉCHEC", name, String(detail).slice(0, 240)]);
const svc = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const id = (email) => sql(`select id from public.users where email='${email}'`);
const AWA = id("awa@test.local");
const JEAN = id("jean@test.local");

// Départ : Awa et Jean non vérifiés, sans tentative ; photo de profil sans visage pour Awa.
for (const u of [AWA, JEAN]) {
  sql(
    `select set_config('request.jwt.claim.sub','',false); update public.profiles set verified_at = null where user_id='${u}'`,
  );
  sql(`delete from public.profile_verifications where user_id='${u}'`);
}
sql(
  "update public.verification_settings set liveness_min_shift = 0.03, accept_similarity = 0.55, reject_similarity = 0.40, max_attempts_per_day = 5, file_retention_hours = 0",
);
// Jean : une photo de profil avec visage (portrait IA), validée.
async function setProfilePhoto(userId, file) {
  const { data: old } = await svc.from("photos").select("id, storage_path").eq("user_id", userId);
  for (const p of old ?? []) {
    await svc.from("photos").delete().eq("id", p.id);
    await svc.storage.from("photos").remove([p.storage_path]);
  }
  const path = `${userId}/${Date.now()}.jpg`;
  await svc.storage.from("photos").upload(path, readFileSync(file), { contentType: "image/jpeg" });
  await svc
    .from("photos")
    .insert({ user_id: userId, storage_path: path, is_primary: true, status: "approved" });
}
await setProfilePhoto(JEAN, F + "demo-fr-01-b.jpg");
await setProfilePhoto(AWA, "/var/tmp/yona-e2e/img/test1.jpg");

const dataUrl = (f) => `data:image/jpeg;base64,${readFileSync(F + f).toString("base64")}`;
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

// Caméra simulée : window.__frame choisit l'image dessinée dans le flux vidéo.
function fakeCamera(images) {
  return ({ images }) => {
    const imgs = {};
    for (const [k, v] of Object.entries(images)) {
      const im = new Image();
      im.src = v;
      imgs[k] = im;
    }
    window.__frame = "front";
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    setInterval(() => {
      const im = imgs[window.__frame];
      if (im?.complete) ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    }, 50);
    const stream = canvas.captureStream(20);
    navigator.mediaDevices.getUserMedia = async () => stream;
  };
}

async function session(email, faceBase, width = 390) {
  const ctx = await b.newContext({
    viewport: { width, height: width <= 400 ? 844 : 900 },
    locale: "fr-FR",
  });
  await ctx.addInitScript(fakeCamera(), {
    images: {
      front: dataUrl(`${faceBase}.jpg`),
      turn_left: dataUrl(`${faceBase}-turn-left.jpg`),
      turn_right: dataUrl(`${faceBase}-turn-right.jpg`),
    },
  });
  if (process.env.DEBUG_NET)
    await ctx.addInitScript(() =>
      document.addEventListener(
        "click",
        (e) =>
          console.log(
            "CLIC",
            e.isTrusted,
            e.target?.closest?.("[data-testid]")?.dataset.testid ?? e.target?.tagName,
          ),
        true,
      ),
    );
  const pg = await ctx.newPage();
  if (process.env.DEBUG_NET)
    pg.on(
      "console",
      (m) =>
        m.text().startsWith("CLIC") &&
        console.log(new Date().toISOString().slice(11, 23), m.text()),
    );
  pg.errs = [];
  pg.on(
    "console",
    (m) =>
      m.type() === "error" &&
      !/ERR_CERT|realtime\/v1\/websocket/.test(m.text()) &&
      pg.errs.push(m.text().slice(0, 200)),
  );
  pg.on("pageerror", (e) => pg.errs.push("pageerror: " + String(e).slice(0, 200)));
  if (process.env.DEBUG_NET)
    pg.on(
      "request",
      (r) =>
        r.url().includes("_serverFn") &&
        console.log(
          new Date().toISOString().slice(11, 23),
          r.method(),
          r.url().slice(-20),
          pg.url().replace(BASE, ""),
          (r.postData() ?? "").slice(0, 160),
        ),
    );
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

async function selfieAttempt(pg, { wrongSide = false } = {}) {
  await pg.getByTestId("verify-selfie").click();
  await pg.getByTestId("verify-consent").check();
  await pg.getByTestId("verify-start").click();
  await pg.getByTestId("live-selfie-dialog").waitFor({ timeout: 15000 });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => (window.__frame = "front"));
  await pg.getByTestId("live-selfie-take").click();
  const text = await pg.getByTestId("live-selfie-challenge").innerText();
  const left = /gauche/.test(text);
  const side = left !== wrongSide ? "turn_left" : "turn_right";
  await pg.evaluate((s) => (window.__frame = s), side);
  // Analyse par le serveur après le compte à rebours (3 s) : on attend la décision en base,
  // puis l'affichage du nouveau résultat (l'ancien est masqué pendant l'analyse).
  const user = await pg.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes("auth-token"))
        return JSON.parse(localStorage.getItem(k) ?? "{}")?.user?.id ?? null;
    }
    return null;
  });
  for (let i = 0; i < 180; i++) {
    const st = sql(
      `select status from public.profile_verifications where user_id='${user}' order by created_at desc limit 1`,
    );
    if (st && st !== "processing") break;
    await pg.waitForTimeout(500);
  }
  await pg.waitForFunction(
    () =>
      !document.querySelector('[data-testid="verification-checking"]') &&
      (document.querySelector(
        '[data-testid="verification-approved"],[data-testid="verification-rejected"],[data-testid="verification-pending"]',
      ) ||
        location.pathname.startsWith("/discover")),
    null,
    { timeout: 30000 },
  );
  return { challenge: left ? "turn_left" : "turn_right" };
}

// 1. Awa : découverte bloquée tant que l'identité n'est pas vérifiée
const awa = await session("awa@test.local", "demo-ga-01");
await awa.goto(BASE + "/discover", { waitUntil: "networkidle" });
await awa.waitForTimeout(800);
check(
  "Non vérifiée : Découvrir demande la vérification",
  (await awa.getByTestId("discover-needs-verification").count()) === 1,
);
await awa.screenshot({ path: `${OUT}/f-decouvrir-bloque-390.png` });

// 2. Page de vérification : texte, consentement, essais
await awa.goto(BASE + "/verification", { waitUntil: "networkidle" });
await awa.getByTestId("verification-page").waitFor();
const intro = await awa.getByTestId("verification-explanation").innerText();
check(
  "Texte d'explication demandé",
  intro.includes("Cette étape protège la communauté contre les faux profils") &&
    intro.includes("ne sont jamais visibles par les autres membres"),
);
check("Bouton désactivé sans consentement", await awa.getByTestId("verify-start").isDisabled());
await awa.screenshot({ path: `${OUT}/f-verification-390.png`, fullPage: true });

// 3. Photo de profil sans visage : refus clair
await selfieAttempt(awa);
const rejected = awa.getByTestId("verification-rejected");
check(
  "Photo de profil sans visage : refus avec message clair",
  (await rejected.count()) === 1 && (await rejected.innerText()).includes("photos de profil"),
  await rejected.innerText().catch(() => ""),
);
check(
  "Base : refus automatique « no_profile_face »",
  sql(
    `select status||'|'||reason||'|'||automatic||'|'||engine from public.profile_verifications where user_id='${AWA}' order by created_at desc limit 1`,
  ) === "rejected|no_profile_face|true|local",
);
await awa.screenshot({ path: `${OUT}/f-refus-390.png`, fullPage: true });

// 4. Mauvais côté : refus « wrong_direction »
await setProfilePhoto(AWA, F + "demo-ga-01-b.jpg");
await awa.reload({ waitUntil: "networkidle" });
await selfieAttempt(awa, { wrongSide: true });
check(
  "Tête tournée du mauvais côté : refus",
  sql(
    `select reason from public.profile_verifications where user_id='${AWA}' order by created_at desc limit 1`,
  ) === "wrong_direction",
  sql(
    `select reason from public.profile_verifications where user_id='${AWA}' order by created_at desc limit 1`,
  ),
);

// 5. Bonne consigne, même personne que la photo de profil : vérifiée automatiquement
await awa.reload({ waitUntil: "networkidle" });
const t0 = Date.now();
await selfieAttempt(awa);
const took = Date.now() - t0;
await awa.waitForTimeout(2500);
const row = sql(
  `select status||'|'||reason||'|'||round(profile_similarity,2)||'|'||round(liveness_similarity,2)||'|'||(files_deleted_at is not null) from public.profile_verifications where user_id='${AWA}' order by created_at desc limit 1`,
);
check(
  "Selfie conforme : vérifiée automatiquement (moteur local)",
  row.startsWith("approved|match|"),
  row,
);
check(
  "Profil vérifié (badge) et redirection vers Découvrir",
  sql(`select verified_at is not null from public.profiles where user_id='${AWA}'`) === "t" &&
    awa.url().includes("/discover"),
  awa.url(),
);
const { data: left } = await svc.storage.from("verifications").list(AWA, { limit: 100 });
let files = 0;
for (const f of left ?? []) {
  const { data: inner } = await svc.storage
    .from("verifications")
    .list(`${AWA}/${f.name}`, { limit: 100 });
  files += (inner ?? []).length;
}
check("Images de vérification supprimées après les décisions", files === 0, String(files));
check("Durée totale (consigne de 3 s comprise)", took < 60000, `${took} ms`);
check("Aucune erreur JavaScript (Awa)", awa.errs.length === 0, awa.errs.join(" | "));
await awa.context().close();

// 6. Jean : cas incertain (zone grise) → « en attente », examiné par l'administration
sql("update public.verification_settings set accept_similarity = 0.95");
const jean = await session("jean@test.local", "demo-fr-01");
await jean.goto(BASE + "/verification", { waitUntil: "networkidle" });
await selfieAttempt(jean);
check(
  "Zone grise : « contrôle complémentaire » affiché",
  (await jean.getByTestId("verification-pending").count()) === 1,
);
check(
  "Base : en attente, scores gardés, images conservées pour l'examen",
  sql(
    `select status||'|'||reason||'|'||(profile_similarity is not null)||'|'||(files_deleted_at is null) from public.profile_verifications where user_id='${JEAN}' order by created_at desc limit 1`,
  ) === "pending|gray_zone|true|true",
);
await jean.screenshot({ path: `${OUT}/f-attente-390.png`, fullPage: true });
await jean.context().close();
sql("update public.verification_settings set accept_similarity = 0.55");

const adm = await session("admin@test.local", "demo-ga-01", 1440);
await adm.goto(BASE + "/admin", { waitUntil: "networkidle" });
await adm.getByTestId("admin-tab-verifications").click();
await adm.getByTestId("admin-verification").first().waitFor({ timeout: 15000 });
await adm.waitForTimeout(800);
const card = await adm.getByTestId("admin-verification").first().innerText();
check(
  "Admin : cas incertain avec scores et images privées",
  card.includes("Zone grise") &&
    (await adm.getByTestId("admin-verification").first().locator("img").count()) >= 2,
  card.replace(/\n/g, " | "),
);
await adm.screenshot({ path: `${OUT}/f-admin-1440.png`, fullPage: true });
await adm.getByTestId("admin-verification-approve").first().click();
await adm.waitForTimeout(2000);
check(
  "Admin : validation → Jean vérifié",
  sql(`select verified_at is not null from public.profiles where user_id='${JEAN}'`) === "t",
);
check(
  "Admin : images supprimées après la décision",
  sql(
    `select files_deleted_at is not null from public.profile_verifications where user_id='${JEAN}' order by created_at desc limit 1`,
  ) === "t",
);
check("Aucune erreur JavaScript (admin)", adm.errs.length === 0, adm.errs.join(" | "));

sql("update public.verification_settings set liveness_min_shift = 0.08");
for (const c of checks) console.log(c.join(" | "));
console.log(
  `${checks.filter((c) => c[0] === "OK").length} / ${checks.length} vérifications réussies`,
);
await b.close();
