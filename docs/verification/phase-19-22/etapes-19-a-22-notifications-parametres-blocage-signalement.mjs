// YONA — Phases 19 à 22 — Notifications, paramètres, blocage, signalement.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-19-22/etapes-19-a-22-notifications-parametres-blocage-signalement.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("c19", {
  f: ["female", "Notifree"],
  p: ["male", "Notiprem"],
  a: ["male", "Notiami"],
  b: ["male", "Notibloq"],
  s: ["male", "Notisettings"],
  d: ["female", "Notidelete"],
});
const tok = {};
for (const u of Object.keys(id)) tok[u] = await tokenOf(emails[u], PWD);
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.p}','premium_monthly','active', now() - interval '1 day', now() + interval '30 days')`,
);
const notifs = async (u) => (await rest(tok[u], "rpc/list_notifications", "POST", {})).json ?? [];
const unread = async (u) =>
  (await rest(tok[u], "rpc/get_unread_notification_count", "POST", {})).json;
const convOf = (x, y) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );

// ---------- Phase 19 — Notifications ----------
await rest(tok.a, "likes", "POST", { sender_id: id.a, receiver_id: id.f });
let n = await notifs("f");
check(
  "19.1 : Like reçu → notification",
  n.some((x) => x.type === "like" && x.actor_id === id.a),
);
await rest(tok.f, "likes", "POST", { sender_id: id.f, receiver_id: id.a });
n = await notifs("f");
const na = await notifs("a");
check(
  "19.2 : Match → notification pour les deux",
  n.some((x) => x.type === "match") && na.some((x) => x.type === "match"),
);
const conv = convOf("f", "a");
for (const t of ["Bonjour", "Comment vas-tu ?"])
  await rest(tok.a, "rpc/send_message", "POST", { _conversation_id: conv, _content: t });
n = await notifs("f");
check(
  "19.3 : messages → une seule notification par conversation (regroupées)",
  n.filter((x) => x.type === "message").length === 1,
);
await rest(tok.a, "favorites", "POST", { user_id: id.a, favorite_user_id: id.f });
await rest(tok.a, "rpc/record_profile_visit", "POST", { _visited_user_id: id.f });
n = await notifs("f");
const fav = n.find((x) => x.type === "favorite");
const visit = n.find((x) => x.type === "visit");
check(
  "19.5 / 19.6 : favori et visite → notifiés, auteur masqué pour un gratuit",
  !!fav && !!visit && fav.actor_id === null && visit.actor_id === null,
);
await rest(tok.a, "favorites", "POST", { user_id: id.a, favorite_user_id: id.p });
const np = await notifs("p");
check(
  "Premium : l'auteur du favori est visible",
  np.some((x) => x.type === "favorite" && x.actor_id === id.a),
);
await rest(tok.a, "rpc/send_contact_request", "POST", { _receiver_id: id.p, _message: "Bonjour" });
check(
  "19.7 : demande de contact → notification",
  (await notifs("p")).some((x) => x.type === "contact_request"),
);
const count = await unread("f");
check("19.8 : compteur de non lues", count === n.length, `${count} / ${n.length}`);
await rest(tok.f, "rpc/mark_notification_read", "POST", { _id: n[0].id });
check("19.9 : marquer une notification comme lue", (await unread("f")) === count - 1);
const other = await rest(tok.a, "rpc/mark_notification_read", "POST", { _id: n[1].id });
check("Impossible de lire les notifications d'un autre", other.json === false);
let r = await rest(tok.a, "notifications", "POST", { user_id: id.f, type: "like" });
check("Écriture directe dans les notifications : refusée", r.status >= 400, `${r.status}`);
r = await rest(tok.a, `notifications?user_id=eq.${id.f}`, "GET");
check("Lecture des notifications d'un autre : rien", Array.isArray(r.json) && r.json.length === 0);

// ---------- Phase 20 — Paramètres ----------
await rest(tok.s, "user_settings", "POST", {
  user_id: id.s,
  notify_likes: false,
  activity_visible: false,
});
await rest(tok.a, "likes", "POST", { sender_id: id.a, receiver_id: id.s });
check(
  "20.5 : Likes désactivés → pas de notification de Like",
  !(await notifs("s")).some((x) => x.type === "like"),
);
sql(`insert into public.user_activity (user_id, is_online, last_seen_at) values ('${id.s}', true, now())
     on conflict (user_id) do update set is_online = true, last_seen_at = now()`);
r = await rest(tok.p, "rpc/get_presence", "POST", { _user_id: id.s });
check("20.3 : activité masquée → présence inconnue", r.json === "unknown", JSON.stringify(r.json));
r = await rest(tok.a, "user_settings", "POST", { user_id: id.s, notify_likes: true });
check("Modifier les réglages d'un autre : refusé", r.status >= 400, `${r.status}`);

