// YONA — Phase 1 / Étape 1.1 — Vérification de la page d'accueil dans Chromium.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.1-accueil.mjs [BASE] [DOSSIER_CAPTURES]
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.argv[2] ?? "http://127.0.0.1:4173";
const SHOTS = process.argv[3];
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};
const widths = [320, 375, 768, 1024, 1440];
const browser = await chromium.launch();

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Faire défiler pour déclencher toutes les animations d'apparition
  for (let y = 0; y < 12000; y += 600) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(900);
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    wide: [...document.querySelectorAll("main *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .filter((el) => !el.closest("[aria-roledescription=carousel], .overflow-hidden"))
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`),
    hidden: [...document.querySelectorAll("main h2, main h3, main p")].filter(
      (el) =>
        getComputedStyle(el.closest("[style*=opacity], [class*=opacity-0]") ?? el).opacity === "0",
    ).length,
  }));
  check(
    `${width}px : pas de défilement horizontal`,
    m.overflow <= 0,
    m.overflow > 0 ? `+${m.overflow}px ${m.wide.join(", ")}` : "",
  );
  check(
    `${width}px : tous les textes apparaissent après défilement`,
    m.hidden === 0,
    `${m.hidden} masqué(s)`,
  );
  check(`${width}px : aucune erreur JavaScript`, jsErrors.length === 0, jsErrors.join(" | "));
  if (SHOTS) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/accueil-${width}.png`, fullPage: true });
  }
  await page.close();
}

// Structure, accessibilité, liens (bureau)
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
const s = await page.evaluate(() => ({
  title: document.title,
  lang: document.documentElement.lang,
  desc: document.querySelector('meta[name="description"]')?.content ?? "",
  h1: document.querySelectorAll("h1").length,
  imgNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
  anchors: [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute("href")),
  missingTargets: [...document.querySelectorAll('a[href^="#"]')]
    .map((a) => a.getAttribute("href"))
    .filter((h) => !document.querySelector(h)),
  ctas: [...document.querySelectorAll("a[href]")]
    .filter((a) => !a.getAttribute("href").startsWith("#"))
    .map((a) => `${a.textContent.trim()}→${a.getAttribute("href")}`),
  iframeTitle: document.querySelector("iframe")?.getAttribute("title") ?? "",
  buttonsNoName: [...document.querySelectorAll("button")].filter(
    (b) => !(b.textContent.trim() || b.getAttribute("aria-label")),
  ).length,
}));
check("Titre de l'onglet", s.title.includes("YONA"), s.title);
check("Langue de la page = fr", s.lang === "fr");
check("Description pour les moteurs de recherche", s.desc.length > 50, s.desc);
check("Un seul titre principal (h1)", s.h1 === 1, `${s.h1}`);
check("Toutes les images ont un texte alternatif", s.imgNoAlt === 0, `${s.imgNoAlt} sans alt`);
check("Tous les boutons ont un nom accessible", s.buttonsNoName === 0, `${s.buttonsNoName}`);
check("La vidéo a un titre accessible", s.iframeTitle.length > 0, s.iframeTitle);
check("Liens du menu → sections existantes", s.missingTargets.length === 0, s.anchors.join(" "));
const allowed = new Set(["/register", "/login"]);
const bad = s.ctas.filter((c) => !allowed.has(c.split("→")[1]));
check(
  "Boutons d'action → /register ou /login",
  bad.length === 0,
  `${s.ctas.length} liens ${bad.join(", ")}`,
);
for (const [label, to] of [
  ["Créer un compte", "/register"],
  ["Connexion", "/login"],
]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("header").getByRole("link", { name: label }).click();
  await page.waitForURL(new RegExp(`${to}$`), { timeout: 5000 }).catch(() => {});
  check(`En-tête « ${label} » → ${to}`, page.url().endsWith(to), page.url());
}
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Tarifs" }).click();
await page.waitForTimeout(800);
check(
  "Menu « Tarifs » amène à la section Tarifs",
  await page.evaluate(
    () => Math.abs(document.querySelector("#tarifs").getBoundingClientRect().top) < 200,
  ),
);
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
