// YONA — Phase 0 / Étape 0.5 — Parcours d'authentification complet dans Chromium.
// Prérequis : Supabase local (confirmation email activée, Mailpit sur :54324),
// application buildée pour ce projet et servie sur BASE (outils/serveur-local.mjs).
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-0/etape-0.5-authentification-e2e.mjs
// Crée un compte de TEST local (domaine example.test) — jamais sur une base réelle.
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";
const email = `test-e2e-${Date.now()}@example.test`;
const pwd1 = "TestE2E!2026a";
const pwd2 = "TestE2E!2026b";
const results = [];

const ok = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

async function lastMailLink(to, subjectPart) {
  for (let i = 0; i < 20; i++) {
    const list = await (
      await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(to)}`)
    ).json();
    const msg = list.messages?.find((m) =>
      subjectPart.split("|").some((part) => m.Subject.toLowerCase().includes(part)),
    );
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      const link = (full.HTML || full.Text).match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1];
      return link?.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return undefined;
}

async function toastText(page) {
  const t = page.locator("[data-sonner-toast]").last();
  await t.waitFor({ timeout: 8000 }).catch(() => {});
  return (await t.textContent().catch(() => ""))?.trim() ?? "";
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`${page.url()} : ${String(e).slice(0, 120)}`));

// 1. Route protégée sans session
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
ok("Route protégée /discover sans session → /login", page.url().endsWith("/login"), page.url());

// 2. Inscription
const signupAt = Date.now();
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await page.fill("#firstName", "TestE2E");
await page.fill("#email", email);
await page.fill("#password", pwd1);
await page.click("button[type=submit]");
await page
  .getByText("Consultez votre boîte mail")
  .waitFor({ timeout: 10000 })
  .catch(() => {});
ok(
  "Inscription → écran « Consultez votre boîte mail »",
  await page.getByText("Consultez votre boîte mail").isVisible(),
);

// 3. Connexion avant confirmation
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", pwd1);
await page.click("button[type=submit]");
let t = await toastText(page);
ok("Connexion avant confirmation refusée (message FR)", t.includes("confirmer votre email"), t);

// 4. Confirmation par email
const confirmLink = await lastMailLink(email, "confirm");
ok("Email de confirmation reçu", !!confirmLink);
await page.goto(confirmLink, { waitUntil: "networkidle" });
await page.waitForURL(/\/discover/, { timeout: 10000 }).catch(() => {});
ok(
  "Lien de confirmation → session ouverte, arrivée sur /discover",
  page.url().includes("/discover"),
  page.url(),
);

// 5. Persistance de session après rechargement
await page.reload({ waitUntil: "networkidle" });
ok("Session conservée après rechargement", page.url().includes("/discover"), page.url());

// 6. Déconnexion
await page.getByRole("button", { name: "Quitter" }).click();
await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
ok("Bouton « Quitter » → /login", page.url().endsWith("/login"), page.url());
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
ok("Après déconnexion, /discover redirige vers /login", page.url().endsWith("/login"), page.url());

// 7. Mauvais mot de passe / compte inexistant
for (const [label, mail, pass] of [
  ["Mauvais mot de passe", email, "Mauvais!2026"],
  ["Compte inexistant", `inconnu-${Date.now()}@example.test`, pwd1],
]) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", mail);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");
  t = await toastText(page);
  ok(
    `${label} → « Email ou mot de passe incorrect. »`,
    t.includes("Email ou mot de passe incorrect"),
    t,
  );
}

// 8. Connexion valide
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", pwd1);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover/, { timeout: 8000 }).catch(() => {});
ok("Connexion valide → /discover", page.url().includes("/discover"), page.url());
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.waitForURL(/\/discover/, { timeout: 5000 }).catch(() => {});
ok("/login déjà connecté → redirection /discover", page.url().includes("/discover"), page.url());
await page.getByRole("button", { name: "Quitter" }).click();
await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});

// 9. Mot de passe oublié → email → nouveau mot de passe
// Supabase n'envoie qu'un email par minute et par compte ([auth.email] max_frequency).
await page.waitForTimeout(Math.max(0, 62_000 - (Date.now() - signupAt)));
await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.click("button[type=submit]");
await page.waitForTimeout(1500);
const resetLink = await lastMailLink(email, "réinitialis|reset");
ok("Email de réinitialisation reçu", !!resetLink);
await page.goto(resetLink, { waitUntil: "networkidle" });
ok("Lien → page /reset-password", page.url().includes("/reset-password"), page.url().split("#")[0]);
const subtitle = await page.locator("body").textContent();
ok(
  "Page reconnaît le lien de récupération",
  subtitle.includes("Choisissez un mot de passe solide"),
  subtitle.includes("Ouvrez cette page depuis le lien")
    ? "affiche « Ouvrez cette page depuis le lien reçu »"
    : "",
);
await page.fill("#password", pwd2);
await page.fill("#confirm", pwd2);
await page.click("button[type=submit]");
await page.waitForURL(/\/discover/, { timeout: 8000 }).catch(() => {});
ok("Nouveau mot de passe enregistré → /discover", page.url().includes("/discover"), page.url());
await page.getByRole("button", { name: "Quitter" }).click();
await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {});
for (const [label, pass, expectOk] of [
  ["Ancien mot de passe refusé", pwd1, false],
  ["Nouveau mot de passe accepté", pwd2, true],
]) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", pass);
  await page.click("button[type=submit]");
  await page.waitForTimeout(2500);
  ok(label, page.url().includes("/discover") === expectOk, page.url());
}

// 10. Membre connecté : chargement direct de chaque page réservée
for (const path of ["/discover", "/onboarding", "/profile", "/search"]) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  ok(`Connecté : chargement direct de ${path}`, page.url().endsWith(path), page.url());
}

// 11. Session devenue invalide (compte supprimé côté serveur) → retour à /login, sans boucle
if (process.env.DELETE_USER_CMD) {
  const { execSync } = await import("node:child_process");
  execSync(process.env.DELETE_USER_CMD.replace("{email}", email));
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/login$/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  ok(
    "Compte supprimé : session refusée, retour stable sur /login",
    page.url().endsWith("/login"),
    page.url(),
  );
}

ok("Aucune erreur JavaScript de page", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
