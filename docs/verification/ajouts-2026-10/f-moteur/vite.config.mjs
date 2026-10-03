// Empaquette essai-moteur.ts comme le code serveur du site (module virtuel des modèles,
// WebAssembly), puis : node node_modules/.cache/yona-essai-moteur/essai-moteur.js
import { defineConfig } from "vite";

import config from "../../../../vite.config.ts";

const base =
  typeof config === "function" ? config({ command: "serve", mode: "production" }) : config;
const plugin = base.plugins.find((p) => p && p.name === "yona-face-engine-assets");
const root = new URL("../../../../", import.meta.url).pathname;

export default defineConfig({
  root,
  publicDir: false,
  plugins: [plugin],
  resolve: { alias: { "@": `${root}src` } },
  build: {
    ssr: new URL("./essai-moteur.ts", import.meta.url).pathname,
    // Dans node_modules : le module natif « sharp » y est trouvé.
    outDir: `${root}node_modules/.cache/yona-essai-moteur`,
    target: "node22",
    emptyOutDir: true,
    rollupOptions: { output: { format: "esm" } },
  },
  ssr: { noExternal: true, external: ["sharp"] },
});
