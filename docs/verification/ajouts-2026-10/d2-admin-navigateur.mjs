// Tâche D2 — Vérifications dans le navigateur de l'administration : tableau de bord (périodes,
// courbe, info-bulle), membres (recherche, filtre, tri, CSV, fiche), journaux, suppression d'un
// compte. Environnement LOCAL uniquement (base de test, compte admin@test.local).
// Usage : source /var/tmp/yona-e2e/env.sh && node docs/verification/ajouts-2026-10/d2-admin-navigateur.mjs
import { createRequire } from "node:module";
const require = createRequire("/var/tmp/yona-e2e/");
const { chromium } = require("playwright-core");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const OUT = "/var/tmp/yona-e2e/shots";
const b = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const ctx = await b.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "fr-FR",
  acceptDownloads: true,
});
const pg = await ctx.newPage();
const errs = [];
pg.on(
  "console",
  (m) =>
    m.type() === "error" && !m.text().includes("ERR_CERT") && errs.push(m.text().slice(0, 200)),
);
pg.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)));
pg.on("response", async (r) => {
  if (r.status() >= 500)
    errs.push(
      `HTTP ${r.status()} ${r.url().slice(0, 120)} ${(await r.text().catch(() => "")).slice(0, 300)}`,
    );
});
const checks = [];
const check = (name, ok, detail = "") => checks.push([ok ? "OK" : "ÉCHEC", name, detail]);
await pg.goto(BASE + "/login", { waitUntil: "networkidle" });
await pg.fill("#email", "admin@test.local");
await pg.fill("#password", "Motdepasse-Test-2026");
await pg.keyboard.press("Enter");
await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
const overflow = () => pg.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
for (const width of [320, 768, 1440]) {
  await pg.setViewportSize({ width, height: width <= 400 ? 780 : width <= 800 ? 1024 : 900 });
  await pg.goto(BASE + "/admin", { waitUntil: "networkidle" });
  await pg.getByTestId("admin-kpis").waitFor({ timeout: 15000 });
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: `${OUT}/d2-tableau-${width}.png`, fullPage: true });
  check(`Tableau de bord ${width} px sans débordement`, !(await overflow()));
  await pg.getByTestId("admin-tab-users").click();
  await pg.getByTestId("admin-members-table").waitFor();
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${OUT}/d2-membres-${width}.png`, fullPage: true });
  check(`Membres ${width} px sans débordement`, !(await overflow()));
  await pg.getByTestId("admin-tab-logs").click();
  await pg.getByTestId("admin-log-table").waitFor();
  await pg.waitForTimeout(600);
  await pg.screenshot({ path: `${OUT}/d2-journaux-${width}.png`, fullPage: true });
  check(`Journaux ${width} px sans débordement`, !(await overflow()));
}
// Période : année, personnalisée
await pg.setViewportSize({ width: 1440, height: 900 });
await pg.goto(BASE + "/admin", { waitUntil: "networkidle" });
await pg.getByTestId("admin-kpis").waitFor();
await pg.getByTestId("admin-period-year").click();
await pg.waitForTimeout(1200);
check(
  "Période « Année » : texte de période affiché",
  (await pg.locator("text=/Du .* au .*/").count()) > 0,
);
await pg.getByTestId("admin-period-custom").click();
await pg.getByTestId("admin-period-from").fill("2026-09-01");
await pg.getByTestId("admin-period-to").fill("2026-09-30");
await pg.waitForTimeout(1500);
const txt = await pg.getByTestId("admin-dashboard").innerText();
check(
  "Période personnalisée : 1er au 30 septembre",
  /1 sept\. 2026/.test(txt) && /1 oct\. 2026/.test(txt),
  txt.slice(0, 160),
);
await pg.getByRole("button", { name: "Connexions", exact: true }).click();
await pg.waitForTimeout(400);
const trend = pg.getByTestId("admin-trend");
const box = await trend.locator(".recharts-surface").boundingBox();
if (box) await pg.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
await pg.waitForTimeout(400);
check(
  "Courbe : info-bulle au survol",
  (await trend.locator(".recharts-tooltip-wrapper").innerText()).length > 0,
);
await trend.screenshot({ path: `${OUT}/d2-courbe-survol.png` });
// Membres : recherche, tri, fiche, historique
await pg.getByTestId("admin-tab-users").click();
await pg.getByTestId("admin-user-search").fill("awa");
await pg.waitForTimeout(1000);
check(
  "Membres : recherche « awa » → 1 ligne",
  (await pg.getByTestId("admin-user-row").count()) === 1,
);
await pg.getByTestId("admin-user-search").fill("");
await pg.waitForTimeout(800);
await pg.getByTestId("admin-user-kind").selectOption("demo");
await pg.waitForTimeout(1000);
const demoRows = await pg.getByTestId("admin-user-row").count();
check(
  "Membres : filtre « profils de démonstration » → 25 par page",
  demoRows === 25,
  String(demoRows),
);
await pg.getByTestId("admin-user-kind").selectOption("real");
await pg.waitForTimeout(800);
await pg.getByRole("button", { name: "Prénom" }).click();
await pg.waitForTimeout(800);
const names = await pg.getByTestId("admin-user-row").locator("td:first-child").allInnerTexts();
check(
  "Membres : tri par prénom (A → Z)",
  names.length > 1 && [...names].sort((a, c) => a.localeCompare(c, "fr")).join() === names.join(),
  names.join(","),
);
const [download] = await Promise.all([
  pg.waitForEvent("download"),
  pg.getByRole("button", { name: "CSV" }).click(),
]);
const csvPath = `${OUT}/membres.csv`;
await download.saveAs(csvPath);
const csv = require("node:fs").readFileSync(csvPath, "utf8");
check(
  "Export CSV des membres (séparateur ;, en-tête en français)",
  csv.startsWith("﻿Identifiant;Prénom;E-mail") && csv.includes("awa@test.local"),
);
await pg.getByTestId("admin-user-search").fill("awa");
await pg.waitForTimeout(900);
await pg.getByTestId("admin-user-row").first().click();
await pg.getByTestId("admin-user-history").waitFor();
await pg.waitForTimeout(600);
await pg.screenshot({ path: `${OUT}/d2-fiche-membre-1440.png`, fullPage: true });
check(
  "Fiche : historique des connexions affiché",
  (await pg.getByTestId("admin-user-history").innerText()).includes("Connexion"),
);
check(
  "Fiche : zone de suppression (raison + SUPPRIMER)",
  (await pg.getByTestId("admin-delete").isDisabled()) === true,
);
// Journaux : filtre par type
await pg.getByTestId("admin-tab-logs").click();
await pg.getByTestId("admin-log-kind").selectOption("login_failed");
await pg.waitForTimeout(900);
const failed = await pg.getByTestId("admin-log-row").allInnerTexts();
check(
  "Journaux : filtre « connexion échouée »",
  failed.length > 0 && failed.every((r) => r.includes("Connexion échouée")),
  String(failed.length),
);
await pg.getByTestId("admin-log-payment_events").click();
await pg.waitForTimeout(900);
check("Journaux : paiements", (await pg.getByTestId("admin-log-row").count()) > 0);
// Suppression d'un compte par l'administration (compte jetable)
const { createClient } = require("@supabase/supabase-js");
const { execFileSync } = require("node:child_process");
const sql = (q) => execFileSync("psql", ["-X", "-At", "-c", q], { encoding: "utf8" }).trim();
const svc = createClient(process.env.SUPABASE_URL, process.env.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: created } = await svc.auth.admin.createUser({
  email: "a-supprimer@test.local",
  password: "Motdepasse-Test-2026",
  email_confirm: true,
  user_metadata: { first_name: "Jetable" },
});
const victim =
  created?.user?.id ?? sql("select id from auth.users where email = 'a-supprimer@test.local'");
await pg.getByTestId("admin-tab-users").click();
await pg.getByRole("button", { name: "← Retour à la liste" }).click();
await pg.getByTestId("admin-user-search").fill("a-supprimer");
await pg.waitForTimeout(1000);
await pg.getByTestId("admin-user-row").first().click();
await pg.getByTestId("admin-delete-section").waitFor();
await pg.getByTestId("admin-delete-reason").fill("Demande du membre (RGPD)");
await pg.getByTestId("admin-delete-confirmation").fill("supprimer");
await pg.getByTestId("admin-delete").click();
for (let i = 0; i < 40 && sql(`select count(*) from auth.users where id='${victim}'`) !== "0"; i++)
  await pg.waitForTimeout(250);
check(
  "Suppression d'un compte par l'admin",
  sql(`select count(*) from auth.users where id='${victim}'`) === "0",
);
check(
  "Suppression tracée dans l'audit avec la raison",
  sql(
    `select changes->>'reason' from public.admin_audit_log where action='delete_account' and target_id='${victim}'`,
  ) === "Demande du membre (RGPD)",
);
await pg.waitForTimeout(600);
check(
  "Retour à la liste après suppression",
  (await pg.getByTestId("admin-members-table").count()) === 1,
);
check("Aucune erreur JavaScript", errs.length === 0, errs.join(" | "));
for (const c of checks) console.log(c.join(" | "));
console.log(
  `${checks.filter((c) => c[0] === "OK").length} / ${checks.length} vérifications réussies`,
);
await b.close();
