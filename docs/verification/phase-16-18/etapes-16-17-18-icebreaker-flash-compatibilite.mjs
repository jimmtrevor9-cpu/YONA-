// YONA — Phases 16, 17 et 18 — Ice Breaker, Message Flash, compatibilité.
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-16-18/etapes-16-17-18-icebreaker-flash-compatibilite.mjs
// L'application doit tourner avec AI_PROVIDER=test (réponse IA simulée, sans clé).
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
const { id, emails, PWD, cleanup } = createAccounts("c16", {
  f: ["female", "Icefree"],
  p: ["male", "Iceprem"],
  a: ["female", "Iceamie"],
  z: ["female", "Icezoe"],
});
const tok = {};
for (const u of Object.keys(id)) tok[u] = await tokenOf(emails[u], PWD);
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.p}','premium_monthly','active', now() - interval '1 day', now() + interval '30 days')`,
);
const faith = (u, denom, values) =>
  sql(`insert into public.christian_profiles (user_id, denomination, faith_importance, church_attendance, prayer_practice, christian_values)
       values ('${id[u]}', '${denom}', 'Essentielle', 'Chaque semaine', 'Tous les jours', array[${values.map((v) => `'${v}'`).join(",")}])
       on conflict (user_id) do update set denomination=excluded.denomination, faith_importance=excluded.faith_importance,
       church_attendance=excluded.church_attendance, prayer_practice=excluded.prayer_practice, christian_values=excluded.christian_values`);
faith("p", "Évangélique", ["Fidélité", "Honnêteté"]);
faith("a", "Évangélique", ["Fidélité", "Honnêteté"]);
faith("f", "Évangélique", ["Fidélité"]);
faith("z", "Catholique", ["Patience"]);
sql(
  `update public.profiles set interests = array['Musique','Lecture'] where user_id in ('${id.p}','${id.a}')`,
);

// ---------- Phase 17 — Message Flash ----------
let r = await rest(tok.f, "rpc/send_contact_request", "POST", {
  _receiver_id: id.z,
  _message: "Bonjour",
  _flash: true,
});
check("17.2 : Flash refusé à un membre gratuit", r.text.includes("flash_premium_required"));
r = await rest(tok.p, "rpc/send_contact_request", "POST", { _receiver_id: id.z, _flash: true });
check("17.3 : Flash sans message refusé", r.text.includes("flash_message_required"));
r = await rest(tok.f, "rpc/send_contact_request", "POST", {
  _receiver_id: id.z,
  _message: "Salut",
});
check("Demande normale d'un gratuit : acceptée", r.status === 200, r.text.slice(0, 80));
r = await rest(tok.p, "rpc/send_contact_request", "POST", {
  _receiver_id: id.z,
  _message: "Bonjour Zoé, votre profil m'a touché.",
  _flash: true,
});
check("17.1 : Flash d'un Premium avec message : accepté", r.status === 200, r.text.slice(0, 80));
r = await rest(tok.z, "rpc/list_contact_requests", "POST", { _direction: "received" });
check(
  "17.4 : le Flash est en tête des demandes reçues",
  r.json?.[0]?.is_flash === true && r.json?.[1]?.is_flash === false,
  JSON.stringify(r.json?.map((x) => x.is_flash)),
);

// ---------- Phase 18 — Compatibilité ----------
match(id, "p", "a");
match(id, "p", "z");
match(id, "f", "a");
const ra = await rest(tok.p, "rpc/get_compatibility", "POST", { _other: id.a });
const rz = await rest(tok.p, "rpc/get_compatibility", "POST", { _other: id.z });
check(
  "18.1 : score entre 0 et 100 avec un niveau et un résumé",
  ra.json?.score >= 0 && ra.json?.score <= 100 && !!ra.json?.level && !!ra.json?.summary,
  JSON.stringify({ score: ra.json?.score, level: ra.json?.level }),
);
check(
  "18.2 : profils proches → score plus haut que profils éloignés",
  ra.json?.score > rz.json?.score,
  `${ra.json?.score} > ${rz.json?.score}`,
);
check(
  "18.3 : Premium → détail des critères",
  Array.isArray(ra.json?.details) && ra.json.details.length > 0,
);
const rf = await rest(tok.f, "rpc/get_compatibility", "POST", { _other: id.a });
check(
  "18.3 : gratuit → score sans le détail",
  typeof rf.json?.score === "number" && !rf.json?.details,
  JSON.stringify(rf.json).slice(0, 80),
);
const same = await rest(tok.a, "rpc/get_compatibility", "POST", { _other: id.p });
check("Le score est le même dans les deux sens", same.json?.score === ra.json?.score);
sql(`insert into public.blocks (blocker_id, blocked_id) values ('${id.z}','${id.p}')`);
const blocked = await rest(tok.p, "rpc/get_compatibility", "POST", { _other: id.z });
check("Profil bloqué : pas de score", blocked.status >= 400, `${blocked.status}`);
const batch = await rest(tok.p, "rpc/get_compatibility_scores", "POST", {
  _user_ids: [id.a, id.z],
});
check(
  "Scores en lot : seulement les profils visibles",
  Array.isArray(batch.json) && batch.json.length === 1,
  JSON.stringify(batch.json).slice(0, 100),
);

