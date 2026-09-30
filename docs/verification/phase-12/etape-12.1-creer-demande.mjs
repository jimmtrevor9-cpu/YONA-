// YONA — Phase 12 / Étape 12.1 — Vérification de la création d'une demande de contact.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-12/etape-12.1-creer-demande.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  match,
  openBrowser,
  rest,
  sql,
  tokenOf,
  toastText,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("c121", {
  v: ["male", "Capaul"],
  a: ["female", "Caana"],
  b: ["female", "Cabea"],
  m: ["female", "Camarie"],
  h: ["female", "Cahide"],
  k: ["female", "Cakira"],
  o: ["male", "Caomer"],
});
match(id, "v", "m");
sql(`update public.profiles set visibility='hidden' where user_id='${id.h}'`);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.k}','${id.v}')`);
const rows = (u, x, st) =>
  sql(
    `select count(*) from public.contact_requests where sender_id='${id[u]}' and receiver_id='${id[x]}'${st ? ` and status='${st}'` : ""}`,
  );
const tv = await tokenOf(emails.v, PWD);
const send = (token, x, message) =>
  rest(token, "rpc/send_contact_request", "POST", {
    _receiver_id: x,
    ...(message !== undefined ? { _message: message } : {}),
  });

// A. Serveur
let r = await send(tv, id.a, "Bonjour Caana, je serais heureux d'échanger avec vous.");
check(
  "Demande valide avec message : « sent »",
  r.status === 200 && r.json?.status === "sent" && rows("v", "a", "pending") === "1",
  r.text,
);
check(
  "Demande enregistrée : expéditeur, destinataire, message, statut « pending », date serveur",
  sql(
    `select message || '|' || status || '|' || ((now() - created_at) < interval '1 minute') from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.a}'`,
  ) === "Bonjour Caana, je serais heureux d'échanger avec vous.|pending|true",
);
r = await send(tv, id.b);
check(
  "Demande sans message : acceptée (message vide)",
  r.json?.status === "sent" &&
    sql(
      `select message is null from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.b}'`,
    ) === "t",
  r.text,
);
r = await send(tv, id.a, "Encore moi");
check(
  "2e demande au même membre : « already_pending », pas de doublon",
  r.json?.status === "already_pending" && rows("v", "a") === "1",
  r.text,
);
const burst = await Promise.all(Array.from({ length: 8 }, () => send(tv, id.o)));
check(
  "8 envois simultanés : 1 seule demande enregistrée",
  rows("v", "o") === "1" &&
    burst.every((x) => x.status === 200) &&
    burst.filter((x) => x.json?.status === "sent").length === 1,
  burst.map((x) => x.json?.status ?? x.status).join(","),
);
for (const [label, target, msg, code] of [
  ["à soi-même", id.v, undefined, "self_request"],
  ["à un Match existant", id.m, undefined, "already_matched"],
  ["à un profil masqué", id.h, undefined, "profile_unavailable"],
  ["à un membre qui m'a bloqué", id.k, undefined, "profile_unavailable"],
  [
    "à un membre inexistant",
    "00000000-0000-4000-8000-000000000000",
    undefined,
    "profile_unavailable",
  ],
  [
    "profil masqué + message trop long (le profil est vérifié d'abord)",
    id.h,
    "x".repeat(301),
    "profile_unavailable",
  ],
]) {
  r = await send(tv, target, msg);
  check(
    `Refus « ${code} » : ${label}`,
    r.status >= 400 && r.text.includes(code),
    `${r.status} ${r.text.slice(0, 70)}`,
  );
}
sql(`update public.profiles set visibility='visible' where user_id='${id.h}'`);
r = await send(tv, id.h, "x".repeat(301));
check(
  "Refus « message_too_long » : 301 caractères",
  r.status >= 400 && r.text.includes("message_too_long") && rows("v", "h") === "0",
  r.text.slice(0, 60),
);
r = await send(tv, id.h, "Appelle-moi au 06 12 34 56 78");
check(
  "Refus « phone_number_detected » : numéro dans le message",
  r.status >= 400 && r.text.includes("phone_number_detected") && rows("v", "h") === "0",
  r.text.slice(0, 60),
);
r = await send(tv, id.h, "   ");
check(
  "Message fait d'espaces : enregistré sans message",
  r.json?.status === "sent" &&
    sql(
      `select message is null from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.h}'`,
    ) === "t",
);
r = await send(null, id.a);
check("Visiteur non connecté : refusé", r.status >= 400, `${r.status}`);

