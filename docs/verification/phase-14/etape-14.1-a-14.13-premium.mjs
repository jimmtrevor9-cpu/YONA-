// YONA — Phase 14 / Étapes 14.1 à 14.13 — Premium (page, formules, paiement, activation,
// badge, prolongation, expiration, Stripe).
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-14/etape-14.1-a-14.13-premium.mjs
// Le paiement Stripe est vérifié avec un FAUX Stripe local (aucun appel réel à Stripe) :
// création de la page de paiement, puis notifications signées envoyées au webhook.
import { createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";

import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  tokenOf,
} from "../outils/base-favoris.mjs";
import { restartServer } from "../outils/serveur.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("c14", {
  f: ["female", "Premfemme"],
  h: ["male", "Premhomme"],
  g: ["female", "Premstripe"],
  x: ["female", "Premcachee"],
});
const tf = await tokenOf(emails.f, PWD);
const th = await tokenOf(emails.h, PWD);
const subs = (u) =>
  sql(`select count(*) from public.subscriptions where user_id='${id[u]}' and status='active'`);
const isPremium = (u) => sql(`select public.is_premium('${id[u]}')`) === "t";
const DAY = 86400 * 1000;

await restartServer({ PAYMENT_PROVIDER: "test" });

// A. Base de données : montants et droits
check(
  "Montants serveur : 5 USD par mois, 35 USD par an",
  sql(
    `select public.premium_plan_amount('premium_monthly') || '/' || public.premium_plan_amount('premium_yearly')`,
  ) === "500/3500",
);
let r = await rest(tf, "rpc/start_premium_payment", "POST", {
  _plan: "premium_yearly",
  _provider: "gratuit",
});
check(
  "Prestataire inconnu : refusé",
  r.status >= 400 && r.text.includes("payment_provider_unavailable"),
);
r = await rest(tf, "rpc/start_premium_payment", "POST", {
  _plan: "premium_vip",
  _provider: "test",
});
check("Formule inconnue : refusée", r.status >= 400, `${r.status}`);
r = await rest(null, "rpc/start_premium_payment", "POST", {
  _plan: "premium_yearly",
  _provider: "test",
});
check("Visiteur non connecté : aucun paiement", r.status >= 400, `${r.status}`);
r = await rest(tf, "subscriptions", "POST", {
  user_id: id.f,
  plan: "premium_yearly",
  status: "active",
  starts_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 365 * DAY).toISOString(),
});
check("S'offrir Premium en écrivant l'abonnement : refusé", r.status >= 400 && subs("f") === "0");
r = await rest(tf, "payments", "POST", {
  user_id: id.f,
  type: "subscription",
  amount: 1,
  currency: "USD",
  provider: "test",
  status: "succeeded",
  metadata: { plan: "premium_yearly" },
});
check("Créer un paiement « réussi » soi-même : refusé", r.status >= 400 && subs("f") === "0");
r = await rest(tf, "rpc/expire_subscriptions", "POST", {});
check("Lancer l'expiration depuis le navigateur : refusé", r.status >= 400, `${r.status}`);

