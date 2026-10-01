// YONA — Phase 15 / Étapes 15.1 à 15.16 — Avantages Premium.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-15/etape-15.1-a-15.16-avantages-premium.mjs
// Le message vocal enregistré dans le navigateur utilise le faux micro de Chromium.
import { createRequire } from "node:module";

import {
  API,
  BASE,
  KEY,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  toastText,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("c15", {
  f: ["female", "Avfree"],
  p: ["male", "Avprem"],
  o: ["male", "Avautre"],
  b: ["male", "Avboost"],
  n: ["male", "Avnormal"],
});
const tok = {};
for (const u of Object.keys(id)) tok[u] = await tokenOf(emails[u], PWD);
const premium = (u, days = 30) =>
  sql(
    `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id[u]}','premium_monthly','active', now() - interval '1 day', now() + interval '${days} days')`,
  );
premium("p");
premium("b");

/** Dépôt d'un fichier dans le stockage au nom d'un membre. */
async function upload(u, bucket, path, bytes, type) {
  const res = await fetch(`${API}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${tok[u]}`, "Content-Type": type },
    body: bytes,
  });
  return { status: res.status, text: await res.text() };
}
async function signedStatus(u, bucket, path) {
  const res = await fetch(`${API}/storage/v1/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tok[u]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  return res.status;
}

// A. Avantages déjà en place (revérifiés avec un vrai abonnement)
let r = await rest(tok.p, "rpc/get_contact_request_quota", "POST", {});
const r2 = await rest(tok.p, "rpc/get_ai_quota", "POST", { _feature: "roi_salomon" });
check(
  "15.1 / 15.2 : Premium → demandes et Roi Salomon illimités",
  r.json?.unlimited === true && r2.json?.unlimited === true,
);
r = await rest(tok.p, "rpc/get_favorited_by", "POST", {});
const rf = await rest(tok.f, "rpc/get_favorited_by", "POST", {});
check(
  "15.3 : favoris entrants → Premium oui, gratuit refusé",
  r.status === 200 && rf.text.includes("premium_required"),
);
r = await rest(tok.p, "rpc/get_profile_visitors", "POST", {});
const rv = await rest(tok.f, "rpc/get_profile_visitors", "POST", {});
check(
  "15.4 : visiteurs → Premium oui, gratuit refusé",
  r.status === 200 && rv.text.includes("premium_required"),
);
r = await rest(tok.p, "rpc/get_presence", "POST", { _user_id: id.f });
const rpf = await rest(tok.f, "rpc/get_presence", "POST", { _user_id: id.p });
check(
  "15.8 : qui est connecté → Premium oui, gratuit refusé",
  r.status === 200 && rpf.text.includes("premium_required"),
);
r = await rest(tok.f, "rpc/search_profiles", "POST", { _filters: { active_within_days: 7 } });
check(
  "15.13 : filtres avancés refusés en gratuit",
  r.status >= 400 || r.text.includes("premium"),
  r.text.slice(0, 80),
);
r = await rest(tok.f, "rpc/contains_phone_number", "POST", { _text: "0612345678" });
check("Détecteur de numéro : réservé au serveur (règle phase 6)", r.status >= 400, `${r.status}`);

// B. 15.5 — 3 / 10 photos et HD
const big = Buffer.alloc(3 * 1024 * 1024, 7);
const small = Buffer.alloc(200 * 1024, 7);
const addPhoto = async (u, bytes, n) => {
  const path = `${id[u]}/t15-${n}.jpg`;
  const up = await upload(u, "photos", path, bytes, "image/jpeg");
  const ins = await rest(tok[u], "photos", "POST", { user_id: id[u], storage_path: path });
  return { up, ins };
};
let res = await addPhoto("f", big, "hd");
check(
  "Gratuit : photo HD (3 Mo) refusée « photo_hd_premium »",
  res.up.status === 200 && res.ins.text.includes("photo_hd_premium"),
  res.ins.text.slice(0, 80),
);
for (let i = 0; i < 3; i++) await addPhoto("f", small, `s${i}`);
res = await addPhoto("f", small, "s3");
check(
  "Gratuit : 4e photo refusée (limite de 3)",
  res.ins.text.includes("photo_limit_reached") &&
    sql(`select count(*) from public.photos where user_id='${id.f}'`) === "3",
);
res = await addPhoto("p", big, "hd");
check("Premium : photo HD (3 Mo) acceptée", res.ins.status === 201, res.ins.text.slice(0, 80));
for (let i = 0; i < 9; i++) await addPhoto("p", small, `s${i}`);
res = await addPhoto("p", small, "s9");
check(
  "Premium : 10 photos, la 11e refusée",
  res.ins.text.includes("photo_limit_reached") &&
    sql(`select count(*) from public.photos where user_id='${id.p}'`) === "10",
);
const replace = await fetch(`${API}/storage/v1/object/photos/${id.f}/t15-s0.jpg`, {
  method: "PUT",
  headers: { apikey: KEY, Authorization: `Bearer ${tok.f}`, "Content-Type": "image/jpeg" },
  body: big,
});
check("Remplacer une photo déjà enregistrée : refusé", replace.status >= 400, `${replace.status}`);
sql(`delete from public.photos where user_id='${id.f}'`);

// C. 15.6 — Messagerie illimitée
const mFP = match(id, "f", "p");
const conv = sql(`select id from public.conversations where match_id='${mFP}'`);
const say = (u, text) =>
  rest(tok[u], "rpc/send_message", "POST", { _conversation_id: conv, _content: text });
for (let i = 1; i <= 3; i++) await say("f", `Message gratuit ${i}`);
r = await say("f", "Message gratuit 4");
check("Gratuit : 4e message refusé (3 par conversation)", r.text.includes("free_limit_reached"));
let okCount = 0;
for (let i = 1; i <= 6; i++) if ((await say("p", `Message premium ${i}`)).status === 200) okCount++;
r = await rest(tok.p, "rpc/get_message_quota", "POST", { _conversation_id: conv });
check(
  "Premium : 6 messages envoyés, rien de décompté, quota « premium »",
  okCount === 6 &&
    r.json?.[0]?.premium === true &&
    r.json?.[0]?.exhausted === false &&
    r.json?.[0]?.used === 0,
  r.text.slice(0, 160),
);
r = await rest(tok.f, "rpc/get_message_quota", "POST", { _conversation_id: conv });
check(
  "L'autre membre (gratuit) garde sa propre limite",
  r.json?.[0]?.premium === false && r.json?.[0]?.exhausted === true,
);

// D. 15.7 — Messages vocaux
const ogg = Buffer.from("OggS" + "0".repeat(2000));
res = await upload("f", "voice-messages", `${conv}/${id.f}/v1.ogg`, ogg, "audio/ogg");
check("Gratuit : dépôt d'un vocal refusé", res.status >= 400, `${res.status}`);
r = await rest(tok.f, "rpc/send_voice_message", "POST", {
  _conversation_id: conv,
  _audio_path: `${conv}/${id.f}/v1.ogg`,
  _duration_seconds: 5,
});
check(
  "Gratuit : envoi d'un vocal refusé « premium_required »",
  r.text.includes("premium_required"),
);
const vpath = `${conv}/${id.p}/v1.ogg`;
res = await upload("p", "voice-messages", vpath, ogg, "audio/ogg");
check("Premium : dépôt du vocal accepté", res.status === 200, res.text.slice(0, 80));
r = await rest(tok.p, "rpc/send_voice_message", "POST", {
  _conversation_id: conv,
  _audio_path: vpath,
  _duration_seconds: 0,
});
check("Durée invalide : refusé", r.text.includes("voice_invalid_duration"));
r = await rest(tok.p, "rpc/send_voice_message", "POST", {
  _conversation_id: conv,
  _audio_path: `${conv}/${id.p}/absent.ogg`,
  _duration_seconds: 5,
});
check("Fichier inexistant : refusé", r.text.includes("voice_file_invalid"));
r = await rest(tok.p, "rpc/send_voice_message", "POST", {
  _conversation_id: conv,
  _audio_path: vpath,
  _duration_seconds: 5,
});
check(
  "Premium : vocal enregistré comme message de la conversation",
  r.status === 200 &&
    sql(
      `select kind||'/'||audio_duration_seconds from public.messages where audio_path='${vpath}'`,
    ) === "voice/5",
  r.text.slice(0, 80),
);
r = await rest(tok.p, "rpc/send_voice_message", "POST", {
  _conversation_id: conv,
  _audio_path: vpath,
  _duration_seconds: 5,
});
check("Même fichier envoyé deux fois : refusé", r.text.includes("voice_file_invalid"));
check(
  "Écoute : les 2 participants oui, une personne extérieure non",
  (await signedStatus("f", "voice-messages", vpath)) === 200 &&
    (await signedStatus("p", "voice-messages", vpath)) === 200 &&
    (await signedStatus("o", "voice-messages", vpath)) >= 400,
);
res = await upload("o", "voice-messages", `${conv}/${id.o}/x.ogg`, ogg, "audio/ogg");
premium("o");
const res2 = await upload("o", "voice-messages", `${conv}/${id.o}/y.ogg`, ogg, "audio/ogg");
check(
  "Premium extérieur à la conversation : dépôt refusé",
  res.status >= 400 && res2.status >= 400,
);
sql(`delete from public.subscriptions where user_id='${id.o}'`);

// E. 15.14 — Boost
r = await rest(tok.f, "rpc/activate_profile_boost", "POST", {});
check("Gratuit : boost refusé « premium_required »", r.text.includes("premium_required"));
r = await rest(tok.f, "profile_boosts", "POST", {
  user_id: id.f,
  expires_at: new Date(Date.now() + 3600e3).toISOString(),
});
check("Écrire un boost directement : refusé", r.status >= 400);
r = await rest(tok.b, "rpc/activate_profile_boost", "POST", {});
const minutes = Math.round((new Date(r.json) - Date.now()) / 60000);
check("Premium : boost actif 1 heure", minutes >= 59 && minutes <= 60, `${minutes} min`);
r = await rest(tok.b, "rpc/activate_profile_boost", "POST", {});
check(
  "Deuxième boost dans la semaine : refusé « boost_cooldown »",
  r.text.includes("boost_cooldown"),
);
r = await rest(tok.b, "rpc/get_my_boost", "POST", {});
check(
  "État du boost : actif jusqu'à…, prochain dans 7 jours",
  !!r.json?.active_until &&
    Math.round((new Date(r.json.next_available_at) - Date.now()) / 86400e3) === 7,
);

// F. 15.12 — Meilleur classement (Découvrir et Recherche)
// Vu par « o » (sans Match avec eux) : b (boosté), p (Premium), n (gratuit).
const order = (rows) =>
  (rows ?? []).map((x) => x.user_id).filter((u) => [id.b, id.p, id.n].includes(u));
const names = (list) => JSON.stringify(list.map((u) => Object.keys(id).find((k) => id[k] === u)));
r = await rest(tok.o, "rpc/discover_profiles", "POST", { _limit: 50 });
const d = order(r.json);
check(
  "Découvrir : profil boosté, puis Premium, puis les autres",
  names(d) === '["b","p","n"]',
  names(d),
);
r = await rest(tok.o, "rpc/search_profiles", "POST", { _filters: {}, _limit: 50 });
const s = order(r.json);
check("Recherche : même classement", names(s) === '["b","p","n"]', names(s));
sql(
  `update public.profile_boosts set expires_at = now() - interval '1 second', starts_at = now() - interval '2 hours' where user_id='${id.b}'`,
);
r = await rest(tok.o, "rpc/discover_profiles", "POST", { _limit: 50 });
const d2 = order(r.json);
check(
  "Boost terminé : le membre redevient classé comme les autres Premium",
  d2.indexOf(id.b) < d2.indexOf(id.n) && d2.indexOf(id.p) < d2.indexOf(id.n),
  names(d2),
);

// G. 15.16 — Support prioritaire
r = await rest(tok.f, "rpc/create_support_ticket", "POST", {
  _subject: "Question",
  _message: "Comment modifier ma ville ?",
});
const rp = await rest(tok.p, "rpc/create_support_ticket", "POST", {
  _subject: "Paiement",
  _message: "Mon paiement Premium est bien passé ?",
});
check(
  "Demande au support : « normale » en gratuit, « prioritaire » en Premium",
  sql(`select priority from public.support_tickets where id='${r.json}'`) === "normal" &&
    sql(`select priority from public.support_tickets where id='${rp.json}'`) === "priority",
);
r = await rest(tok.f, "rpc/create_support_ticket", "POST", { _subject: "a", _message: "court" });
check("Sujet ou message trop court : refusé", r.text.includes("support_invalid_subject"));
for (let i = 0; i < 4; i++)
  await rest(tok.f, "rpc/create_support_ticket", "POST", {
    _subject: `Demande ${i}`,
    _message: "Un message assez long pour passer.",
  });
r = await rest(tok.f, "rpc/create_support_ticket", "POST", {
  _subject: "Encore",
  _message: "Une sixième demande aujourd'hui.",
});
check("6e demande du jour : refusée (anti-abus)", r.text.includes("support_daily_limit"));
r = await rest(tok.f, `support_tickets?select=id&user_id=eq.${id.p}`, "GET");
check("Les demandes des autres ne sont pas lisibles", JSON.stringify(r.json) === "[]");
r = await rest(tok.f, "support_tickets", "POST", {
  user_id: id.f,
  subject: "Direct",
  message: "Écriture directe interdite",
  priority: "priority",
});
check("S'attribuer la priorité en écrivant directement : refusé", r.status >= 400);

// H. Pages
const { browser, jsErrors, login } = await openBrowser();
const pp = await login(emails.p, PWD);
await pp.goto(`${BASE}/messages/${conv}`, { waitUntil: "networkidle" });
await pp.getByTestId("message-quota").waitFor({ timeout: 8000 });
check(
  "Conversation Premium : « Premium : messages illimités », pas d'offre de déblocage",
  (await pp.getByTestId("message-quota").textContent()).includes("Premium : messages illimités") &&
    (await pp.getByTestId("unlock-offer").count()) === 0,
);
await pp.getByTestId("voice-message").first().waitFor({ timeout: 8000 });
check(
  "Vocal affiché dans le fil avec lecteur audio",
  (await pp.getByTestId("voice-message").first().textContent()).includes("0:05") &&
    (await pp.locator("[data-testid=voice-message] audio").count()) >= 1,
);
check("Premium : bouton micro actif", (await pp.getByTestId("voice-record").count()) === 1);
await pp.getByTestId("icebreaker-open").click();
check(
  "Ice Breaker disponible au-dessus du champ",
  (await pp.getByTestId("icebreaker-suggestion").count()) === 3,
);
await pp.getByRole("button", { name: "Fermer" }).click();

const pf = await login(emails.f, PWD);
await pf.goto(`${BASE}/messages/${conv}`, { waitUntil: "networkidle" });
await pf.getByTestId("voice-message").first().waitFor({ timeout: 8000 });
check(
  "Gratuit : écoute le vocal reçu ; micro verrouillé (lien Premium)",
  (await pf.locator("[data-testid=voice-message] audio").count()) >= 1 &&
    (await pf.getByTestId("voice-locked").getAttribute("href")) === "/premium",
);
await pf.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pf.getByTestId("photos-hd-hint").waitFor({ timeout: 8000 });
check(
  "Profil gratuit : « Premium : 10 photos en HD » et boost « Inclus avec Premium »",
  (await pf.getByTestId("photos-hd-hint").textContent()).includes("10 photos en HD") &&
    (await pf.getByTestId("boost-card").textContent()).includes("Inclus avec Premium"),
);
// Photo lourde choisie par un membre gratuit : réduite à 1 280 px avant l'envoi.
const noise = await pf.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 2400;
  c.height = 1800;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < img.data.length; i++) img.data[i] = Math.random() * 255;
  ctx.putImageData(img, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
});
const noiseBuf = Buffer.from(noise, "base64");
await pf.locator("input[type=file]").setInputFiles({
  name: "grande.jpg",
  mimeType: "image/jpeg",
  buffer: noiseBuf,
});
for (
  let i = 0;
  i < 80 && sql(`select count(*) from public.photos where user_id='${id.f}'`) === "0";
  i++
)
  await pf.waitForTimeout(100);
const storedSize = Number(
  sql(
    `select coalesce(max((o.metadata->>'size')::bigint),0) from storage.objects o join public.photos p on p.storage_path=o.name where p.user_id='${id.f}'`,
  ),
);
check(
  "Gratuit : photo lourde réduite (qualité standard) puis acceptée",
  noiseBuf.length > 2 * 1024 * 1024 && storedSize > 0 && storedSize <= 2 * 1024 * 1024,
  `${Math.round(noiseBuf.length / 1024)} Ko → ${Math.round(storedSize / 1024)} Ko`,
);

const pb = await login(emails.b, PWD);
sql(`delete from public.profile_boosts where user_id='${id.b}'`);
await pb.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pb.getByTestId("boost-activate").waitFor({ timeout: 8000 });
await pb.getByTestId("boost-activate").click();
await pb.getByTestId("boost-active").waitFor({ timeout: 8000 });
check("Profil Premium : « Booster mon profil » → « Boost actif jusqu'à … »", true);
await pb.getByTestId("support-link").click();
await pb.getByTestId("support-page").waitFor({ timeout: 8000 });
await pb.getByLabel("Sujet").fill("Aide Premium");
await pb.getByLabel("Votre message").fill("Je voudrais de l'aide pour mon profil.");
await pb.getByRole("button", { name: "Envoyer la demande" }).click();
await pb.getByTestId("support-ticket").first().waitFor({ timeout: 8000 });
check(
  "Page Support : « Support prioritaire 7j/7 », demande listée « Prioritaire »",
  (await pb.getByTestId("support-priority").count()) === 1 &&
    (await pb.getByTestId("ticket-priority").count()) === 1 &&
    (await pb.getByTestId("support-ticket").first().textContent()).includes("Aide Premium"),
);

// Enregistrement réel d'un vocal (faux micro de Chromium).
const micBrowser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
const mic = await (
  await micBrowser.newContext({ viewport: { width: 390, height: 800 } })
).newPage();
mic.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await mic.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await mic.fill("#email", emails.p);
await mic.fill("#password", PWD);
await mic.click("button[type=submit]");
await mic.waitForURL(/\/discover$/, { timeout: 8000 });
await mic.goto(`${BASE}/messages/${conv}`, { waitUntil: "networkidle" });
const before = Number(
  sql(`select count(*) from public.messages where conversation_id='${conv}' and kind='voice'`),
);
await mic.getByTestId("voice-record").click();
await mic.waitForTimeout(2300);
await mic.getByRole("button", { name: "Arrêter l'enregistrement" }).click();
await mic.getByRole("button", { name: "Envoyer le message vocal" }).click();
for (
  let i = 0;
  i < 80 &&
  Number(
    sql(`select count(*) from public.messages where conversation_id='${conv}' and kind='voice'`),
  ) === before;
  i++
)
  await mic.waitForTimeout(100);
const recorded = sql(
  `select audio_duration_seconds from public.messages where conversation_id='${conv}' and kind='voice' order by created_at desc limit 1`,
);
check(
  "Enregistrement dans le navigateur : vocal d'environ 2 s envoyé",
  Number(recorded) >= 2 && Number(recorded) <= 3,
  `${recorded} s`,
);
await mic.waitForTimeout(500);
check(
  "Le nouveau vocal apparaît dans le fil",
  (await mic.getByTestId("voice-message").count()) >= 2,
);
await micBrowser.close();

const tiny = await login(emails.f, PWD, 320);
await tiny.goto(`${BASE}/support`, { waitUntil: "networkidle" });
await tiny.waitForTimeout(600);
const overflowSupport = await tiny.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
await tiny.goto(`${BASE}/messages/${conv}`, { waitUntil: "networkidle" });
await tiny.waitForTimeout(800);
check(
  "Petit écran (320 px) : support et conversation sans débordement",
  !overflowSupport &&
    !(await tiny.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
const t = await toastText(tiny).catch(() => "");
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | ") || t);
await browser.close();
// Fichiers de test retirés par l'API de stockage (rôle service).
for (const [bucket, prefixes] of [
  ["photos", [id.f, id.p].map((u) => `${u}/`)],
  ["voice-messages", [`${conv}/`]],
]) {
  const names = sql(
    `select string_agg(name, ',') from storage.objects where bucket_id='${bucket}' and (${prefixes.map((x) => `name like '${x}%'`).join(" or ")})`,
  );
  if (names)
    await fetch(`${API}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: names.split(",") }),
    });
}
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