// B. Écritures directes et lecture
r = await rest(tv, "contact_requests", "POST", { sender_id: id.v, receiver_id: id.b });
check("Écrire une demande directement : refusé", r.status >= 400, `${r.status}`);
r = await rest(tv, `contact_requests?sender_id=eq.${id.v}`, "PATCH", { status: "accepted" });
check(
  "Modifier le statut directement : refusé",
  r.status >= 400 &&
    sql(
      `select count(*) from public.contact_requests where sender_id='${id.v}' and status='accepted'`,
    ) === "0",
  `${r.status}`,
);
r = await rest(tv, `contact_requests?sender_id=eq.${id.v}`, "DELETE");
check("Effacer ses demandes directement : refusé", r.status >= 400, `${r.status}`);
const ta = await tokenOf(emails.a, PWD);
const to = await tokenOf(emails.o, PWD);
r = await rest(ta, `contact_requests?receiver_id=eq.${id.a}&select=message`);
check("La destinataire lit la demande reçue", (r.json ?? []).length === 1, r.text.slice(0, 60));
r = await rest(ta, `contact_requests?receiver_id=eq.${id.b}`);
check(
  "Un tiers ne lit pas les demandes des autres",
  (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);

// C. Page
const { browser, jsErrors, login } = await openBrowser();
const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.getByLabel("Sexe — je cherche").selectOption("");
await pv.getByRole("button", { name: "Rechercher" }).click();
await pv.waitForTimeout(1200);
const card = pv.locator("article").filter({ hasText: "Caomer " });
check(
  "Recherche : bouton « Demande de contact » sur la carte",
  (await card.getByTestId("contact-request-button").count()) === 1,
);
sql(`delete from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.o}'`);
await card.getByTestId("contact-request-button").click();
const dialog = pv.getByTestId("contact-request-dialog");
await dialog.waitFor({ timeout: 5000 });
check(
  "Fenêtre « Demande de contact à Caomer » avec message facultatif",
  (await dialog.textContent()).includes("Demande de contact à Caomer"),
);
await dialog.getByLabel("Message (facultatif)").fill("y".repeat(305));
check(
  "305 caractères : compteur en rouge, envoi désactivé",
  (await dialog.getByTestId("contact-message-count").textContent()).includes("305 / 300") &&
    (await dialog.getByRole("button", { name: "Envoyer la demande" }).isDisabled()),
);
await dialog.getByLabel("Message (facultatif)").fill("Mon numéro : 07 11 22 33 44");
await dialog.getByRole("button", { name: "Envoyer la demande" }).click();
let t = await toastText(pv);
check(
  "Numéro de téléphone : refusé, explication sous le champ, fenêtre toujours ouverte",
  t.includes("numéros de téléphone") &&
    (await dialog.getByTestId("contact-notice").count()) === 1 &&
    rows("v", "o") === "0",
  t,
);
for (let i = 0; i < 80 && (await pv.locator("[data-sonner-toast]").count()) > 0; i++)
  await pv.waitForTimeout(100);
await dialog.getByLabel("Message (facultatif)").fill("Bonjour Caomer !");
await dialog.getByRole("button", { name: "Envoyer la demande" }).click();
t = await toastText(pv);
await pv.waitForTimeout(600);
check(
  "Envoi : « Demande de contact envoyée à Caomer. », fenêtre fermée, demande enregistrée",
  t.includes("Demande de contact envoyée à Caomer.") &&
    (await dialog.count()) === 0 &&
    rows("v", "o", "pending") === "1",
  t,
);
await pv.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await pv.waitForTimeout(1500);
check(
  "Découvrir : bouton « Demande de contact » sous Passer / Like",
  (await pv
    .locator("article")
    .filter({ hasText: "Caana " })
    .getByTestId("contact-request-button")
    .count()) === 1,
);
await pv
  .locator("article")
  .filter({ hasText: "Caana " })
  .getByTestId("contact-request-button")
  .click();
await pv
  .getByTestId("contact-request-dialog")
  .getByRole("button", { name: "Envoyer la demande" })
  .click();
t = await toastText(pv);
check(
  "Demande déjà en attente : message « déjà une demande de contact en attente »",
  t.includes("déjà une demande de contact en attente pour Caana"),
  t,
);
const small = await login(emails.v, PWD, 320);
await small.waitForTimeout(1500);
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes et demandes de test supprimés",
  cleanup() &&
    sql(`select count(*) from public.contact_requests where sender_id='${id.v}'`) === "0",
);
finish();
