// YONA — Redémarre le serveur local de test (build déjà fait) avec d'autres variables
// d'environnement serveur (fournisseur IA, paiement…). Usage : await restartServer({ AI_PROVIDER: "" })
import { execSync, spawn } from "node:child_process";

const BASE_ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  PAYMENT_PROVIDER: "test",
  AI_PROVIDER: "test",
  PORT: "4173",
};

export async function restartServer(overrides = {}) {
  try {
    execSync(`pkill -f "^node docs/verification/outils/serveur-local.mjs"`);
  } catch {}
  const env = { ...process.env, ...BASE_ENV, ...overrides };
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete env[k];
  const child = spawn("node", ["docs/verification/outils/serveur-local.mjs"], {
    env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await fetch("http://127.0.0.1:4173/");
      if (res.ok) return;
    } catch {}
  }
  throw new Error("Le serveur local n'a pas redémarré");
}
