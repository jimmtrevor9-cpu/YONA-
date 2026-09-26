// YONA — Phase 1 / Étape 1.13 — Vérification des photos (page Profil + serveur).
// Les images de test (JPEG, PNG, WebP) sont dessinées par Chromium.
// Usage : PLAYWRIGHT_ROOT="$(npm root -g)" node docs/verification/phase-1/etape-1.13-photos.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(`${process.env.PLAYWRIGHT_ROOT ?? ""}/`)("playwright");
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
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
sql("delete from auth.users where email like 'test-photos-%@example.test';");
const stamp = Date.now();
const PWD = "TestPhotos!2026";
const mk = (tag, gender) => {
  const e = `test-photos-${tag}-${stamp}@example.test`;
  sql(
    `insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change) values ('00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated','${e}',crypt('${PWD}',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"first_name":"Photo${tag}"}',now(),now(),'','','','');
     update public.profiles p set onboarding_completed_at=now(), status='active', visibility='visible', gender='${gender}', birth_date='1992-02-02' from auth.users a where a.id=p.user_id and a.email='${e}';`,
  );
  return e;
};
const A = mk("a", "female");
const B = mk("b", "male");
const P = mk("premium", "male");
const uid = (e) => sql(`select id from auth.users where email='${e}'`);
const rows = (e) =>
  sql(
    `select string_agg(status||':'||is_primary, ',' order by position) from public.photos where user_id='${uid(e)}'`,
  );
const objects = (e) =>
  Number(
    sql(
      `select count(*) from storage.objects where bucket_id='photos' and name like '${uid(e)}/%'`,
    ),
  );
sql(`insert into public.payments (id,user_id,type,amount,provider,status) values (gen_random_uuid(),'${uid(P)}','subscription',500,'test','succeeded');
     insert into public.subscriptions (user_id,status,starts_at,expires_at) values ('${uid(P)}','active',now()-interval '1 day',now()+interval '29 days');`);

const browser = await chromium.launch();
const jsErrors = [];
async function login(email) {
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  page.on("pageerror", (e) => jsErrors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/discover$/, { timeout: 8000 });
  for (let i = 0; i < 80 && (await page.locator("[data-sonner-toast]").count()) > 0; i++)
    await page.waitForTimeout(100);
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  return page;
}
const toast = async (page) => {
  const list = page.locator("[data-sonner-toast]");
  for (let i = 0; i < 80 && (await list.count()) === 0; i++) await page.waitForTimeout(100);
  const t = (
    (await list
      .first()
      .textContent()
      .catch(() => "")) ?? ""
  ).trim();
  for (let i = 0; i < 80 && (await list.count()) > 0; i++) await page.waitForTimeout(100);
  return t;
};
const count = (page) => page.getByTestId("photos-count").textContent();

// Fabrication des images de test par le navigateur
const dir = mkdtempSync(join(tmpdir(), "yona-photos-"));
const maker = await (await browser.newContext()).newPage();
async function image(type, color) {
  const b64 = await maker.evaluate(
    async ([t, c]) => {
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 400, 400);
      const blob = await new Promise((r) => canvas.toBlob(r, t, 0.9));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = "";
      for (const x of bytes) s += String.fromCharCode(x);
      return btoa(s);
    },
    [type, color],
  );
  const file = join(dir, `photo-${color.slice(1)}.${type.split("/")[1]}`);
  writeFileSync(file, Buffer.from(b64, "base64"));
  return file;
}
const jpg = await image("image/jpeg", "#c7527f");
const png = await image("image/png", "#b0893f");
const webp = await image("image/webp", "#4a2138");
const gif = join(dir, "anime.gif");
writeFileSync(
  gif,
  Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"),
);
const big = join(dir, "enorme.jpg");
writeFileSync(
  big,
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(6 * 1024 * 1024, 1)]),
);

// ---------- A. Membre gratuit ----------
let page = await login(A);
const input = page.locator('input[type="file"]');
check(
  "Section « Photos » vide : « Aucune photo », compteur 0 / 3",
  (await page.getByText("Aucune photo pour le moment.").isVisible()) &&
    (await count(page)) === "0 / 3",
);
check(
  "Le sélecteur n'accepte que JPG, PNG, WebP",
  (await input.getAttribute("accept")) === "image/jpeg,image/png,image/webp",
);

await input.setInputFiles(jpg);
let t = await toast(page);
check(
  "JPEG ajouté : message, compteur 1 / 3",
  t.includes("Photo ajoutée") && (await count(page)) === "1 / 3",
  t,
);
check(
  "1ʳᵉ photo : principale, « en attente » de validation",
  rows(A) === "pending:true" &&
    (await page.getByText("Principale").isVisible()) &&
    (await page.getByText("En attente").isVisible()),
  rows(A),
);
check("Fichier rangé dans le dossier du membre", objects(A) === 1);
await page.waitForTimeout(800);
check(
  "La photo s'affiche réellement (image chargée)",
  await page
    .locator("section[aria-labelledby=photos-title] img")
    .first()
    .evaluate((i) => i.complete && i.naturalWidth === 400),
);

await input.setInputFiles(png);
await toast(page);
await input.setInputFiles(webp);
await toast(page);
check(
  "PNG et WebP ajoutés : 3 / 3, une seule principale",
  (await count(page)) === "3 / 3" && rows(A) === "pending:true,pending:false,pending:false",
  rows(A),
);
check(
  "Limite atteinte : bouton « Ajouter une photo » désactivé",
  await page.getByRole("button", { name: "Ajouter une photo" }).isDisabled(),
);