// ---------- Phase 21 — Blocage ----------
match(id, "p", "b");
const convPB = convOf("p", "b");
await rest(tok.b, "rpc/send_contact_request", "POST", { _receiver_id: id.a, _message: "Salut" });
await rest(tok.p, "favorites", "POST", { user_id: id.p, favorite_user_id: id.b });
r = await rest(tok.p, "rpc/block_user", "POST", { _user_id: id.b });
check("21.1 : bloquer un membre", r.json === true, r.text.slice(0, 80));
check(
  "21.2 : Match et conversation fermés, favori retiré",
  sql(
    `select status from public.matches where user_1_id=least('${id.p}'::uuid,'${id.b}'::uuid) and user_2_id=greatest('${id.p}'::uuid,'${id.b}'::uuid)`,
  ) === "blocked" &&
    sql(`select status from public.conversations where id='${convPB}'`) === "closed" &&
    sql(
      `select count(*) from public.favorites where user_id='${id.p}' and favorite_user_id='${id.b}'`,
    ) === "0",
);
r = await rest(tok.b, "rpc/send_message", "POST", { _conversation_id: convPB, _content: "Coucou" });
check("21.5 : message refusé après blocage", r.status >= 400, r.text.slice(0, 60));
r = await rest(tok.b, "likes", "POST", { sender_id: id.b, receiver_id: id.p });
check("21.4 : Like refusé entre membres bloqués", r.status >= 400);
r = await rest(tok.b, "favorites", "POST", { user_id: id.b, favorite_user_id: id.p });
check("21.4 : favori refusé entre membres bloqués", r.status >= 400);
r = await rest(tok.b, "rpc/record_profile_visit", "POST", { _visited_user_id: id.p });
check(
  "21.4 : visite non enregistrée entre membres bloqués",
  sql(
    `select count(*) from public.profile_visits where visitor_id='${id.b}' and visited_user_id='${id.p}'`,
  ) === "0",
);
r = await rest(tok.p, "rpc/list_blocked_users", "POST", {});
check("21.3 : liste des membres bloqués", r.json?.length === 1 && r.json[0].user_id === id.b);
r = await rest(tok.p, "rpc/block_user", "POST", { _user_id: id.p });
check("Se bloquer soi-même : refusé", r.text.includes("invalid_target"));

// ---------- Phase 22 — Signalement ----------
const msgId = sql(
  `select id from public.messages where conversation_id='${conv}' and sender_id='${id.a}' limit 1`,
);
r = await rest(tok.f, "rpc/report_user", "POST", {
  _user_id: id.a,
  _reason: "harassment",
  _description: "Messages insistants",
  _message_id: msgId,
});
check(
  "22.2 : signaler un message",
  r.status === 200 && typeof r.json === "string",
  r.text.slice(0, 80),
);
const again = await rest(tok.f, "rpc/report_user", "POST", {
  _user_id: id.a,
  _reason: "harassment",
  _message_id: msgId,
});
check("22.4 : même signalement ouvert → pas de doublon", again.json === r.json);
r = await rest(tok.f, "rpc/report_user", "POST", { _user_id: id.a, _reason: "fake_profile" });
check("22.1 : signaler un profil", r.status === 200, r.text.slice(0, 80));
r = await rest(tok.f, "rpc/report_user", "POST", { _user_id: id.a, _reason: "pas_un_motif" });
check("Motif hors liste : refusé", r.status >= 400);
r = await rest(tok.f, "rpc/report_user", "POST", {
  _user_id: id.a,
  _reason: "other",
  _description: "x".repeat(2001),
});
check("Description trop longue : refusée", r.text.includes("description_too_long"));
const myMsg = sql(
  `select id from public.messages where conversation_id='${conv}' and sender_id='${id.a}' limit 1`,
);
r = await rest(tok.p, "rpc/report_user", "POST", {
  _user_id: id.a,
  _reason: "scam",
  _message_id: myMsg,
});
check(
  "Message d'une conversation dont on ne fait pas partie : refusé",
  r.text.includes("invalid_message"),
);
r = await rest(tok.f, "reports", "POST", {
  reporter_id: id.f,
  reported_user_id: id.a,
  reason: "scam",
});
check("Écriture directe dans les signalements : refusée", r.status >= 400);
for (const u of ["b", "s", "d", "p"]) {
  if (u === "p") continue;
  await rest(tok.f, "rpc/report_user", "POST", { _user_id: id[u], _reason: "other" });
}
sql(
  `insert into public.reports (reporter_id, reported_user_id, reason, status) select '${id.f}', '${id.a}', 'other', 'dismissed' from generate_series(1,5)`,
);
r = await rest(tok.f, "rpc/report_user", "POST", { _user_id: id.p, _reason: "other" });
check(
  "22.5 : limite de 10 signalements par jour",
  r.text.includes("report_daily_limit"),
  r.text.slice(0, 80),
);

