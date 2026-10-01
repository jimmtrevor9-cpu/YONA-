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
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [
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
    ...(command === "build" ? [nitro({ preset: process.env["NITRO_PRESET"] || "vercel" })] : []),
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