// ---------- Phase 16 — Ice Breaker (dans le navigateur) ----------
const convPA = sql(
  `select c.id from public.conversations c where c.user_1_id=least('${id.p}'::uuid,'${id.a}'::uuid) and c.user_2_id=greatest('${id.p}'::uuid,'${id.a}'::uuid)`,
);
const convFA = sql(
  `select c.id from public.conversations c where c.user_1_id=least('${id.f}'::uuid,'${id.a}'::uuid) and c.user_2_id=greatest('${id.f}'::uuid,'${id.a}'::uuid)`,
);
const { browser, jsErrors, login } = await openBrowser();
const pp = await login(emails.p, PWD);
await pp.goto(`${BASE}/messages/${convPA}`, { waitUntil: "networkidle" });
await pp.getByTestId("icebreaker-open").click();
await pp.waitForTimeout(300);
const sugg = pp.getByTestId("icebreaker-suggestion");
check("16.1 : des idées de premier message s'affichent", (await sugg.count()) >= 3);
const firstText = ((await sugg.first().textContent()) ?? "").trim();
await sugg.first().click();
const draft = await pp.locator("textarea").first().inputValue();
check(
  "16.2 : une idée se place dans la zone de message",
  draft.length > 0 && draft.includes(firstText.slice(0, 10)),
);
await pp.locator("textarea").first().fill("");
await pp.getByTestId("icebreaker-open").click();
await pp.getByTestId("icebreaker-personal").click();
for (let i = 0; i < 50; i++) {
  if ((await pp.locator("textarea").first().inputValue()).includes("Bonjour Iceamie")) break;
  await pp.waitForTimeout(200);
}
check(
  "16.3 : idée personnalisée par l'IA (Premium)",
  (await pp.locator("textarea").first().inputValue()).includes("Iceamie"),
);
const used = sql(
  `select count(*) from public.ai_usage where user_id='${id.p}' and feature='ice_breaker'`,
);
check("16.4 : l'utilisation de l'IA est comptée", Number(used) >= 1, used);
const fp = await login(emails.f, PWD);
await fp.goto(`${BASE}/messages/${convFA}`, { waitUntil: "networkidle" });
await fp.getByTestId("icebreaker-open").click();
await fp.waitForTimeout(300);
check(
  "16.5 : gratuit → idées simples, IA réservée au Premium",
  (await fp.getByTestId("icebreaker-suggestion").count()) >= 3 &&
    (await fp.getByTestId("icebreaker-locked").count()) === 1 &&
    (await fp.getByTestId("icebreaker-personal").count()) === 0,
);
// Compatibilité affichée sur le profil du Match.
const mPA = sql(
  `select id from public.matches where user_1_id=least('${id.p}'::uuid,'${id.a}'::uuid) and user_2_id=greatest('${id.p}'::uuid,'${id.a}'::uuid)`,
);
await pp.goto(`${BASE}/matches/${mPA}`, { waitUntil: "networkidle" });
await pp.waitForTimeout(600);
check(
  "18.4 : score et détail affichés sur le profil (Premium)",
  (await pp.getByTestId("compatibility-score").count()) === 1 &&
    (await pp.getByTestId("compatibility-details").count()) === 1,
);
await fp.goto(
  `${BASE}/matches/${sql(`select id from public.matches where user_1_id=least('${id.f}'::uuid,'${id.a}'::uuid) and user_2_id=greatest('${id.f}'::uuid,'${id.a}'::uuid)`)}`,
  { waitUntil: "networkidle" },
);
await fp.waitForTimeout(600);
check(
  "18.4 : gratuit → score affiché, détail verrouillé",
  (await fp.getByTestId("compatibility-score").count()) === 1 &&
    (await fp.getByTestId("compatibility-locked").count()) === 1,
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
