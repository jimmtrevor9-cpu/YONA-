// YONA — Phase 13 / Étapes 13.1 à 13.10 — Roi Salomon (page, quota IA, fournisseur, clé API).
// Usage : SUPABASE_SERVICE_ROLE_KEY=… PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-13/etape-13.1-a-13.10-roi-salomon.mjs
// Le serveur local est redémarré avec différents réglages IA (test, absent, clé invalide).
import { readdirSync, readFileSync } from "node:fs";

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
import { restartServer } from "../outils/serveur.mjs";

const { check, finish } = createChecker();
const { id, emails, PWD, cleanup } = createAccounts("c13", {
  f: ["female", "Salfree"],
  p: ["male", "Salprem"],
});
const tf = await tokenOf(emails.f, PWD);
const used = (u, feature = "roi_salomon") =>
  sql(
    `select coalesce((select usage_count from public.ai_usage where user_id='${id[u]}' and feature='${feature}' and usage_date=(now() at time zone 'UTC')::date), 0)`,
  );

// A. Base de données
let r = await rest(tf, "rpc/consume_ai_quota", "POST", { _feature: "autre_chose" });
check(
  "Fonctionnalité IA inconnue : refus « invalid_feature » (pas de quota neuf)",
  r.json?.allowed === false && r.json?.reason === "invalid_feature",
  r.text,
);
r = await rest(tf, "rpc/get_ai_quota", "POST", { _feature: "roi_salomon" });
check(
  "Quota initial : 0 utilisée, 3 restantes",
  r.json?.used === 0 && r.json?.limit === 3 && r.json?.remaining === 3,
  r.text,
);
r = await rest(tf, "rpc/refund_ai_quota", "POST", { _user_id: id.f, _feature: "roi_salomon" });
check("Rendre une question depuis le navigateur : refusé", r.status >= 400, `${r.status}`);
r = await rest(tf, "ai_usage", "POST", { user_id: id.f, feature: "roi_salomon", usage_count: 0 });
check("Écrire le compteur directement : refusé", r.status >= 400, `${r.status}`);
r = await rest(null, "rpc/consume_ai_quota", "POST", { _feature: "roi_salomon" });
check("Visiteur non connecté : aucune question", r.status >= 400 || r.json?.allowed === false);

// B. Page avec le fournisseur de test
await restartServer({ AI_PROVIDER: "test" });
const { browser, jsErrors, login } = await openBrowser();
const pf = await login(emails.f, PWD);
let captured = null;
pf.on("request", (q) => {
  if (
    q.url().includes("/_serverFn/") &&
    q.method() === "POST" &&
    (q.postData() ?? "").includes("question")
  )
    captured = { url: q.url(), headers: q.headers(), body: q.postData() };
});
check(
  "En-tête : accès à Roi Salomon (couronne)",
  (await pf.getByRole("link", { name: "Roi Salomon, votre conseiller" }).count()) === 1,
);
await pf.getByRole("link", { name: "Roi Salomon, votre conseiller" }).click();
await pf.getByTestId("roi-salomon-page").waitFor({ timeout: 8000 });
await pf.getByTestId("ai-quota").waitFor({ timeout: 8000 });
check(
  "Page : présentation, idées de questions, champ et quota « 3 questions »",
  (await pf.getByTestId("ai-thread").textContent()).includes("Quelques idées") &&
    (await pf.getByLabel("Votre question à Roi Salomon").count()) === 1 &&
    (await pf.getByTestId("ai-quota").textContent()).includes("Il vous reste 3 questions"),
  await pf.getByTestId("ai-quota").textContent(),
);
check(
  "Envoi désactivé tant que le champ est vide",
  await pf.getByRole("button", { name: "Envoyer la question" }).isDisabled(),
);
await pf.getByLabel("Votre question à Roi Salomon").fill("Comment prier pour mon futur conjoint ?");
await pf.getByRole("button", { name: "Envoyer la question" }).click();
await pf.getByTestId("ai-answer").first().waitFor({ timeout: 10000 });
check(
  "Question envoyée : réponse affichée sous la question",
  (await pf.getByTestId("ai-question").first().textContent()).includes("prier pour mon futur") &&
    (await pf.getByTestId("ai-answer").first().textContent()).includes(
      "Réponse de test de Roi Salomon",
    ),
);
await pf.waitForTimeout(400);
check(
  "Quota mis à jour : 2 restantes (base : 1 utilisée)",
  (await pf.getByTestId("ai-quota").textContent()).includes("Il vous reste 2 questions") &&
    used("f") === "1",
);
await pf
  .getByLabel("Votre question à Roi Salomon")
  .fill("Appelez-moi au 06 12 34 56 78 pour en parler");
