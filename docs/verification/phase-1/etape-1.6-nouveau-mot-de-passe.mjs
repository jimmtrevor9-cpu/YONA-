// YONA — Phase 1 / Étape 1.6 — Vérification de la page « Nouveau mot de passe »
// (/reset-password) dans Chromium, à partir de vrais liens reçus dans Mailpit.
// Prérequis : Supabase local (max_frequency 60 s), Mailpit :54324, application servie
// sur BASE (outils/demarrer-test-local.sh). Compte de TEST supprimé à la fin.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.6-nouveau-mot-de-passe.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const MAILPIT = process.env.MAILPIT ?? "http://127.0.0.1:54324";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};
// Nettoie les comptes laissés par une exécution interrompue.
sql("delete from auth.users where email like 'test-nouveau-mdp-%@example.test';");
const email = `test-nouveau-mdp-${Date.now()}@example.test`;
const OLD = "TestAncien!2026";
const NEW = "TestNouveau!2026";
sql(
  `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${email}',crypt('${OLD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','');`,
);

async function freshLink() {
  const before = Date.now();
  await fetch(
    `${API}/auth/v1/recover?redirect_to=${encodeURIComponent(`${BASE}/reset-password`)}`,
    {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );
  for (let i = 0; i < 20; i++) {
    const list = await (
      await fetch(`${MAILPIT}/api/v1/search?query=to:${encodeURIComponent(email)}`)
    ).json();
    const msg = list.messages?.find((m) => new Date(m.Created).getTime() >= before - 2000);
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      return (full.HTML || full.Text)
        .match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]
        ?.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const browser = await chromium.launch();
const jsErrors = [];
async function openLink(link, width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 844 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(link, { waitUntil: "networkidle" });
  await page.waitForURL(/\/reset-password/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  return page;
}
async function submit(page, pwd, confirm = pwd) {
  await clearToasts(page);
  await page.fill("#password", pwd);
  await page.fill("#confirm", confirm);
  await page.click("button[type=submit]");
}
// Notifications : on attend que les précédentes aient disparu avant chaque action, puis
// on lit la plus récente (sans toucher au DOM géré par React).
const clearToasts = async (page) => {
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++) {
    await page.waitForTimeout(100);
  }
};
const toast = async (page) => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 60 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
};
const loginWorks = async (pwd) =>
  (
    await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: KEY, "content-type": "application/json" },
      body: JSON.stringify({ email, password: pwd }),
    })
  ).status === 200;

// ---------- A. Lien valide ----------
const link1 = await freshLink();
check("Lien de réinitialisation obtenu", !!link1);
let page = await openLink(link1);
check(
  "Lien → page « Nouveau mot de passe » qui reconnaît le lien",
  await page.getByText("Choisissez un mot de passe solide").isVisible(),
);
const f = await page.evaluate(() =>
  ["password", "confirm"].map((id) => {
    const i = document.querySelector(`#${id}`);
    return `${i?.type}/${i?.autocomplete}/${i?.required}/${i?.minLength}`;
  }),
);
check(
  "Deux champs masqués, « new-password », obligatoires, 8 caractères min.",
  f.every((x) => x === "password/new-password/true/8"),
  f.join(" "),
);

await submit(page, "TestA!2026x", "TestB!2026x");
let t = await toast(page);
check(
  "Confirmation différente → « Les deux mots de passe ne correspondent pas. »",
  t.includes("ne correspondent pas"),
  t,
);
await page.evaluate(() =>
  document.querySelectorAll("input").forEach((i) => i.removeAttribute("minlength")),
);
await submit(page, "Court1!");
t = await toast(page);
check("7 caractères → « au moins 8 caractères »", t.includes("au moins 8 caractères"), t);
await submit(page, OLD);
t = await toast(page);
check("Ancien mot de passe réutilisé → message clair", t.includes("différent de l'ancien"), t);

let calls = 0;
page.on("request", (r) => r.url().includes("/auth/v1/user") && r.method() === "PUT" && calls++);
await page.route("**/auth/v1/user", async (route) => {
  if (route.request().method() === "PUT") await new Promise((r) => setTimeout(r, 700));
  await route.continue();
});
await clearToasts(page);
await page.fill("#password", NEW);
await page.fill("#confirm", NEW);
await page.click("button[type=submit]");
const label = await page.locator("button[type=submit]").textContent();
const disabled = await page.locator("button[type=submit]").isDisabled();
await page.click("button[type=submit]", { force: true, timeout: 1000 }).catch(() => {});
await page.waitForURL(/\/discover$/, { timeout: 8000 }).catch(() => {});
check(
  "Pendant l'enregistrement : « Mise à jour… » désactivé ; double clic → 1 requête",
  label.includes("Mise à jour") && disabled && calls === 1,
  `${label} / ${disabled} / ${calls}`,
);
check(
  "Succès → « Mot de passe mis à jour. » et arrivée sur /discover",
  page.url().endsWith("/discover") && (await toast(page)).includes("Mot de passe mis à jour"),
  page.url(),
);
check(
  "Connexion : nouveau mot de passe accepté, ancien refusé",
  (await loginWorks(NEW)) && !(await loginWorks(OLD)),
);
await page.context().close();

// ---------- B. Lien déjà utilisé ----------
page = await openLink(link1);
const body = (await page.locator("body").textContent()) ?? "";
check(
  "Lien déjà utilisé → la page indique que le lien n'est plus valable",
  /expiré|n'est plus valable|déjà été utilisé/i.test(body),
  body.includes("Ouvrez cette page depuis le lien")
    ? "affiche « Ouvrez cette page depuis le lien reçu par email. »"
    : "",
);
await submit(page, "TestAutre!2026");
t = await toast(page);
check(
  "Lien déjà utilisé → envoi refusé avec un message clair",
  !t.includes("Une erreur est survenue") && t.length > 0,
  t,
);
await page.context().close();

// ---------- C. Accès direct sans lien ----------
page = await openLink(`${BASE}/reset-password`);
check(
  "Accès direct sans lien → « Ouvrez cette page depuis le lien reçu par email. »",
  await page.getByText("Ouvrez cette page depuis le lien reçu par email.").isVisible(),
);
await submit(page, "TestAutre!2026");
t = await toast(page);
check(
  "Accès direct → envoi refusé avec un message clair",
  !t.includes("Une erreur est survenue") && t.length > 0,
  t,
);
check("Accès direct → mot de passe inchangé", await loginWorks(NEW));
check(
  "320 px : pas de défilement horizontal",
  await (
    await openLink(`${BASE}/reset-password`, 320)
  ).evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
);
await page.getByRole("link", { name: "Retour à la connexion" }).click();
await page.waitForURL(/\/login$/, { timeout: 5000 }).catch(() => {});
check("Lien « Retour à la connexion » → /login", page.url().endsWith("/login"));

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
sql(`delete from auth.users where email = '${email}';`);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
