// YONA — Phase 12 / Étapes 12.2 à 12.6 — Réponse aux demandes, quota 5/jour, Premium illimité.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-12/etape-12.2-a-12.6-demandes.mjs
import {
  BASE,
  createAccounts,
  createChecker,
  openBrowser,
  rest,
  sql,
  toastText,
  tokenOf,
} from "../outils/base-favoris.mjs";

const { check, finish } = createChecker();
const people = {
  v: ["male", "Dpaul"],
  p: ["male", "Dpierre"],
  a: ["female", "Dana"],
  b: ["female", "Dbea"],
  c: ["female", "Dcleo"],
  d: ["female", "Ddina"],
  e: ["female", "Delsa"],
  f: ["female", "Dfanny"],
  g: ["female", "Dgaelle"],
  x: ["male", "Dxavier"],
};
const { id, emails, PWD, cleanup } = createAccounts("c122", people);
const tok = {};
for (const k of Object.keys(people)) tok[k] = await tokenOf(emails[k], PWD);
const send = (u, x, message) =>
  rest(tok[u], "rpc/send_contact_request", "POST", {
    _receiver_id: id[x],
    ...(message !== undefined ? { _message: message } : {}),
  });
const quota = async (u) => (await rest(tok[u], "rpc/get_contact_request_quota", "POST", {})).json;
const reqId = (u, x) =>
  sql(
    `select id from public.contact_requests where sender_id='${id[u]}' and receiver_id='${id[x]}' order by created_at desc limit 1`,
  );
const respond = (u, rid, accept) =>
  rest(tok[u], "rpc/respond_contact_request", "POST", { _request_id: rid, _accept: accept });

// A. 12.2 — Réponse du destinataire
let r = await send("v", "a", "Bonjour Dana");
const r1 = reqId("v", "a");
r = await respond("b", r1, true);
check(
  "Un tiers ne peut pas répondre à la demande : « request_not_found »",
  r.status >= 400 && r.text.includes("request_not_found"),
  r.text.slice(0, 80),
);
r = await respond("v", r1, true);
check(
  "L'expéditeur ne peut pas accepter sa propre demande",
  r.status >= 400 && r.text.includes("request_not_found"),
);
r = await respond("a", r1, true);
const matchId = sql(
  `select id from public.matches where user_1_id=least('${id.v}'::uuid,'${id.a}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id.a}'::uuid) and status='active'`,
);
check(
  "Accepter : statut « accepted », Match actif et conversation créés",
  r.json?.status === "accepted" &&
    r.json?.match_id === matchId &&
    !!r.json?.conversation_id &&
    sql(`select status from public.contact_requests where id='${r1}'`) === "accepted" &&
    sql(`select count(*) from public.conversations where match_id='${matchId}'`) === "1",
  r.text.slice(0, 120),
);
r = await respond("a", r1, false);
check(
  "Répondre deux fois : « request_not_pending »",
  r.status >= 400 && r.text.includes("request_not_pending"),
);
r = await send("v", "a");
check("Nouvelle demande après Match : « already_matched »", r.text.includes("already_matched"));

await send("v", "b", "Bonjour Dbea");
const r2 = reqId("v", "b");
r = await respond("b", r2, false);
check(
  "Refuser : statut « declined », pas de Match",
  r.json?.status === "declined" &&
    sql(`select status from public.contact_requests where id='${r2}'`) === "declined" &&
    sql(
      `select count(*) from public.matches where user_1_id=least('${id.v}'::uuid,'${id.b}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id.b}'::uuid)`,
    ) === "0",
);
r = await send("v", "b");
check(
  "Relancer une personne qui a refusé : « recently_declined » (30 jours)",
  r.status >= 400 && r.text.includes("recently_declined"),
  r.text.slice(0, 80),
);

await send("v", "c");
const r3 = reqId("v", "c");
r = await rest(tok.c, "rpc/cancel_contact_request", "POST", { _request_id: r3 });
check("La destinataire ne peut pas annuler : « request_not_found »", r.text.includes("request_not_found"));
r = await rest(tok.v, "rpc/cancel_contact_request", "POST", { _request_id: r3 });
check(
  "L'expéditeur annule : statut « cancelled »",
  r.json?.status === "cancelled" &&
    sql(`select status from public.contact_requests where id='${r3}'`) === "cancelled",
);
r = await respond("c", r3, true);
check("Accepter une demande annulée : refusé", r.text.includes("request_not_pending"));

// Demandes croisées : accepter l'une accepte aussi l'autre.
await send("x", "g");
await send("g", "x");
r = await respond("g", reqId("x", "g"), true);
check(
  "Demandes croisées : accepter l'une clôt aussi l'autre (« accepted »)",
  r.json?.status === "accepted" &&
    sql(
      `select string_agg(status, ',') from public.contact_requests where (sender_id='${id.x}' and receiver_id='${id.g}') or (sender_id='${id.g}' and receiver_id='${id.x}')`,
    ) === "accepted,accepted",
);

