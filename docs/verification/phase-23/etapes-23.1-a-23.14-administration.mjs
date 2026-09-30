// YONA — Phase 23 — Administration (/admin).
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-23/etapes-23.1-a-23.14-administration.mjs
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
const { id, emails, PWD, cleanup } = createAccounts("c23", {
  admin: ["female", "Adminne"],
  admin2: ["male", "Adminbis"],
  u: ["male", "Membreun"],
  v: ["female", "Membredeux"],
});
sql(
  `insert into public.user_roles (user_id, role) values ('${id.admin}','admin'), ('${id.admin2}','admin')`,
);
const tok = {};
for (const k of Object.keys(id)) tok[k] = await tokenOf(emails[k], PWD);

// ---------- Protection côté base ----------
const adminFns = [
  ["admin_stats", {}],
  ["admin_list_users", {}],
  ["admin_user_detail", { _user_id: id.v }],
  ["admin_list_reports", {}],
  ["admin_list_pending_photos", {}],
  ["admin_list_payments", {}],
  ["admin_list_subscriptions", {}],
  ["admin_list_unlocks", {}],
  ["admin_list_support_tickets", {}],
];
let refused = 0;
for (const [fn, body] of adminFns) {
  const r = await rest(tok.u, `rpc/${fn}`, "POST", body);
  if (r.status >= 400 && r.text.includes("admin_required")) refused++;
}
check(
  "23.2 : toutes les lectures admin refusées à un membre",
  refused === adminFns.length,
  `${refused}/${adminFns.length}`,
);
let r = await rest(null, "rpc/admin_stats", "POST", {});
check("Visiteur non connecté : refusé", r.status >= 400);
r = await rest(tok.u, "rpc/admin_set_user_status", "POST", {
  _user_id: id.v,
  _action: "ban",
  _reason: "x",
});
check("Un membre ne peut pas bannir", r.text.includes("admin_required"));

// ---------- Tableau de bord et membres ----------
r = await rest(tok.admin, "rpc/admin_stats", "POST", {});
check(
  "23.3 : chiffres du tableau de bord",
  r.json?.users_total >= 4 && "revenue_cents" in (r.json ?? {}),
  JSON.stringify(r.json).slice(0, 80),
);
r = await rest(tok.admin, "rpc/admin_list_users", "POST", { _search: "Membredeux" });
check("23.5 : recherche d'un membre par prénom", r.json?.length === 1 && r.json[0].id === id.v);
r = await rest(tok.admin, "rpc/admin_user_detail", "POST", { _user_id: id.v });
check(
  "23.6 : fiche détaillée d'un membre",
  r.json?.user?.id === id.v && typeof r.json?.counts === "object",
);
r = await rest(tok.admin, "rpc/admin_set_user_status", "POST", {
  _user_id: id.v,
  _action: "suspend",
});
check("Suspendre sans raison : refusé", r.text.includes("reason_required"));
r = await rest(tok.admin, "rpc/admin_set_user_status", "POST", {
  _user_id: id.admin2,
  _action: "ban",
  _reason: "test",
});
check("Impossible de modérer un autre admin", r.text.includes("cannot_moderate_admin"));
r = await rest(tok.admin, "rpc/admin_set_user_status", "POST", {
  _user_id: id.admin,
  _action: "ban",
  _reason: "test",
});
check("Impossible de se modérer soi-même", r.text.includes("cannot_moderate_admin"));