// B. Page Premium (prestataire de test)
const { browser, jsErrors, login } = await openBrowser();
const pf = await login(emails.f, PWD);
await pf.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await pf.getByTestId("premium-link").waitFor({ timeout: 8000 });
check(
  "Profil : carte « Passer en Premium »",
  (await pf.getByTestId("premium-link").textContent()).includes("Passer en Premium"),
);
await pf.getByTestId("premium-link").click();
await pf.getByTestId("premium-page").waitFor({ timeout: 8000 });
await pf.getByTestId("premium-pay").waitFor({ timeout: 8000 });
const monthlyText = await pf.getByTestId("plan-premium_monthly").textContent();
const yearlyText = await pf.getByTestId("plan-premium_yearly").textContent();
check(
  "Formules : Mensuel 5 USD, Annuel 35 USD",
  monthlyText.includes("5 USD") && yearlyText.includes("35 USD"),
  `${monthlyText} | ${yearlyText}`,
);
check(
  "Formule annuelle choisie par défaut",
  (await pf.getByTestId("plan-premium_yearly").getAttribute("aria-checked")) === "true" &&
    (await pf.getByTestId("premium-pay").textContent()).includes("35 USD"),
);
const free = await pf.getByTestId("free-features").textContent();
const prem = await pf.getByTestId("premium-features").textContent();
check(
  "Listes Gratuit et Premium (cahier des charges §3)",
  free.includes("5 demandes de contact par jour") &&
    free.includes("3 photos") &&
    prem.includes("Demandes de contact illimitées") &&
    prem.includes("Messages vocaux") &&
    prem.includes("Support prioritaire"),
);
check("Mode test signalé", (await pf.getByTestId("payment-test-mode").count()) === 1);
let startCall = null;
pf.on("request", (q) => {
  if (q.url().includes("/_serverFn/") && (q.postData() ?? "").includes("premium_monthly"))
    startCall = { url: q.url(), headers: q.headers(), body: q.postData() };
});
await pf.getByTestId("plan-premium_monthly").click();
check(
  "Choix Mensuel : bouton « Payer 5 USD (mensuel) »",
  (await pf.getByTestId("premium-pay").textContent()).includes("Payer 5 USD (mensuel)"),
);
await pf.getByTestId("premium-pay").click();
await pf.getByTestId("payment-pending").waitFor({ timeout: 8000 });
check(
  "Paiement créé : 5 USD en attente, rien d'actif encore",
  sql(
    `select amount||'/'||status from public.payments where user_id='${id.f}' and type='subscription'`,
  ) === "500/pending" && !isPremium("f"),
);
await pf.getByRole("button", { name: "Confirmer le paiement de test (aucun argent réel)" }).click();
await pf.getByTestId("payment-confirmed").waitFor({ timeout: 8000 });
await pf.getByTestId("premium-active").waitFor({ timeout: 8000 });
const monthDays = Number(
  sql(
    `select round(extract(epoch from expires_at - now())/86400) from public.subscriptions where user_id='${id.f}'`,
  ),
);
check(
  "Paiement confirmé : Premium actif pour 1 mois (28 à 31 jours)",
  isPremium("f") && subs("f") === "1" && monthDays >= 28 && monthDays <= 31,
  `${monthDays} jours`,
);
check(
  "Page : « Vous êtes membre Premium », formule mensuelle et date de fin",
  (await pf.getByTestId("premium-expires").textContent()).includes("Formule mensuelle") &&
    (await pf.getByTestId("premium-active").getByTestId("premium-badge").count()) === 1,
);
r = await rest(tf, "rpc/get_contact_request_quota", "POST", {});
check("Avantage immédiat : demandes de contact illimitées", r.json?.unlimited === true, r.text);

// Le même appel rejoué avec une formule inventée : refusé, aucun paiement créé.
const paymentsBefore = sql(`select count(*) from public.payments where user_id='${id.f}'`);
const replay = await fetch(startCall.url, {
  method: "POST",
  headers: startCall.headers,
  body: startCall.body.replace("premium_monthly", "premium_gratuit"),
});
const replayText = await replay.text();
check(
  "Formule modifiée dans l'appel au serveur : refusée, aucun paiement créé",
  !replayText.includes('"paymentId"') &&
    sql(`select count(*) from public.payments where user_id='${id.f}'`) === paymentsBefore &&
    subs("f") === "1",
  replayText.slice(0, 100),
);

// C. Prolongation : la nouvelle période commence à la fin de l'actuelle.
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("premium-pay").waitFor({ timeout: 8000 });
check(
  "Déjà Premium : bouton « Prolonger 35 USD (annuel) »",
  (await pf.getByTestId("premium-pay").textContent()).includes("Prolonger 35 USD"),
);
await pf.getByTestId("premium-pay").click();
await pf.getByRole("button", { name: "Confirmer le paiement de test (aucun argent réel)" }).click();
await pf.getByTestId("payment-confirmed").waitFor({ timeout: 8000 });
const chained = sql(
  `select (select starts_at from public.subscriptions where user_id='${id.f}' and plan='premium_yearly') = (select expires_at from public.subscriptions where user_id='${id.f}' and plan='premium_monthly')`,
);
r = await rest(tf, "rpc/get_my_premium", "POST", {});
const totalDays = Math.round((new Date(r.json?.expires_at) - Date.now()) / DAY);
check(
  "Prolongation annuelle : commence à la fin du mois en cours (aucun jour perdu)",
  chained === "t" && totalDays >= 393 && totalDays <= 397,
  `${totalDays} jours au total`,
);