// Liste
r = await rest(tok.v, "rpc/list_contact_requests", "POST", { _direction: "sent" });
check(
  "Liste « envoyées » : 3 demandes avec prénom et statut",
  Array.isArray(r.json) &&
    r.json.length === 3 &&
    r.json.every((x) => x.first_name && x.status) &&
    r.json.some((x) => x.first_name === "Dana" && x.status === "accepted"),
  r.text.slice(0, 120),
);
r = await rest(tok.a, "rpc/list_contact_requests", "POST", { _direction: "received" });
check(
  "Liste « reçues » : la demande avec son message",
  r.json?.length === 1 && r.json[0].message === "Bonjour Dana" && r.json[0].other_user_id === id.v,
);
r = await rest(tok.a, "rpc/list_contact_requests", "POST", { _direction: "all" });
check("Direction inconnue : « invalid_direction »", r.text.includes("invalid_direction"));
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.b}','${id.v}')`);
r = await rest(tok.v, "rpc/list_contact_requests", "POST", { _direction: "sent" });
check(
  "Membre qui m'a bloqué : sa demande n'apparaît plus dans la liste",
  r.json?.length === 2 && !r.json.some((x) => x.other_user_id === id.b),
);
r = await rest(null, "rpc/list_contact_requests", "POST", { _direction: "sent" });
check("Visiteur non connecté : liste refusée", r.status >= 400);

// B. 12.3 / 12.4 — Quota gratuit de 5 par jour
let q = await quota("v");
check(
  "Quota après 3 envois (dont 1 annulé, 1 refusé) : 3 utilisées, 2 restantes",
  q?.used === 3 && q?.limit === 5 && q?.remaining === 2 && q?.unlimited === false,
  JSON.stringify(q),
);
r = await send("v", "d");
r = await send("v", "d");
check("« already_pending » ne consomme pas de quota", (await quota("v"))?.used === 4);
r = await send("v", "e");
q = await quota("v");
check("5e demande acceptée : 0 restante", r.json?.status === "sent" && q?.remaining === 0);
r = await send("v", "f");
check(
  "6e demande : refus « daily_limit_reached », rien d'enregistré",
  r.status >= 400 &&
    r.text.includes("daily_limit_reached") &&
    sql(
      `select count(*) from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.f}'`,
    ) === "0",
  r.text.slice(0, 80),
);
check(
  "Remise à zéro annoncée à minuit UTC",
  new Date(q.resets_at).toISOString().endsWith("T00:00:00.000Z"),
  q.resets_at,
);
// Les demandes d'hier ne comptent plus.
sql(
  `update public.contact_requests set created_at = created_at - interval '1 day' where sender_id='${id.v}'`,
);
q = await quota("v");
check("Le lendemain : quota remis à 5", q?.used === 0 && q?.remaining === 5, JSON.stringify(q));
r = await send("v", "f");
check("Le lendemain : nouvelle demande acceptée", r.json?.status === "sent");

// C. 12.6 — Envois simultanés : jamais plus de 5
sql(`delete from public.contact_requests where sender_id='${id.p}'`);
const targets = ["a", "b", "c", "d", "e", "f", "g", "x"].filter((k) => k !== "b");
const burst = await Promise.all(targets.map((x) => send("p", x)));
check(
  "7 envois simultanés vers 7 membres : 5 acceptés au plus",
  sql(`select count(*) from public.contact_requests where sender_id='${id.p}'`) === "5" &&
    burst.filter((x) => x.json?.status === "sent").length === 5 &&
    burst.filter((x) => x.text.includes("daily_limit_reached")).length === 2,
  burst.map((x) => x.json?.status ?? (x.text.includes("daily_limit") ? "limit" : x.status)).join(","),
);
r = await rest(tok.p, "contact_requests", "POST", { sender_id: id.p, receiver_id: id.b });
check("Contourner le quota par écriture directe : refusé", r.status >= 400);
r = await rest(tok.p, "ai_usage", "POST", { user_id: id.p });
check("Aucune table de compteur modifiable directement", r.status >= 400);

// D. 12.5 — Premium illimité
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.p}','premium_monthly','active', now() - interval '1 day', now() + interval '29 days')`,
);
q = await quota("p");
check(
  "Premium : quota « illimité »",
  q?.unlimited === true && q?.limit === null && q?.remaining === null,
  JSON.stringify(q),
);
sql(
  `delete from public.contact_requests where sender_id='${id.p}' and receiver_id in ('${id.x}','${id.g}')`,
);
r = await send("p", "x");
const r6 = await send("p", "g");
check(
  "Premium : 6e et 7e demandes du jour acceptées",
  r.json?.status === "sent" && r6.json?.status === "sent",
  r.text.slice(0, 60),
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute', starts_at = now() - interval '31 days' where user_id='${id.p}'`,
);
sql(`delete from public.contact_requests where sender_id='${id.p}' and receiver_id='${id.x}'`);
r = await send("p", "x");
check(
  "Abonnement expiré : la limite gratuite s'applique de nouveau",
  r.text.includes("daily_limit_reached"),
  r.text.slice(0, 60),
);

