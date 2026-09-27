// YONA — Phase 5 / Étape 6.9 — Vérification de l'information de l'expéditeur.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-6/etape-6.9-informer-expediteur.mjs
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";

const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();
// Erreur renvoyée par la base (texte), ou "" si la requête a réussi.
const sqlError = (q) => {
  try {
    execFileSync(
      "docker",
      ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
      {
        input: q,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return "";
  } catch (e) {
    return String(e.stderr ?? e);
  }
};
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-t69-%@example.test';");
const stamp = Date.now();
const PWD = "TestT69!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-t69-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Qpaul"),
  a: mk("a", "female", "Qgrace"),
  b: mk("b", "female", "Qruth"),
  c: mk("c", "male", "Qtiers"),
};
for (const t of ["a", "b"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (x, y) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id[x]}'::uuid,'${id[y]}'::uuid) and user_2_id=greatest('${id[x]}'::uuid,'${id[y]}'::uuid)`,
  );
const usage = (c) =>
  sql(
    `select string_agg(user_id::text || ':' || free_messages_used, ',' order by user_id) from public.conversation_user_usage where conversation_id='${c}'`,
  );
const tokenOf = async (tag) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: emails[tag], password: PWD }),
      })
    ).json()
  ).access_token;
const api = async (tag, path, method = "GET", body) => {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${tag ? await tokenOf(tag) : KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
};

const used = (c, tag) =>
  sql(
    `select free_messages_used from public.conversation_user_usage where conversation_id='${c}' and user_id='${id[tag]}'`,
  );
const count = (c) => sql(`select count(*) from public.messages where conversation_id='${c}'`);
const send = (tag, c, content) =>
  api(tag, "rpc/send_message", "POST", { _conversation_id: c, _content: content });
const cA = conv("v", "a");
const cB = conv("v", "b");

const browser = await chromium.launch();
const jsErrors = [];
async function login(tag) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 800 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  return page;
}
const openConv = async (page, c) => {
  await page.goto(`${BASE}/messages/${c}`, { waitUntil: "networkidle" });
  await page.getByTestId("message-composer").waitFor({ timeout: 8000 });
};
const waitCount = async (c, n) => {
  for (let i = 0; i < 60 && count(c) !== String(n); i++)
    await new Promise((r) => setTimeout(r, 100));
  return count(c);
};

const LIMIT_MSG = "Vous avez utilisé vos 3 messages gratuits dans cette conversation.";
const field = (p) => p.getByLabel(/^Votre message à /);
const button = (p) => p.getByRole("button", { name: /^(Envoyer le message|Envoi du message…)$/ });
const toastText = async (p) => {
  const list = p.locator("[data-sonner-toast]");
  for (let i = 0; i < 100 && (await list.count()) === 0; i++) await p.waitForTimeout(100);
  return (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
};

const EXPLICATION =
  "Votre message n'a pas été envoyé : il semble contenir un numéro de téléphone. Pour la sécurité de tous, l'échange de numéros n'est pas autorisé sur YONA. Retirez le numéro puis renvoyez votre message (il n'a pas été décompté de vos messages gratuits).";
const notice = (p) => p.getByTestId("message-notice");

// A. Refus expliqué
const pv = await login("v");
await openConv(pv, cA);
await field(pv).fill("Appelle-moi au 06 12 34 56 78 ce soir");
await button(pv).click();
const t = await toastText(pv);
check(
  "Notification claire : la raison (numéro de téléphone) et quoi faire",
  t.includes("il semble contenir un numéro de téléphone") && t.includes("Retirez le numéro"),
  t.slice(0, 90),
);
check(
  "Précise que le message n'a pas été décompté",
  t.includes("n'a pas été décompté de vos messages gratuits"),
);
await notice(pv)
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Explication gardée sous le champ (encadré rouge)",
  ((await notice(pv).textContent()) ?? "").trim() === EXPLICATION,
);
check(
  "Annoncée aux lecteurs d'écran (alerte) et liée au champ (champ signalé invalide)",
  (await notice(pv).getAttribute("role")) === "alert" &&
    ((await field(pv).getAttribute("aria-describedby")) ?? "").includes(
      (await notice(pv).getAttribute("id")) ?? "§",
    ) &&
    (await field(pv).getAttribute("aria-invalid")) === "true",
);
check(
  "Texte remis dans le champ pour correction ; rien d'enregistré ; décompte intact (3)",
  (await field(pv).inputValue()) === "Appelle-moi au 06 12 34 56 78 ce soir" &&
    count(cA) === "0" &&
    ((await pv.getByTestId("message-quota").textContent()) ?? "").startsWith("3 messages"),
);
check(
  "La notification reste affichée assez longtemps pour être lue (≥ 5 s)",
  await (async () => {
    await pv.waitForTimeout(5000);
    return (
      (await pv
        .locator("[data-sonner-toast]")
        .filter({ hasText: "numéro de téléphone" })
        .count()) === 1
    );
  })(),
);

// B. Correction puis envoi
await field(pv).fill("Appelle-moi ce soir, on en parle ici");
check(
  "Dès que le texte est modifié, l'explication disparaît",
  (await notice(pv).count()) === 0 && (await field(pv).getAttribute("aria-invalid")) === null,
);
await button(pv).click();
await waitCount(cA, 1);
check("Message corrigé : envoyé normalement", count(cA) === "1");

// C. Autres refus : pas d'explication « numéro » à tort
await openConv(pv, cB);
await field(pv).fill("Bonjour Ruth");
sql(`update public.conversations set status='closed' where id='${cB}'`);
await button(pv).click();
const t2 = await toastText(pv);
check(
  "Autre refus (conversation fermée) : son propre message, pas d'encadré « numéro »",
  t2.includes("n'est plus disponible") && (await notice(pv).count()) === 0,
  t2,
);
sql(`update public.conversations set status='open' where id='${cB}'`);

// D. Formes déguisées et autre personne
await openConv(pv, cA);
await field(pv).fill("zéro six douze trente-quatre cinquante-six soixante-dix-huit");
await button(pv).click();
await notice(pv)
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Numéro en lettres : même explication",
  ((await notice(pv).textContent()) ?? "").includes("numéro de téléphone") && count(cA) === "1",
);
const pa = await login("a");
await openConv(pa, cA);
await pa.waitForTimeout(800);
check(
  "Grace ne voit ni le numéro ni l'explication destinée à Paul",
  (await pa.getByText("zéro six douze").count()) === 0 && (await notice(pa).count()) === 0,
);
const r = await send("v", cA, "+237 699 88 77 66");
check(
  "Appel direct : code « phone_number_detected » renvoyé à l'expéditeur",
  r.text.includes("phone_number_detected"),
);

// E. Petit écran
const small = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
small.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
await small.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await small.fill("#email", emails.v);
await small.fill("#password", PWD);
await small.click("button[type=submit]");
await small.waitForURL(/\/discover$/, { timeout: 8000 });
await openConv(small, cB);
await field(small).fill("06-12-34-56-78");
await button(small).click();
await notice(small)
  .waitFor({ timeout: 5000 })
  .catch(() => {});
check(
  "Petit écran (320 px) : explication lisible, sans débordement",
  (await notice(small).count()) === 1 &&
    !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-t69-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages supprimés",
  sql("select count(*) from auth.users where email like 'test-t69-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