// ---------- Signalements, photos, paiements, support ----------
await rest(tok.u, "rpc/report_user", "POST", {
  _user_id: id.v,
  _reason: "fake_profile",
  _description: "Photos volées",
});
r = await rest(tok.admin, "rpc/admin_list_reports", "POST", { _status: "open" });
const rep = r.json?.find((x) => x.reported_user_id === id.v);
check("23.10 : signalement visible par l'admin", !!rep && rep.reporter_name === "Membreun");
r = await rest(tok.admin, "rpc/admin_resolve_report", "POST", {
  _report_id: rep?.id,
  _status: "resolved",
  _note: "Profil vérifié",
});
check(
  "23.11 : signalement traité et tracé",
  r.status < 300 &&
    sql(`select status from public.reports where id='${rep?.id}'`) === "resolved" &&
    Number(sql(`select count(*) from public.moderation_actions where admin_id='${id.admin}'`)) >= 1,
  r.text.slice(0, 80),
);
const photo = sql(
  `insert into public.photos (user_id, storage_path, status) values ('${id.v}', '${id.v}/t23.jpg', 'pending') returning id`,
);
r = await rest(tok.admin, "rpc/admin_list_pending_photos", "POST", {});
check(
  "Photos en attente listées",
  r.json?.some((x) => x.id === photo),
);
r = await rest(tok.admin, "rpc/admin_moderate_photo", "POST", { _photo_id: photo, _approve: true });
check(
  "Photo validée",
  sql(`select status from public.photos where id='${photo}'`) === "approved",
  r.text.slice(0, 60),
);
sql(
  `insert into public.payments (user_id, type, amount, currency, provider, status) values ('${id.u}', 'subscription', 999, 'EUR', 'test', 'succeeded')`,
);
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.u}','premium_monthly','active', now(), now() + interval '30 days')`,
);
const p1 = await rest(tok.admin, "rpc/admin_list_payments", "POST", {});
const s1 = await rest(tok.admin, "rpc/admin_list_subscriptions", "POST", {});
const u1 = await rest(tok.admin, "rpc/admin_list_unlocks", "POST", {});
check(
  "23.12 à 23.14 : paiements, abonnements et déblocages",
  p1.json?.some((x) => x.user_id === id.u && x.amount === 999) &&
    s1.json?.some((x) => x.user_id === id.u && x.active_now) &&
    Array.isArray(u1.json),
);
await rest(tok.u, "rpc/create_support_ticket", "POST", {
  _subject: "Problème de photo",
  _message: "Ma photo ne s'affiche pas.",
});
r = await rest(tok.admin, "rpc/admin_list_support_tickets", "POST", {});
const ticket = r.json?.find((x) => x.user_id === id.u);
r = await rest(tok.admin, "rpc/admin_reply_support_ticket", "POST", {
  _ticket_id: ticket?.id,
  _reply: "C'est corrigé.",
});
check(
  "Support : réponse de l'admin enregistrée",
  sql(
    `select status || '|' || admin_reply from public.support_tickets where id='${ticket?.id}'`,
  ) === "answered|C'est corrigé.",
  r.text.slice(0, 60),
);

// ---------- Interface ----------
const { browser, jsErrors, login } = await openBrowser();
const up = await login(emails.v, PWD);
await up.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await up.waitForTimeout(800);
check("23.1 : /admin interdit à un membre (redirection)", !up.url().includes("/admin"));
const ap = await login(emails.admin, PWD);
await ap.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
await ap.waitForTimeout(600);
check(
  "Lien Administration visible pour l'admin",
  (await ap.getByTestId("admin-link").count()) === 1,
);
await ap.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await ap.waitForTimeout(800);
check("Tableau de bord affiché", (await ap.getByTestId("admin-stats").count()) === 1);
await ap.getByTestId("admin-tab-users").click();
await ap.getByTestId("admin-user-search").fill("Membredeux");
await ap.waitForTimeout(800);
await ap.getByTestId("admin-user-row").first().click();
await ap.waitForTimeout(600);
await ap.getByTestId("admin-reason").fill("Faux profil confirmé");
await ap.getByTestId("admin-suspend").click();
for (
  let i = 0;
  i < 40 && sql(`select status from public.users where id='${id.v}'`) !== "suspended";
  i++
)
  await ap.waitForTimeout(200);
await ap.waitForTimeout(500);
check(
  "23.7 : suspendre depuis /admin",
  sql(`select status from public.users where id='${id.v}'`) === "suspended",
);
check("Le membre suspendu ne peut plus se connecter", !(await tokenOf(emails.v, PWD)));
await ap.getByTestId("admin-reactivate").click();
for (
  let i = 0;
  i < 40 && sql(`select status from public.users where id='${id.v}'`) !== "active";
  i++
)
  await ap.waitForTimeout(200);
await ap.waitForTimeout(500);
check(
  "23.8 : réactiver → connexion de nouveau possible",
  sql(`select status from public.users where id='${id.v}'`) === "active" &&
    !!(await tokenOf(emails.v, PWD)),
);
await ap.getByTestId("admin-reason").fill("Arnaque");
await ap.getByTestId("admin-ban").click();
for (
  let i = 0;
  i < 40 && sql(`select status from public.users where id='${id.v}'`) !== "disabled";
  i++
)
  await ap.waitForTimeout(200);
check(
  "23.9 : bannir",
  sql(`select status from public.users where id='${id.v}'`) === "disabled" &&
    !(await tokenOf(emails.v, PWD)),
);
check(
  "Chaque décision est tracée",
  Number(sql(`select count(*) from public.moderation_actions where target_user_id='${id.v}' and action in ('suspend','unsuspend','disable')`)) ===
    3,
);
const small = await login(emails.admin, PWD, 320);
await small.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
await small.waitForTimeout(800);
check(
  "Petit écran (320 px) : /admin sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
