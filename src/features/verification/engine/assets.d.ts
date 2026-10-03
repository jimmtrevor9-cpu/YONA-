// Module virtuel produit par vite.config.ts (faceEngineAssets) : code serveur seulement.
declare module "virtual:yona-face-engine-assets" {
  /** Modèles de visage : manifeste des poids et données binaires (base64). */
  export const models: Record<string, { manifest: unknown; data: string }>;
  /** Moteur WebAssembly de TensorFlow (base64), par nom de fichier. */
  export const wasm: Record<string, string>;
}
