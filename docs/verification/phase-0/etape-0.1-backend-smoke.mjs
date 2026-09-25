// YONA — Phase 0 / Étape 0.1 — Test de fumée du backend serveur (TanStack Start).
//
// Appelle directement le serveur buildé (.output/server/index.mjs) depuis Node,
// avec des variables Supabase FACTICES : aucune requête n'atteint la base réelle.
//
// Utilisation (depuis la racine du projet) :
//   npx vite build
//   node docs/verification/phase-0/etape-0.1-backend-smoke.mjs
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

process.env.SUPABASE_URL = "http://127.0.0.1:9";
process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_factice";

const root = process.cwd();
const require = createRequire(`${root}/package.json`);
const { toJSONAsync } = require("seroval");

// Identifiant de la fonction serveur likeProfile (généré au build).
const resolver = readdirSync(`${root}/.output/server`).find((f) =>
  f.includes("server-fn-resolver"),
);
const likeProfileId = readFileSync(`${root}/.output/server/${resolver}`, "utf8").match(
  /"([a-f0-9]{64})": \{\s*functionName: "likeProfile/,
)[1];

const { default: app } = await import(`${root}/.output/server/index.mjs`);
const base = "http://localhost:3000";
const fnPath = `/_serverFn/${likeProfileId}`;
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function call(label, path, init = {}) {
  const res = await app.fetch(new Request(base + path, init), {}, ctx);
  const body = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
  console.log(`\n### ${label}\n→ HTTP ${res.status}\n→ ${body}`);
}

const encode = async (data) => JSON.stringify(await toJSONAsync({ data }));
const headers = {
  "content-type": "application/json",
  "x-tsr-serverFn": "true",
  origin: base,
  "sec-fetch-site": "same-origin",
};
const forgedJwt = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig";
const payload = await encode({ receiverId: "00000000-0000-4000-8000-000000000001" });

for (const p of ["/", "/login", "/register", "/forgot-password", "/reset-password"]) {
  await call(`GET ${p}`, p);
}
await call("GET /discover (route protégée, SSR désactivé)", "/discover");
await call("GET /route-inexistante", "/route-inexistante");
await call("likeProfile sans jeton", fnPath, { method: "POST", headers, body: payload });
await call("likeProfile jeton mal formé", fnPath, {
  method: "POST",
  headers: { ...headers, authorization: "Bearer abc" },
  body: payload,
});
await call("likeProfile JWT falsifié", fnPath, {
  method: "POST",
  headers: { ...headers, authorization: forgedJwt },
  body: payload,
});
await call("likeProfile requête cross-site (CSRF)", fnPath, {
  method: "POST",
  headers: { ...headers, origin: "https://evil.example", "sec-fetch-site": "cross-site" },
  body: payload,
});
await call("likeProfile en GET", `${fnPath}?payload=x`, { method: "GET", headers });
process.exit(0);
