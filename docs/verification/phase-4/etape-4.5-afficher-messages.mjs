// YONA — Phase 4 / Étape 4.5 — Vérification de l'affichage des messages d'une conversation.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-4/etape-4.5-afficher-messages.mjs
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
const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// ---------- Comptes de test temporaires ----------
sql("delete from auth.users where email like 'test-amsg-%@example.test';");
const stamp = Date.now();
const PWD = "TestAmsg!2026";
const emails = {};
const mk = (tag, gender, name) => {
  const e = `test-amsg-${tag}-${stamp}@example.test`;
  emails[tag] = e;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"${name}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-04-04' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return sql(`select id from auth.users where email='${e}'`);
};
const id = {
  v: mk("v", "male", "Ampaul"),
  a: mk("a", "female", "Amgrace"),
  b: mk("b", "female", "Amruth"),
  c: mk("c", "male", "Amtiers"),
};
for (const t of ["a", "b"])
  sql(
    `insert into public.likes (sender_id, receiver_id) values ('${id.v}','${id[t]}'), ('${id[t]}','${id.v}');`,
  );
const conv = (t) =>
  sql(
    `select id from public.conversations where user_1_id=least('${id.v}'::uuid,'${id[t]}'::uuid) and user_2_id=greatest('${id.v}'::uuid,'${id[t]}'::uuid)`,
  );
const cA = conv("a");
const cB = conv("b");
const msg = (c, from, content, at, status = "delivered") =>
  sql(
    `insert into public.messages (conversation_id, sender_id, content, status, created_at) values ('${c}','${id[from]}','${content.replace(/'/g, "''")}','${status}', ${at});`,
  );
// Deux jours différents : avant-hier 09:15, puis aujourd'hui.
msg(
  cA,
  "a",
  "Bonjour Paul !",
  "date_trunc('day', now()) - interval '2 days' + interval '9 hours 15 minutes'",
);
msg(
  cA,
  "v",
  "Bonjour Grace, ravi de te lire.",
  "date_trunc('day', now()) - interval '2 days' + interval '9 hours 20 minutes'",
);
msg(cA, "a", "Message retenu par la modération", "now() - interval '10 minutes'", "blocked");
msg(cA, "v", "Mon message retenu", "now() - interval '8 minutes'", "blocked");
msg(cA, "a", "Message supprimé", "now() - interval '6 minutes'", "deleted");
msg(cA, "a", "Comment s'est passée ta semaine ?\nMoi très bien.", "now() - interval '5 minutes'");
msg(cA, "v", "Très bien, merci !", "now() - interval '1 minute'");

