import { decodeImage, sharpness } from "@/features/verification/engine/image.server";
import {
  FaceEngineUnavailableError,
  type AnalyzedImage,
  type FaceInfo,
  type FaceMatchingProvider,
} from "@/features/verification/face-matching.provider";

/**
 * Moteur local et gratuit : @vladmandic/face-api (détection SSD MobileNet, 68 points du
 * visage, empreinte du visage à 128 nombres), exécuté par le serveur avec le moteur
 * WebAssembly de TensorFlow. Modèles et moteur embarqués (module virtuel de vite.config.ts).
 * Ressemblance = 1 − distance euclidienne entre les deux empreintes (même personne en
 * général au-dessus de 0,5 ; personnes différentes en dessous de 0,4).
 */
type FaceApi = typeof import("@vladmandic/face-api/dist/face-api.esm-nobundle.js");

/** Fonctions de TensorFlow utilisées ici (l'instance fournie par face-api, typée en partie). */
interface TfRuntime {
  env(): { set(flag: string, value: unknown): void };
  setWasmPaths(paths: Record<string, string>, usePlatformFetch?: boolean): void;
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  io: { decodeWeights(buffer: ArrayBuffer, specs: unknown[]): unknown };
  tensor3d(
    values: Uint8Array,
    shape: [number, number, number],
    dtype?: "int32" | "float32",
  ): { dispose(): void };
}

interface LocalRef {
  descriptors: Float32Array[];
}

let enginePromise: Promise<FaceApi> | null = null;

async function loadEngine(): Promise<FaceApi> {
  const faceapi = await import("@vladmandic/face-api/dist/face-api.esm-nobundle.js");
  const { models, wasm } = await import("virtual:yona-face-engine-assets");
  const tf = faceapi.tf as unknown as TfRuntime;
  const plain = `data:application/wasm;base64,${wasm["tfjs-backend-wasm.wasm"]}`;
  const simd = `data:application/wasm;base64,${wasm["tfjs-backend-wasm-simd.wasm"]}`;
  // Le chargeur WebAssembly de TensorFlow lit `__dirname` (variable des modules CommonJS),
  // absente du code serveur ESM : on lui en donne une (le fichier .wasm vient de la mémoire).
  const g = globalThis as { __dirname?: string };
  g.__dirname ??= "/";
  tf.env().set("WASM_HAS_MULTITHREAD_SUPPORT", false);
  tf.setWasmPaths(
    {
      "tfjs-backend-wasm.wasm": plain,
      "tfjs-backend-wasm-simd.wasm": simd,
      "tfjs-backend-wasm-threaded-simd.wasm": simd,
    },
    true,
  );
  if (!(await tf.setBackend("wasm"))) throw new Error("WebAssembly indisponible");
  await tf.ready();
  const nets: [string, { loadFromWeightMap(map: unknown): Promise<void> | void }][] = [
    ["ssd_mobilenetv1_model", faceapi.nets.ssdMobilenetv1],
    ["face_landmark_68_model", faceapi.nets.faceLandmark68Net],
    ["face_recognition_model", faceapi.nets.faceRecognitionNet],
  ];
  for (const [name, net] of nets) {
    const model = models[name];
    if (!model) throw new Error(`Modèle manquant : ${name}`);
    const manifest = model.manifest as { weights: unknown[] }[];
    const bytes = Buffer.from(model.data, "base64");
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const map = tf.io.decodeWeights(
      buffer,
      manifest.flatMap((g) => g.weights),
    );
    await net.loadFromWeightMap(map);
  }
  return faceapi;
}

function engine(): Promise<FaceApi> {
  enginePromise ??= loadEngine().catch((error: unknown) => {
    enginePromise = null;
    throw new FaceEngineUnavailableError(
      `Moteur de visages indisponible : ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  return enginePromise;
}

export function createLocalProvider(): FaceMatchingProvider {
  return {
    name: "local",
    directional: true,
    async analyze(bytes, { minSharpness }) {
      const faceapi = await engine();
      const image = await decodeImage(bytes);
      const tf = faceapi.tf as unknown as TfRuntime;
      const input = tf.tensor3d(image.data, [image.height, image.width, 3], "int32");
      try {
        const found = await faceapi
          .detectAllFaces(input as never, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        const items = await Promise.all(
          found.map(async (f) => {
            const b = f.detection.box;
            const pts = f.landmarks.positions;
            const left = pts[0];
            const right = pts[16];
            const nose = pts[30];
            const ratio =
              left && right && nose && right.x !== left.x
                ? (nose.x - left.x) / (right.x - left.x)
                : 0.5;
            const sharp = await sharpness(image, b).catch(() => 0);
            const info: FaceInfo = {
              score: f.detection.score,
              box: {
                x: b.x / image.width,
                y: b.y / image.height,
                width: b.width / image.width,
                height: b.height / image.height,
              },
              yaw: ratio - 0.5,
              sharpness: sharp,
              blurry: sharp < minSharpness,
            };
            return { info, descriptor: f.descriptor, area: b.width * b.height };
          }),
        );
        items.sort((a, b) => b.area - a.area);
        const ref: LocalRef = { descriptors: items.map((i) => i.descriptor) };
        return { faces: items.map((i) => i.info), ref } satisfies AnalyzedImage;
      } finally {
        input.dispose();
      }
    },
    async similarity(a, b) {
      const faceapi = await engine();
      const main = (a.ref as LocalRef).descriptors[0];
      const others = (b.ref as LocalRef).descriptors;
      if (!main || !others.length) return null;
      const best = Math.min(...others.map((d) => faceapi.euclideanDistance(main, d)));
      return Math.max(0, Math.min(1, 1 - best));
    },
  };
}