// D. Montant différent confirmé par le prestataire : échec, pas d'abonnement.
r = await rest(th, "rpc/start_premium_payment", "POST", {
  _plan: "premium_yearly",
  _provider: "test",
});
const hPayment = r.json;
check(
  "Paiement de 35 USD confirmé à 1 USD : marqué échoué, Premium non activé",
  sql(`select public.confirm_payment('${hPayment}','test','tx-${hPayment}',100,'USD')`) ===
    "failed" && !isPremium("h"),
);
r = await rest(th, "rpc/confirm_payment", "POST", {
  _payment_id: hPayment,
  _provider: "test",
  _provider_transaction_id: "moi",
  _amount: 3500,
  _currency: "USD",
});
check("Confirmer un paiement depuis le navigateur : refusé", r.status >= 400 && !isPremium("h"));

// E. Badge Premium vu par les autres membres
const matchId = match(id, "f", "h");
const ph = await login(emails.h, PWD);
await ph.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await ph.waitForTimeout(800);
check(
  "Badge « Premium » sur le profil d'un membre Premium",
  (await ph.getByTestId("premium-badge").count()) === 1,
);
r = await rest(th, "rpc/get_premium_badges", "POST", { _user_ids: [id.f, id.h] });
check(
  "Badges : seulement les membres Premium (ni formule, ni dates)",
  JSON.stringify(r.json) === JSON.stringify([id.f]),
  r.text,
);
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.x}','premium_yearly','active', now() - interval '1 day', now() + interval '300 days');
   update public.profiles set visibility='hidden' where user_id='${id.x}';`,
);
r = await rest(th, "rpc/get_premium_badges", "POST", { _user_ids: [id.x] });
check("Profil masqué : son badge n'est pas révélé", JSON.stringify(r.json) === "[]", r.text);
r = await rest(null, "rpc/get_premium_badges", "POST", { _user_ids: [id.f] });
check("Visiteur non connecté : aucun badge", r.status >= 400 || JSON.stringify(r.json) === "[]");

// F. Expiration exacte
sql(
  `update public.subscriptions set starts_at = now() - interval '40 days', expires_at = now() - interval '1 minute' where user_id='${id.f}' and plan='premium_monthly';
   update public.subscriptions set starts_at = now() - interval '2 days', expires_at = now() - interval '1 second' where user_id='${id.f}' and plan='premium_yearly';`,
);
r = await rest(tf, "rpc/get_contact_request_quota", "POST", {});
check(
  "Date de fin passée : Premium terminé aussitôt (quota gratuit de retour)",
  !isPremium("f") && r.json?.unlimited === false,
  r.text,
);
await pf.goto(`${BASE}/premium`, { waitUntil: "networkidle" });
await pf.getByTestId("premium-expired").waitFor({ timeout: 8000 });
check(
  "Page : « Votre abonnement Premium a pris fin le … »",
  (await pf.getByTestId("premium-expired").textContent()).includes("a pris fin") &&
    (await pf.getByTestId("premium-active").count()) === 0,
);
check(
  "Tâche d'expiration : statut « expiré » enregistré",
  Number(sql(`select public.expire_subscriptions()`)) >= 2 &&
    sql(
      `select count(*) from public.subscriptions where user_id='${id.f}' and status='expired'`,
    ) === "2",
);

// G. Stripe (faux Stripe local) : page de paiement puis notification signée
const fakeCalls = [];
const fake = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    fakeCalls.push({ url: req.url, auth: req.headers.authorization, body });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1" }));
  });
}).listen(4999);
const SECRET = "whsec_yona_test";
await restartServer({
  PAYMENT_PROVIDER: "stripe",
  STRIPE_SECRET_KEY: "sk_test_yona_faux",
  STRIPE_WEBHOOK_SECRET: SECRET,
  STRIPE_API_URL: "http://127.0.0.1:4999/v1",
  APP_URL: BASE,
});
const pg = await login(emails.g, PWD);
await pg.route("https://checkout.stripe.test/**", (route) =>
  route.fulfill({ contentType: "text/html", body: "<h1>Faux Stripe</h1>" }),
);
await pg.goto(`${BASE}/premium`, { waitUntil: "networkidle" });
await pg.getByTestId("premium-pay").waitFor({ timeout: 8000 });
check(
  "Stripe : pas de mention « mode test »",
  (await pg.getByTestId("payment-test-mode").count()) === 0,
);
await pg.getByTestId("premium-pay").click();
await pg.waitForURL(/checkout\.stripe\.test/, { timeout: 8000 });
const gPayment = sql(
  `select id from public.payments where user_id='${id.g}' and type='subscription' and provider='stripe'`,
);
const sent = new URLSearchParams(fakeCalls[0]?.body ?? "");
check(
  "Stripe : redirection vers la page de paiement Stripe",
  pg.url().startsWith("https://checkout.stripe.test/"),
);
check(
  "Stripe : 35 USD envoyés par le serveur avec la référence du paiement YONA",
  sent.get("line_items[0][price_data][unit_amount]") === "3500" &&
    sent.get("line_items[0][price_data][currency]") === "usd" &&
    sent.get("metadata[payment_id]") === gPayment &&
    sent.get("success_url") === `${BASE}/premium?paiement=ok` &&
    fakeCalls[0]?.auth === "Bearer sk_test_yona_faux",
  fakeCalls[0]?.body?.slice(0, 160),
);
check("Stripe : rien d'actif avant la notification", !isPremium("g"));

const eventFor = (paymentId, amount, sessionId) =>
  JSON.stringify({
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_status: "paid",
        amount_total: amount,
        currency: "usd",
        metadata: { payment_id: paymentId },
      },
    },
  });
const sign = (payload, t = Math.floor(Date.now() / 1000), secret = SECRET) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;
const hook = (payload, signature) =>
  fetch(`${BASE}/api/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "Stripe-Signature": signature } : {}),
    },
    body: payload,
  });
