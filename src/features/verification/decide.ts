import type {
  AnalyzedImage,
  FaceMatchingProvider,
} from "@/features/verification/face-matching.provider";

/**
 * Tâche F — Règles de décision de la vérification d'identité (sans accès à la base).
 *  1. Selfie : exactement un visage, net, de face.
 *  2. Vivacité : 2e image prise après la consigne aléatoire (tourner la tête à gauche ou à
 *     droite) : même personne, tête tournée assez et du bon côté.
 *  3. Comparaison : selfie (ou pièce si pas de selfie) ↔ photos du profil ; selfie ↔ pièce.
 *     Toutes les ressemblances ≥ seuil d'acceptation → vérifié ; une sous le seuil de refus
 *     → refusé ; sinon → en attente (zone grise).
 */
export type VerificationStatus = "approved" | "rejected" | "pending";

export interface VerificationInputs {
  challenge: "turn_left" | "turn_right" | null;
  selfie: AnalyzedImage | null;
  challengeImage: AnalyzedImage | null;
  document: AnalyzedImage | null;
  profilePhotos: AnalyzedImage[];
}

export interface VerificationThresholds {
  accept: number;
  reject: number;
  livenessMinShift: number;
}

export interface VerificationDecision {
  status: VerificationStatus;
  reason: string;
  profileSimilarity: number | null;
  documentSimilarity: number | null;
  livenessSimilarity: number | null;
  livenessShift: number | null;
  details: Record<string, unknown>;
}

/** Au-delà, la tête n'est pas de face sur la première image (moteur local). */
const MAX_FRONT_YAW = 0.15;

/**
 * Visages qui comptent : détection sûre et taille comparable au visage principal (au moins
 * 30 % de sa surface). Un reflet ou une silhouette au loin n'est pas un 2e participant.
 */
export function significantFaces(image: AnalyzedImage): number {
  const main = image.faces[0];
  if (!main) return 0;
  const area = main.box.width * main.box.height;
  return image.faces.filter(
    (f, i) => i === 0 || (f.score >= 0.7 && f.box.width * f.box.height >= 0.3 * area),
  ).length;
}

export async function decideVerification(
  provider: Pick<FaceMatchingProvider, "similarity" | "directional">,
  input: VerificationInputs,
  t: VerificationThresholds,
): Promise<VerificationDecision> {
  const out: VerificationDecision = {
    status: "rejected",
    reason: "mismatch",
    profileSimilarity: null,
    documentSimilarity: null,
    livenessSimilarity: null,
    livenessShift: null,
    details: {
      faces: {
        selfie: input.selfie?.faces.length ?? null,
        challenge: input.challengeImage?.faces.length ?? null,
        document: input.document?.faces.length ?? null,
        profile: input.profilePhotos.map((p) => p.faces.length),
      },
    },
  };
  const reject = (reason: string) => ({ ...out, status: "rejected" as const, reason });
  let reference: AnalyzedImage;

  if (input.selfie) {
    const face = input.selfie.faces[0];
    if (!face) return reject("no_face");
    if (significantFaces(input.selfie) > 1) return reject("multiple_faces");
    if (face.blurry) return reject("blurry");
    if (provider.directional && Math.abs(face.yaw) > MAX_FRONT_YAW) return reject("not_frontal");

    const turned = input.challengeImage;
    const turnedFace = turned?.faces[0];
    if (!turned || !turnedFace) return reject("liveness_failed");
    if (significantFaces(turned) > 1) return reject("multiple_faces");
    out.livenessSimilarity = await provider.similarity(input.selfie, turned);
    if (out.livenessSimilarity === null || out.livenessSimilarity < t.reject) {
      return reject("liveness_failed");
    }
    out.livenessShift = turnedFace.yaw - face.yaw;
    if (Math.abs(out.livenessShift) < t.livenessMinShift) return reject("liveness_failed");
    if (provider.directional && input.challenge) {
      const expected = input.challenge === "turn_left" ? 1 : -1;
      if (Math.sign(out.livenessShift) !== expected) return reject("wrong_direction");
    }
    reference = input.selfie;
  } else {
    if (!input.document?.faces.length) return reject("document_no_face");
    reference = input.document;
  }

  const withFaces = input.profilePhotos.filter((p) => p.faces.length > 0);
  if (!withFaces.length) return reject("no_profile_face");
  const sims = await Promise.all(withFaces.map((p) => provider.similarity(reference, p)));
  const valid = sims.filter((s): s is number => s !== null);
  if (!valid.length) return reject("no_profile_face");
  out.profileSimilarity = Math.max(...valid);
  const scores = [out.profileSimilarity];

  if (input.selfie && input.document) {
    if (!input.document.faces.length) return reject("document_no_face");
    out.documentSimilarity = await provider.similarity(input.selfie, input.document);
    if (out.documentSimilarity === null) return reject("document_no_face");
    scores.push(out.documentSimilarity);
  }

  if (Math.min(...scores) < t.reject) return { ...out, status: "rejected", reason: "mismatch" };
  if (scores.every((s) => s >= t.accept)) return { ...out, status: "approved", reason: "match" };
  return { ...out, status: "pending", reason: "gray_zone" };
}