// Signalements de remplissage retirés pour laisser la place au test dans l'interface.
sql(`delete from public.reports where reporter_id='${id.f}' and status='dismissed'`);
// Signalements précédents traités : un signalement encore ouvert sur le même message ne
// serait pas dupliqué (règle 22.4).
sql(`update public.reports set status='resolved' where reporter_id='${id.f}'`);

// ---------- Interface ----------
const { browser, jsErrors, login } = await openBrowser();
const fp = await login(emails.f, PWD);
await fp.waitForTimeout(800);
const badge = (
  (await fp
    .getByTestId("notifications-unread")
    .textContent()
    .catch(() => "")) ?? ""
).trim();
check("Cloche : nombre de non lues affiché", badge === String(await unread("f")), badge);
await fp.goto(`${BASE}/notifications`, { waitUntil: "networkidle" });
await fp.waitForTimeout(500);
check(
  "Page Notifications : liste affichée",
  (await fp.getByTestId("notification-item").count()) === n.length,
);
await fp.getByRole("button", { name: "Tout marquer comme lu" }).click();
await fp.waitForTimeout(800);
check(
  "Tout marquer comme lu",
  (await unread("f")) === 0 && (await fp.locator('[data-read="false"]').count()) === 0,
);

await fp.goto(`${BASE}/messages/${conv}`, { waitUntil: "networkidle" });
await fp.waitForTimeout(500);
await fp.getByTestId("report-message").first().click();
await fp.getByLabel("Comportement suspect").check();
await fp.getByTestId("report-submit").click();
for (
  let i = 0;
  i < 40 &&
  sql(
    `select count(*) from public.reports where reporter_id='${id.f}' and reason='suspicious_behavior'`,
  ) === "0";
  i++
)
  await fp.waitForTimeout(100);
check(
  "Signaler un message depuis la conversation",
  sql(
    `select count(*) from public.reports where reporter_id='${id.f}' and reason='suspicious_behavior' and message_id is not null`,
  ) === "1",
);
await fp.getByTestId("block-open").click();
await fp.getByTestId("block-confirm").click();
await fp.waitForURL(/\/matches$/, { timeout: 8000 }).catch(() => {});
check(
  "Bloquer depuis la conversation → retour aux Matchs",
  fp.url().endsWith("/matches") &&
    sql(
      `select count(*) from public.blocks where blocker_id='${id.f}' and blocked_id='${id.a}'`,
    ) === "1",
);
await fp.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await fp.waitForTimeout(500);
check(
  "Paramètres : membre bloqué listé",
  (await fp.getByTestId("blocked-list").locator("li").count()) === 1,
);
await fp.getByRole("button", { name: "Débloquer" }).click();
await fp.waitForTimeout(800);
check(
  "Débloquer depuis les Paramètres",
  sql(`select count(*) from public.blocks where blocker_id='${id.f}'`) === "0",
);
await fp.getByTestId("setting-notify-matches").click();
await fp.waitForTimeout(800);
check(
  "Réglage enregistré (Nouveaux Matchs désactivé)",
  sql(`select notify_matches from public.user_settings where user_id='${id.f}'`) === "f",
);
await fp.getByTestId("setting-profile-visible").click();
await fp.waitForTimeout(800);
check(
  "Profil masqué depuis les Paramètres",
  sql(`select visibility from public.profiles where user_id='${id.f}'`) === "hidden",
);

const dp = await login(emails.d, PWD, 320);
await dp.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
await dp.waitForTimeout(500);
check(
  "Petit écran (320 px) : Paramètres sans débordement",
  !(await dp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
await dp.getByTestId("delete-account-open").click();
await dp.fill("#delete-word", "SUPPRIMER");
await dp.fill("#delete-password", "mauvais");
await dp.getByRole("button", { name: /Supprimer définitivement/ }).click();
await dp.waitForTimeout(1500);
check(
  "Suppression : mauvais mot de passe refusé",
  sql(`select count(*) from auth.users where id='${id.d}'`) === "1",
);
await dp.fill("#delete-password", PWD);
await dp.getByRole("button", { name: /Supprimer définitivement/ }).click();
for (let i = 0; i < 50 && sql(`select count(*) from auth.users where id='${id.d}'`) !== "0"; i++)
  await dp.waitForTimeout(200);
check(
  "20.9 : compte supprimé avec toutes ses données",
  sql(`select count(*) from auth.users where id='${id.d}'`) === "0" &&
    sql(`select count(*) from public.profiles where user_id='${id.d}'`) === "0",
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