await pf.getByRole("button", { name: "Envoyer la question" }).click();
let t = await toastText(pf);
check(
  "Numéro de téléphone dans la question : refusé, non décompté, texte gardé",
  t.includes("numéro de téléphone") &&
    used("f") === "1" &&
    (await pf.getByLabel("Votre question à Roi Salomon").inputValue()).includes("06 12"),
  t,
);
for (const q of ["Deuxième question", "Troisième question"]) {
  await pf.getByLabel("Votre question à Roi Salomon").fill(q);
  await pf.getByRole("button", { name: "Envoyer la question" }).click();
  await pf.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="ai-answer"]').length >= n,
    q.startsWith("Deux") ? 2 : 3,
    { timeout: 10000 },
  );
}
await pf.waitForTimeout(400);
check(
  "Après 3 questions : « Plus aucune question gratuite », champ désactivé",
  (await pf.getByTestId("ai-quota").textContent()).includes("Plus aucune question gratuite") &&
    (await pf.getByLabel("Votre question à Roi Salomon").isDisabled()) &&
    used("f") === "3",
);
// 4e question envoyée directement au serveur (contournement de la page) : refusée.
const replay = await fetch(captured.url, {
  method: "POST",
  headers: captured.headers,
  body: captured.body.replace(/Troisième question|Deuxième question/, "Quatrième question"),
});
const replayText = await replay.text();
check(
  "4e question envoyée directement au serveur : refusée (quota), rien de décompté",
  replayText.includes("3 questions gratuites") && used("f") === "3",
  replayText.slice(0, 120),
);
await pf.reload({ waitUntil: "networkidle" });
await pf.getByTestId("ai-answer").first().waitFor({ timeout: 8000 });
check(
  "Rechargement : la discussion de l'onglet est conservée",
  (await pf.getByTestId("ai-answer").count()) === 3,
);
// Lendemain : quota remis à zéro.
sql(`update public.ai_usage set usage_date = usage_date - 1 where user_id='${id.f}'`);
r = await rest(tf, "rpc/get_ai_quota", "POST", { _feature: "roi_salomon" });
check("Le lendemain : 3 questions de nouveau", r.json?.remaining === 3, r.text);

// C. Premium illimité
sql(
  `insert into public.subscriptions (user_id, plan, status, starts_at, expires_at) values ('${id.p}','premium_yearly','active', now() - interval '1 day', now() + interval '300 days');
   insert into public.ai_usage (user_id, feature, usage_date, usage_count) values ('${id.p}','roi_salomon',(now() at time zone 'UTC')::date, 3);`,
);
const pp = await login(emails.p, PWD);
await pp.goto(`${BASE}/roi-salomon`, { waitUntil: "networkidle" });
await pp.getByTestId("ai-quota").waitFor({ timeout: 8000 });
check(
  "Premium : « questions illimitées »",
  (await pp.getByTestId("ai-quota").textContent()).includes("illimitées"),
);
await pp.getByLabel("Votre question à Roi Salomon").fill("Quatrième question Premium");
await pp.getByRole("button", { name: "Envoyer la question" }).click();
await pp.getByTestId("ai-answer").first().waitFor({ timeout: 10000 });
check("Premium : 4e question du jour acceptée", used("p") === "4");

// D. IA non configurée : indisponible, rien n'est décompté
await restartServer({ AI_PROVIDER: "", ANTHROPIC_API_KEY: "" });
await pp.reload({ waitUntil: "networkidle" });
await pp.getByTestId("ai-unavailable").waitFor({ timeout: 8000 });
check(
  "Sans fournisseur IA : message « pas encore disponible », champ désactivé",
  (await pp.getByTestId("ai-unavailable").count()) === 1 &&
    (await pp.getByLabel("Votre question à Roi Salomon").isDisabled()),
);
const replay2 = await fetch(captured.url, {
  method: "POST",
  headers: captured.headers,
  body: captured.body,
});
const t2 = await replay2.text();
sql(`delete from public.ai_usage where user_id='${id.f}'`);
check(
  "Sans fournisseur IA, appel direct : « pas encore disponible », rien de décompté",
  t2.includes("pas encore disponible") && used("f") === "0",
  t2.slice(0, 100),
);

// E. Fournisseur réel en échec (clé invalide) : question rendue
await restartServer({ AI_PROVIDER: "", ANTHROPIC_API_KEY: "sk-ant-cle-invalide-de-test" });
const replay3 = await fetch(captured.url, {
  method: "POST",
  headers: captured.headers,
  body: captured.body,
});
const t3 = await replay3.text();
check(
  "Fournisseur réel en échec : message clair et question rendue (0 décomptée)",
  t3.includes("ne vous a pas été décomptée") && used("f") === "0",
  t3.slice(0, 120),
);
check(
  "La clé API n'apparaît jamais dans les réponses du serveur",
  !t3.includes("sk-ant-cle-invalide") && !t2.includes("sk-ant") && !replayText.includes("sk-ant"),
);
const assets = readdirSync(".output/public/assets").filter((f) => f.endsWith(".js"));
const bundle = assets.map((f) => readFileSync(`.output/public/assets/${f}`, "utf8")).join("\n");
check(
  "Code du navigateur : ni SDK Anthropic, ni variable ANTHROPIC_API_KEY",
  !bundle.includes("ANTHROPIC_API_KEY") && !bundle.includes("api.anthropic.com"),
);

await restartServer({ AI_PROVIDER: "test" });
const small = await login(emails.f, PWD, 320);
await small.goto(`${BASE}/roi-salomon`, { waitUntil: "networkidle" });
await small.waitForTimeout(800);
check(
  "Petit écran (320 px) : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
check("Nettoyage : comptes de test supprimés", cleanup());
finish();