await page.getByRole("button", { name: "Choisir comme photo principale" }).first().click();
await toast(page);
check(
  "Choisir la 2ᵉ photo comme principale : une seule principale",
  rows(A) === "pending:false,pending:true,pending:false",
  rows(A),
);

await page.getByRole("button", { name: "Supprimer la photo" }).nth(1).click();
t = await toast(page);
check(
  "Supprimer la photo principale : une autre devient principale, fichier supprimé",
  t.includes("supprimée") &&
    rows(A) === "pending:true,pending:false" &&
    objects(A) === 2 &&
    (await count(page)) === "2 / 3",
  `${rows(A)} / fichiers ${objects(A)}`,
);

await input.setInputFiles(gif);
t = await toast(page);
check(
  "GIF refusé avec un message clair",
  t.includes("Format non accepté") && rows(A).split(",").length === 2,
  t,
);
await input.setInputFiles(big);
t = await toast(page);
check("Photo de 6 Mo refusée avec un message clair", t.includes("5 Mo") && objects(A) === 2, t);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
check(
  "Après rechargement : 2 photos, principale conservée",
  (await count(page)) === "2 / 3" && (await page.getByText("Principale").isVisible()),
);
check(
  "320 px : pas de défilement horizontal",
  await page.evaluate(() => document.documentElement.scrollWidth <= 390),
);
await page.context().close();

// ---------- B. Serveur (sans l'interface) ----------
const token = async (e) =>
  (
    await (
      await fetch(`${API}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: KEY, "content-type": "application/json" },
        body: JSON.stringify({ email: e, password: PWD }),
      })
    ).json()
  ).access_token;
const jwtA = await token(A);
const up = async (jwt, path, bytes, type) =>
  (
    await fetch(`${API}/storage/v1/object/photos/${path}`, {
      method: "POST",
      headers: { apikey: KEY, authorization: `Bearer ${jwt}`, "content-type": type },
      body: bytes,
    })
  ).status;
check(
  "Serveur : GIF refusé par le stockage",
  (await up(jwtA, `${uid(A)}/x.gif`, Buffer.from("GIF89a"), "image/gif")) >= 400,
);
check(
  "Serveur : 6 Mo refusés par le stockage",
  (await up(jwtA, `${uid(A)}/x.jpg`, Buffer.alloc(6 * 1024 * 1024, 1), "image/jpeg")) >= 400,
);
const ins = async (path) =>
  (
    await fetch(`${API}/rest/v1/photos`, {
      method: "POST",
      headers: { apikey: KEY, authorization: `Bearer ${jwtA}`, "content-type": "application/json" },
      body: JSON.stringify({
        user_id: uid(A),
        storage_path: path,
        is_primary: true,
        status: "approved",
      }),
    })
  ).status;
check(
  "Serveur : 3ᵉ photo acceptée, sans voler la place de principale ni s'auto-approuver",
  (await ins(`${uid(A)}/c.jpg`)) < 300 && rows(A) === "pending:true,pending:false,pending:false",
  rows(A),
);
check(
  "Serveur : 4ᵉ photo refusée (limite gratuite de 3)",
  (await ins(`${uid(A)}/d.jpg`)) >= 400 && rows(A).split(",").length === 3,
);
const other = await fetch(`${API}/rest/v1/rpc/set_primary_photo`, {
  method: "POST",
  headers: {
    apikey: KEY,
    authorization: `Bearer ${await token(B)}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    _photo_id: sql(`select id from public.photos where user_id='${uid(A)}' limit 1`),
  }),
});
check(
  "Serveur : impossible de modifier la photo principale d'un autre membre",
  other.status === 403,
  `HTTP ${other.status}`,
);
sql(`delete from public.photos where storage_path='${uid(A)}/c.jpg'`);

// ---------- C. Visibilité pour les autres membres (modération) ----------
const jwtB = await token(B);
const visible = async () =>
  (
    await (
      await fetch(`${API}/rest/v1/photos?user_id=eq.${uid(A)}&select=id`, {
        headers: { apikey: KEY, authorization: `Bearer ${jwtB}` },
      })
    ).json()
  ).length;
check("Un autre membre ne voit pas les photos « en attente »", (await visible()) === 0);
sql(`update public.photos set status='approved' where user_id='${uid(A)}'`);
const path = sql(`select storage_path from public.photos where user_id='${uid(A)}' and is_primary`);
const dl = await fetch(`${API}/storage/v1/object/authenticated/photos/${path}`, {
  headers: { apikey: KEY, authorization: `Bearer ${jwtB}` },
});
check(
  "Après validation : l'autre membre voit les photos et peut afficher l'image",
  (await visible()) === 2 && dl.status === 200,
  `HTTP ${dl.status}`,
);

// ---------- D. Membre Premium : 10 photos ----------
page = await login(P);
check("Membre Premium : compteur 0 / 10", (await count(page)) === "0 / 10");
await page.context().close();

check("Aucune erreur JavaScript", jsErrors.length === 0, jsErrors.join(" | "));
await browser.close();
for (const e of [A, B, P]) {
  for (const name of sql(
    `select name from storage.objects where bucket_id='photos' and name like '${uid(e)}/%'`,
  )
    .split("\n")
    .filter(Boolean)) {
    await fetch(`${API}/storage/v1/object/photos/${name}`, {
      method: "DELETE",
      headers: { apikey: KEY, authorization: `Bearer ${await token(e)}` },
    });
  }
}
sql("delete from auth.users where email like 'test-photos-%@example.test';");
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} tests réussis`);
process.exit(failed ? 1 : 0);