// ---------- Navigateur ----------
const browser = await chromium.launch();
const jsErrors = [];
async function login(tag, width = 390) {
  const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", emails[tag]);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  return page;
}
const openConv = async (page, c) => {
  await page.goto(`${BASE}/messages/${c}`, { waitUntil: "networkidle" });
  await page.getByTestId("conversation-page").waitFor({ timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator(".animate-pulse").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.waitForTimeout(500);
};
const bubbles = (page) =>
  page
    .locator("[data-testid=conversation-thread] ol[aria-label=Messages] > li")
    .evaluateAll((els) =>
      els.map((li) => ({
        from: li.getAttribute("data-from"),
        text: li.querySelector("p.rounded-2xl")?.textContent ?? "",
        time: li.querySelector("time")?.textContent ?? "",
        day: li.querySelector("p.pt-2")?.textContent ?? "",
        side: getComputedStyle(li.querySelector("div")).alignItems,
        full: li.textContent ?? "",
      })),
    );

// A. Point de vue de Paul
const pv = await login("v");
await openConv(pv, cA);
let b = await bubbles(pv);
const texts = b.map((x) => x.text.replace(/^(Vous|Amgrace) : /, ""));
check(
  "Messages dans l'ordre chronologique (plus ancien en haut)",
  texts[0] === "Bonjour Paul !" &&
    texts[1] === "Bonjour Grace, ravi de te lire." &&
    texts.at(-1) === "Très bien, merci !",
  texts.join(" | "),
);
check(
  "Messages de Paul à droite, ceux de Grace à gauche",
  b[0].from === "other" &&
    b[0].side === "flex-start" &&
    b[1].from === "me" &&
    b[1].side === "flex-end",
);
check(
  "Heure affichée sous chaque message",
  b.every((x) => /^\d{2}:\d{2}$/.test(x.time)) && b[0].time === "09:15",
);
check(
  "Séparateur de jour : date complète pour avant-hier, « Aujourd'hui » ensuite",
  /^[A-Z][a-zé]+ \d{1,2} [a-zéû]+ \d{4}$/.test(b[0].day) &&
    b[1].day === "" &&
    b.filter((x) => x.day === "Aujourd'hui").length === 1,
  b
    .map((x) => x.day)
    .filter(Boolean)
    .join(","),
);
check(
  "Retour à la ligne du message conservé",
  b.some((x) => x.text.includes("Comment s'est passée ta semaine ?\nMoi très bien.")),
);
check(
  "Message de Grace bloqué par la modération : jamais montré à Paul",
  !b.some((x) => x.full.includes("retenu par la modération")),
);
const own = b.find((x) => x.text.includes("Mon message retenu"));
check(
  "Message de Paul bloqué : visible pour lui, marqué « Non envoyé : bloqué par la modération »",
  !!own && own.full.includes("Non envoyé : bloqué par la modération"),
);
check("Message supprimé : jamais affiché", !b.some((x) => x.full.includes("supprimé")));
check(
  "Accessibilité : chaque message annonce son auteur (« Vous : » / prénom)",
  b[0].text.startsWith("Amgrace : ") && b[1].text.startsWith("Vous : "),
);
check(
  "Le texte « Début de votre conversation » n'apparaît pas quand il y a des messages",
  (await pv.getByText("Début de votre conversation avec Amgrace.").count()) === 0,
);

// B. Point de vue de Grace
const pa = await login("a");
await openConv(pa, cA);
const ba = await bubbles(pa);
check(
  "Grace voit les mêmes échanges, côtés inversés",
  ba[0].from === "me" && ba[0].side === "flex-end" && ba[1].from === "other",
);
check(
  "Grace voit son propre message bloqué ; pas celui de Paul",
  ba.some((x) => x.full.includes("retenu par la modération") && x.full.includes("Non envoyé")) &&
    !ba.some((x) => x.full.includes("Mon message retenu")),
);

// C. Conversation vide, défilement, rechargement
await openConv(pv, cB);
check(
  "Conversation sans message : « Début de votre conversation avec Amruth. »",
  await pv.getByText("Début de votre conversation avec Amruth.").isVisible(),
);
const values = [];
for (let i = 0; i < 40; i++)
  values.push(
    `(${`'${cB}'`}, '${id[i % 2 ? "v" : "b"]}', 'Message numéro ${i + 1}', now() - interval '${60 - i} minutes')`,
  );
sql(
  `insert into public.messages (conversation_id, sender_id, content, created_at) values ${values.join(",")};`,
);
await openConv(pv, cB);
const lastBox = await pv
  .locator("[data-testid=conversation-thread] ol[aria-label=Messages] > li")
  .last()
  .evaluate((li) => {
    const r = li.getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      h: window.innerHeight,
      y: window.scrollY,
      text: li.textContent,
    };
  });
check(
  "40 messages : la page s'ouvre sur le plus récent (défilement en bas, dernier message visible)",
  lastBox.y > 0 &&
    lastBox.top >= 0 &&
    lastBox.bottom <= lastBox.h &&
    lastBox.text.includes("Message numéro 40"),
  JSON.stringify({ ...lastBox, text: undefined }),
);
await pv.reload({ waitUntil: "networkidle" });
await openConv(pv, cB);
check("Rechargement : messages toujours affichés", (await bubbles(pv)).length === 40);

// D. Sécurité (API directe)
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
const read = async (token, c) =>
  (
    await fetch(`${API}/rest/v1/messages?select=content&conversation_id=eq.${c}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${token ?? KEY}` },
    })
  ).json();
const third = await read(await tokenOf("c"), cA);
check(
  "Un tiers ne lit aucun message de la conversation (API)",
  Array.isArray(third) && third.length === 0,
);
const anonRead = await read(null, cA);
check(
  "Sans connexion : aucun message lisible (API)",
  !Array.isArray(anonRead) || anonRead.length === 0,
);
const pc = await login("c");
await openConv(pc, cA);
check(
  "Un tiers qui ouvre l'adresse : non disponible, aucun message affiché",
  (await pc.getByTestId("conversation-unavailable").isVisible()) &&
    (await pc.getByText("Bonjour Paul !").count()) === 0,
);

// E. Petit écran avec message très long
msg(cA, "a", "Trèslongmotsansespace".repeat(40), "now()");
const small = await login("v", 320);
await openConv(small, cA);
check(
  "Petit écran (320 px), message très long sans espace : sans débordement",
  !(await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)),
);
check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();

// ---------- Nettoyage ----------
sql("delete from auth.users where email like 'test-amsg-%@example.test';");
check(
  "Nettoyage : comptes, conversations et messages de test supprimés",
  sql("select count(*) from auth.users where email like 'test-amsg-%'") === "0" &&
    sql(`select count(*) from public.messages where conversation_id in ('${cA}','${cB}')`) === "0",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