// E. Pages
const { browser, jsErrors, login } = await openBrowser();
const pa = await login(emails.a, PWD);
sql(
  `delete from public.contact_requests where receiver_id='${id.a}'; insert into public.contact_requests (sender_id, receiver_id, message) values ('${id.x}','${id.a}','Bonjour, je suis Dxavier')`,
);
await pa.goto(`${BASE}/matches`, { waitUntil: "networkidle" });
check(
  "Matchs : lien « Demandes de contact »",
  (await pa.getByTestId("contact-requests-link").count()) === 1,
);
await pa.getByTestId("contact-requests-link").click();
await pa.getByTestId("contact-requests-page").waitFor({ timeout: 8000 });
await pa.getByTestId("contact-request-item").first().waitFor({ timeout: 8000 });
const item = pa.getByTestId("contact-request-item").filter({ hasText: "Dxavier" });
check(
  "Demandes reçues : carte avec prénom, message et boutons",
  (await item.count()) === 1 &&
    (await item.textContent()).includes("Bonjour, je suis Dxavier") &&
    (await item.getByRole("button", { name: /Accepter/ }).count()) === 1,
);
check(
  "Quota affiché : « Il vous reste 5 demandes de contact aujourd'hui »",
  (await pa.getByTestId("contact-quota").textContent()).includes("Il vous reste 5 demandes"),
  await pa.getByTestId("contact-quota").textContent(),
);
await item.getByRole("button", { name: /Accepter/ }).click();
await pa.waitForURL(/\/messages\/[0-9a-f-]+$/, { timeout: 8000 });
let t = await toastText(pa);
check(
  "Accepter : message « c'est un Match ! » et ouverture de la conversation",
  t.includes("c'est un Match") && pa.url().includes("/messages/"),
  t,
);

const pv = await login(emails.v, PWD);
await pv.goto(`${BASE}/demandes`, { waitUntil: "networkidle" });
await pv.getByRole("tab", { name: "Envoyées" }).click();
await pv.getByTestId("contact-request-item").first().waitFor({ timeout: 8000 });
const pendingSent = pv.getByTestId("contact-request-item").filter({ hasText: "Dfanny" });
check(
  "Demandes envoyées : statut « En attente » et bouton Annuler",
  (await pendingSent.getByTestId("contact-request-status").textContent()) === "En attente" &&
    (await pendingSent.getByRole("button", { name: /Annuler/ }).count()) === 1,
);
await pendingSent.getByRole("button", { name: /Annuler/ }).click();
t = await toastText(pv);
await pv.waitForTimeout(800);
check(
  "Annuler depuis la page : « Demande annulée. », statut mis à jour",
  t.includes("Demande annulée") &&
    (await pendingSent.getByTestId("contact-request-status").textContent()) === "Annulée",
  t,
);

// Quota épuisé dans la fenêtre d'envoi
sql(
  `update public.contact_requests set created_at = now() where sender_id='${id.v}'; delete from public.contact_requests where sender_id='${id.v}' and receiver_id='${id.x}';`,
);
for (const k of ["c", "g", "x"])
  sql(
    `insert into public.contact_requests (sender_id, receiver_id, status) values ('${id.v}','${id[k]}','cancelled')`,
  );
await pv.goto(`${BASE}/search`, { waitUntil: "networkidle" });
await pv.getByTestId("search-form").waitFor({ timeout: 8000 });
await pv.getByLabel("Sexe — je cherche").selectOption("");
await pv.getByRole("button", { name: "Rechercher" }).click();
await pv.waitForTimeout(1500);
await pv
  .locator("article")
  .filter({ hasText: "Dxavier " })
  .getByTestId("contact-request-button")
  .click();
const dialog = pv.getByTestId("contact-request-dialog");
await dialog.getByTestId("contact-quota").waitFor({ timeout: 8000 });
check(
  "Fenêtre d'envoi, quota épuisé : message et bouton désactivé",
  (await dialog.getByTestId("contact-quota").textContent()).includes("Plus aucune demande") &&
    (await dialog.getByRole("button", { name: "Envoyer la demande" }).isDisabled()),
  await dialog.getByTestId("contact-quota").textContent(),
);
const small = await login(emails.a, PWD, 320);
await small.goto(`${BASE}/demandes`, { waitUntil: "networkidle" });
await small.waitForTimeout(1000);
check(
  "Petit écran (320 px) : page Demandes sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check(
  "Nettoyage : comptes, demandes et abonnements de test supprimés",
  cleanup() &&
    sql(
      `select count(*) from public.contact_requests where sender_id not in (select id from public.users)`,
    ) === "0",
);
finish();