const good = eventFor(gPayment, 3500, "cs_test_1");
let res = await hook(good, null);
check("Webhook sans signature : refusé (400)", res.status === 400 && !isPremium("g"));
res = await hook(good, sign(good, undefined, "whsec_faux"));
check("Webhook signé avec un autre secret : refusé (400)", res.status === 400 && !isPremium("g"));
res = await hook(good, sign(good, Math.floor(Date.now() / 1000) - 3600));
check("Webhook ancien (rejeu après 1 h) : refusé (400)", res.status === 400 && !isPremium("g"));
const tampered = eventFor(gPayment, 3500, "cs_test_1");
res = await hook(tampered.replace("3500", "100"), sign(tampered));
check("Contenu modifié après signature : refusé (400)", res.status === 400 && !isPremium("g"));
res = await hook(good, sign(good));
check(
  "Webhook correctement signé : paiement confirmé, Premium annuel actif",
  res.status === 200 &&
    isPremium("g") &&
    sql(
      `select status||'/'||provider_transaction_id from public.payments where id='${gPayment}'`,
    ) === "succeeded/cs_test_1",
  `${res.status}`,
);
res = await hook(good, sign(good));
check(
  "Même notification reçue deux fois : un seul abonnement",
  res.status === 200 && subs("g") === "1",
);
await pg.goto(`${BASE}/premium?paiement=ok`, { waitUntil: "networkidle" });
await pg.getByTestId("premium-active").waitFor({ timeout: 8000 });
check(
  "Retour de Stripe : « Vous êtes membre Premium », formule annuelle",
  (await pg.getByTestId("premium-expires").textContent()).includes("Formule annuelle"),
);
r = await rest(th, "rpc/start_premium_payment", "POST", {
  _plan: "premium_monthly",
  _provider: "stripe",
});
const wrong = eventFor(r.json, 100, "cs_test_2");
res = await hook(wrong, sign(wrong));
check(
  "Stripe confirme un autre montant : paiement échoué, pas de Premium",
  res.status === 200 &&
    sql(`select status from public.payments where id='${r.json}'`) === "failed" &&
    !isPremium("h"),
);
const assets = readdirSync(".output/public/assets").filter((f) => f.endsWith(".js"));
const bundle = assets.map((f) => readFileSync(`.output/public/assets/${f}`, "utf8")).join("\n");
check(
  "Code du navigateur : aucune clé ni variable secrète Stripe",
  !bundle.includes("STRIPE_SECRET_KEY") &&
    !bundle.includes("STRIPE_WEBHOOK_SECRET") &&
    !bundle.includes("sk_test_yona"),
);
fake.close();

await restartServer({ PAYMENT_PROVIDER: "" });
await ph.goto(`${BASE}/premium`, { waitUntil: "networkidle" });
await ph.getByTestId("payment-not-available").waitFor({ timeout: 8000 });
check(
  "Aucun prestataire configuré : « pas encore disponible », aucun bouton de paiement",
  (await ph.getByTestId("premium-pay").count()) === 0,
);
await restartServer({ PAYMENT_PROVIDER: "test" });

const small = await login(emails.h, PWD, 320);
await small.goto(`${BASE}/premium`, { waitUntil: "networkidle" });
await small.waitForTimeout(800);
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
