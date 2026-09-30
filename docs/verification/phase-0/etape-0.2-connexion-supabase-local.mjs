// YONA — Phase 0 / Étape 0.2 — Vérifie que l'application se connecte à un projet Supabase
// choisi uniquement par configuration (ici : Supabase local lancé avec `supabase start`).
// Prérequis : build avec VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY du projet local,
// et un jeton de connexion d'un compte de TEST local dans /var/tmp/yona-local/jwt_a.txt.
import { createRequire } from "node:module";
import { readdirSync, readFileSync } from "node:fs";
process.env.SUPABASE_URL = "http://127.0.0.1:54321";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const root = process.cwd();
const { toJSONAsync } = createRequire(`${root}/package.json`)("seroval");
const r = readdirSync(`${root}/.output/server`).find((f) => f.includes("server-fn-resolver"));
const id = readFileSync(`${root}/.output/server/${r}`, "utf8").match(
  /"([a-f0-9]{64})": \{\s*functionName: "likeProfile/,
)[1];
const { default: app } = await import(`${root}/.output/server/index.mjs`);
const jwt = readFileSync("/var/tmp/yona-local/jwt_a.txt", "utf8").trim();
const body = JSON.stringify(
  await toJSONAsync({ data: { receiverId: "00000000-0000-4000-8000-000000000001" } }),
);
const h = {
  "content-type": "application/json",
  "x-tsr-serverFn": "true",
  origin: "http://localhost:3000",
  "sec-fetch-site": "same-origin",
};
for (const [label, auth] of [
  ["vrai jeton local", `Bearer ${jwt}`],
  ["jeton falsifié", `Bearer ${jwt.slice(0, -6)}AAAAAA`],
]) {
  const res = await app.fetch(
    new Request(`http://localhost:3000/_serverFn/${id}`, {
      method: "POST",
      headers: { ...h, authorization: auth },
      body,
    }),
    {},
    { waitUntil() {} },
  );
  const t = await res.text();
  console.log(
    `### ${label} → HTTP ${res.status}\n${(t.match(/"s":"([^"]+)"/g) || [t.slice(0, 200)]).join(" | ")}`,
  );
}
process.exit(0);
