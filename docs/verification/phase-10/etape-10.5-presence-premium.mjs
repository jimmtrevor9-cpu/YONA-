// YONA — Phase 10 / Étape 10.5 — Vérification : présence réservée aux membres Premium.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-10/etape-10.5-presence-premium.mjs
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

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("p105", {
  f: ["male", "Pepaul"],
  m: ["female", "Pemarie"],
});
const matchId = match(id, "f", "m");
const conversationId = sql(`select id from public.conversations where match_id='${matchId}'`);
sql(
  `update public.user_activity set last_seen_at = now() - interval '30 seconds', is_online = true where user_id='${id.m}'`,
);
const tf = await tokenOf(emails.f, PWD);
const presence = (u) => rest(tf, "rpc/get_presence", "POST", { _user_id: id[u] });
const refused = (r) =>
  r.status >= 400 &&
  r.text.includes("premium_required") &&
  !/online|recent|week|inactive|unknown/.test(r.text);
const setSub = (status, starts, expires) => {
  sql(`delete from public.subscriptions where user_id='${id.f}'`);
  if (status)
    sql(
      `insert into public.subscriptions (user_id, status, starts_at, expires_at) values ('${id.f}', '${status}', now() + interval '${starts}', now() + interval '${expires}')`,
    );
};

// A. Base
let r = await presence("m");
check(
  "Membre gratuit : statut d'un autre membre refusé, aucune information",
  refused(r),
  `${r.status} ${r.text}`,
);
setSub("pending", "-1 day", "30 days");
check("Abonnement en attente : refusé", refused(await presence("m")));
setSub("active", "-40 days", "-1 hour");
check("Abonnement expiré : refusé", refused(await presence("m")));
setSub("cancelled", "-1 day", "30 days");
check("Abonnement annulé : refusé", refused(await presence("m")));
setSub(null);
r = await rest(tf, "rpc/get_presence", "POST", {
  _user_id: "00000000-0000-4000-8000-000000000000",
});
check("Membre inexistant : même refus (on ne devine rien)", refused(r), r.text);
await rest(tf, "rpc/touch_activity", "POST", {});
r = await presence("f");
check("Son propre statut reste consultable : « online »", r.json === "online", r.text);
r = await rest(tf, `user_activity?user_id=eq.${id.m}`);
check(
  "Contournement par lecture de la table : rien",
  (r.json ?? []).length === 0,
  r.text.slice(0, 60),
);
check(
  "L'activité du membre gratuit est toujours enregistrée",
  sql(
    `select (now() - last_seen_at) < interval '1 minute' from public.user_activity where user_id='${id.f}'`,
  ) === "t",
);

// B. Interface gratuite
const { browser, jsErrors, login } = await openBrowser();
const pf = await login(emails.f, PWD);
const bodies = [];
pf.on("response", async (res) => {
  if (res.url().includes("/rpc/get_presence")) bodies.push(await res.text().catch(() => ""));
});
await pf.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await pf.getByTestId("match-profile").waitFor({ timeout: 8000 });
await pf.getByTestId("presence-locked").waitFor({ timeout: 8000 });
check(
  "Profil du Match : « Statut en ligne réservé aux membres Premium », aucun statut",
  (await pf.getByTestId("presence-locked").textContent()).trim() ===
    "Statut en ligne réservé aux membres Premium" &&
    (await pf.getByTestId("presence").count()) === 0,
);
await pf.goto(`${BASE}/messages/${conversationId}`, { waitUntil: "networkidle" });
await pf.getByTestId("presence-locked").waitFor({ timeout: 8000 });
check(
  "Conversation : même mention, aucun statut",
  (await pf.getByTestId("presence").count()) === 0,
);
check(
  "Aucune réponse du serveur reçue par la page ne contient de statut",
  bodies.length > 0 && !bodies.some((b) => /online|recent|this_week|inactive/.test(b)),
  `${bodies.length} réponses`,
);

// C. Devenir Premium, puis expiration
setSub("active", "-1 day", "30 days");
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("presence").waitFor({ timeout: 8000 });
check(
  "Devenu Premium : « En ligne » s'affiche à la place de la mention",
  (await pf.getByTestId("presence").textContent()).trim() === "En ligne" &&
    (await pf.getByTestId("presence-locked").count()) === 0,
);
sql(
  `update public.subscriptions set expires_at = now() - interval '1 minute' where user_id='${id.f}'`,
);
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("presence-locked").waitFor({ timeout: 8000 });
check("Premium expiré : de nouveau réservé", (await pf.getByTestId("presence").count()) === 0);
const small = await login(emails.f, PWD, 320);
await small.goto(`${BASE}/matches/${matchId}`, { waitUntil: "networkidle" });
await small.getByTestId("presence-locked").waitFor({ timeout: 8000 });
check(
  "Petit écran (320 px) : mention visible, sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes et abonnements de test supprimés", cleanup());
finish();
