// Configuration Vite du site YONA, prévue pour un déploiement sur Vercel.
// (Elle remplace l'ancien paquet @lovable.dev/vite-tanstack-config.)
//
// - En ligne (Vercel) : la construction produit le dossier .vercel/output que Vercel publie.
// - En local : NITRO_PRESET permet de choisir une autre cible (les tests locaux
//   utilisent « cloudflare-module », voir docs/verification/outils/demarrer-test-local.sh).
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

/**
 * Moteur de vérification d'identité (tâche F) : modèles de visage (@vladmandic/face-api) et
 * moteur WebAssembly de TensorFlow, embarqués dans le code du SERVEUR seulement, sous forme
 * d'un module virtuel (aucun fichier à servir, aucun service extérieur).
 */
function faceEngineAssets(): Plugin {
  const id = "virtual:yona-face-engine-assets";
  const models = ["ssd_mobilenetv1_model", "face_landmark_68_model", "face_recognition_model"];
  const wasmFiles = ["tfjs-backend-wasm.wasm", "tfjs-backend-wasm-simd.wasm"];
  return {
    name: "yona-face-engine-assets",
    resolveId(source) {
      return source === id ? `\0${id}` : null;
    },
    load(resolved) {
      if (resolved !== `\0${id}`) return null;
      const modelDir = resolve("node_modules/@vladmandic/face-api/model");
      const wasmDir = resolve("node_modules/@tensorflow/tfjs-backend-wasm/dist");
      const out: Record<string, { manifest: unknown; data: string }> = {};
      for (const name of models) {
        const manifest = JSON.parse(
          readFileSync(`${modelDir}/${name}-weights_manifest.json`, "utf8"),
        );
        const paths = (manifest as { paths: string[] }[]).flatMap((g) => g.paths);
        const data = Buffer.concat(paths.map((p) => readFileSync(`${modelDir}/${p}`)));
        out[name] = { manifest, data: data.toString("base64") };
      }
      const wasm = Object.fromEntries(
        wasmFiles.map((f) => [f, readFileSync(`${wasmDir}/${f}`).toString("base64")]),
      );
      return `export const models = ${JSON.stringify(out)};\nexport const wasm = ${JSON.stringify(wasm)};\n`;
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    faceEngineAssets(),
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Le code serveur ne doit jamais se retrouver dans le navigateur.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Point d'entrée serveur : src/server.ts (page d'erreur propre en cas de panne).
      server: { entry: "server" },
    }),
    ...(command === "build"
      ? [
          nitro({
            preset: process.env["NITRO_PRESET"] || "vercel",
            // Vérification d'identité : analyse des visages en quelques secondes (60 s max).
            vercel: { functions: { maxDuration: 60 } },
          }),
        ]
      : []),
    viteReact(),
  ],
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: { host: "::", port: 8080 },
}));
