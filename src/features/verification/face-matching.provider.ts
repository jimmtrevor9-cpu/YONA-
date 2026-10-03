/**
 * Tâche F — Couche d'abstraction du moteur de comparaison de visages.
 *
 *  - « local » (par défaut, gratuit) : bibliothèque open source @vladmandic/face-api,
 *    exécutée par le serveur du site (moteur WebAssembly), modèles embarqués ;
 *  - « aws » : AWS Rekognition (service externe payant), activé par les variables
 *    d'environnement FACE_MATCH_PROVIDER=aws, AWS_REGION, AWS_ACCESS_KEY_ID,
 *    AWS_SECRET_ACCESS_KEY.
 *
 * Aucun résultat n'est jamais simulé : si le moteur ne peut pas fonctionner, la
 * vérification reste « en attente » (jamais « vérifiée »).
 * Code serveur uniquement (les moteurs sont chargés à la demande par le serveur).
 */

export interface FaceInfo {
  /** Confiance de la détection (0 à 1). */
  score: number;
  /** Cadre du visage, en fraction de l'image (0 à 1). */
  box: { x: number; y: number; width: number; height: number };
  /**
   * Rotation horizontale de la tête : 0 = de face ; positif = nez vers la droite de
   * l'image (le membre tourne la tête vers SA gauche), négatif = vers sa droite.
   */
  yaw: number;
  /** Image trop floue pour être fiable. */
  blurry: boolean;
  sharpness: number;
}

export interface AnalyzedImage {
  /** Visages trouvés, le plus grand d'abord. */
  faces: FaceInfo[];
  /** Données propres au moteur (empreintes des visages, image…). */
  ref: unknown;
}

export interface FaceMatchingProvider {
  readonly name: "local" | "aws";
  /** Le sens de rotation de la tête est-il fiable (consigne gauche / droite) ? */
  readonly directional: boolean;
  analyze(image: Uint8Array, options: { minSharpness: number }): Promise<AnalyzedImage>;
  /**
   * Ressemblance de 0 à 1 entre le visage principal de `a` et le visage le plus proche de
   * `b`. null si l'une des images n'a pas de visage.
   */
  similarity(a: AnalyzedImage, b: AnalyzedImage): Promise<number | null>;
}

/** Moteur indisponible (modèles, mémoire, service externe…) : la vérification reste en attente. */
export class FaceEngineUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceEngineUnavailableError";
  }
}

export function faceProviderName(): "local" | "aws" {
  return (process.env["FACE_MATCH_PROVIDER"] ?? "local").trim().toLowerCase() === "aws"
    ? "aws"
    : "local";
}

export async function getFaceMatchingProvider(): Promise<FaceMatchingProvider> {
  if (faceProviderName() === "aws") {
    const { createAwsProvider } = await import("@/features/verification/engine/aws.server");
    return createAwsProvider();
  }
  const { createLocalProvider } = await import("@/features/verification/engine/local.server");
  return createLocalProvider();
}
