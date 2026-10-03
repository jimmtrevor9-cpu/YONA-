import { queryOptions } from "@tanstack/react-query";

import type { DocumentType } from "@/features/verification/verification.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tâche F — Vérification d'identité, côté navigateur : état de la vérification, envoi des
 * images dans l'espace privé « verifications », messages clairs pour chaque décision.
 */
export const VERIFICATION_TEXT =
  "Cette étape protège la communauté contre les faux profils. Chaque membre YONA confirme son identité par un selfie ou une pièce d'identité. Vos documents sont chiffrés, utilisés uniquement pour cette vérification, et ne sont jamais visibles par les autres membres.";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_card: "Carte d'identité",
  passport: "Passeport",
  student_card: "Carte d'étudiant",
  school_card: "Carte scolaire",
};

export interface MyVerificationStatus {
  verified: boolean;
  verifiedAt: string | null;
  attemptsLeft: number;
  maxAttempts: number;
  latest: {
    id: string;
    status: "processing" | "pending" | "approved" | "rejected";
    reason: string | null;
    documentType: string | null;
    createdAt: string;
  } | null;
}

export const myVerificationStatusQuery = (userId: string) =>
  queryOptions({
    queryKey: ["verification", "status", userId],
    queryFn: async (): Promise<MyVerificationStatus> => {
      const { data, error } = await supabase.rpc("my_verification_status");
      if (error) throw error;
      const d = data as {
        verified: boolean;
        verified_at: string | null;
        attempts_left: number;
        max_attempts: number;
        latest: {
          id: string;
          status: "processing" | "pending" | "approved" | "rejected";
          reason: string | null;
          document_type: string | null;
          created_at: string;
        } | null;
      };
      return {
        verified: d.verified,
        verifiedAt: d.verified_at,
        attemptsLeft: d.attempts_left,
        maxAttempts: d.max_attempts,
        latest: d.latest
          ? {
              id: d.latest.id,
              status: d.latest.status,
              reason: d.latest.reason,
              documentType: d.latest.document_type,
              createdAt: d.latest.created_at,
            }
          : null,
      };
    },
  });

/** Dépose une image (JPEG) à l'emplacement privé donné par le serveur. */
export async function uploadVerificationImage(path: string, image: Blob): Promise<void> {
  const { error } = await supabase.storage
    .from("verifications")
    .upload(path, image, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
}

/** Message affiché pour chaque motif de décision (refus ou attente). */
export const REASON_MESSAGES: Record<string, string> = {
  match: "Ton identité est vérifiée. Merci !",
  no_face:
    "Aucun visage n'a été trouvé sur le selfie. Place ton visage dans l'ovale, dans un endroit bien éclairé, puis réessaie.",
  multiple_faces:
    "Plusieurs visages sont visibles. Prends le selfie seul(e), sans personne derrière toi.",
  blurry:
    "L'image est floue. Tiens ton téléphone immobile, dans un endroit éclairé, puis réessaie.",
  not_frontal: "Pour la première photo, regarde bien l'objectif, le visage de face.",
  liveness_failed:
    "La consigne n'a pas été suivie : tourne lentement la tête du côté indiqué quand le message s'affiche.",
  wrong_direction: "Tu as tourné la tête du mauvais côté. Suis la flèche affichée à l'écran.",
  no_profile_face:
    "Aucune de tes photos de profil ne montre clairement ton visage. Ajoute une photo de toi, de face, puis réessaie.",
  document_no_face:
    "La photo de la pièce n'a pas pu être lue. Photographie-la entière, à plat, sans reflet, avec la photo bien visible.",
  mismatch:
    "Le visage du selfie ne correspond pas assez à tes photos de profil (ou à la photo de la pièce). Vérifie que tes photos de profil te montrent bien, puis réessaie.",
  files_missing: "L'envoi est incomplet (connexion coupée ?). Réessaie.",
  abandoned: "La vérification précédente n'a pas été terminée. Tu peux recommencer.",
  gray_zone:
    "Ta vérification demande un contrôle complémentaire par notre équipe. Tu recevras la réponse rapidement.",
  engine_unavailable:
    "La vérification automatique est momentanément indisponible. Ta demande est enregistrée et sera traitée rapidement.",
  manual: "Décision de l'équipe YONA.",
};

export const START_ERRORS: Record<string, string> = {
  already_verified: "Ton identité est déjà vérifiée.",
  consent_required: "Coche la case de consentement pour continuer.",
  too_many_attempts:
    "Tu as utilisé tous tes essais pour aujourd'hui. Réessaie demain, avec une meilleure lumière et une photo de profil bien nette.",
  verification_in_progress: "Une vérification est déjà en cours d'examen.",
  nothing_to_check: "Choisis un selfie ou une pièce d'identité.",
  account_inactive: "Ton compte n'est pas actif.",
  verification_not_found: "Cette vérification a expiré. Recommence.",
};

export function verificationErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const key = Object.keys(START_ERRORS).find((k) => message.includes(k));
  if (key) return START_ERRORS[key] ?? message;
  if (/exceeded|too large|payload/i.test(message)) return "Image trop lourde : 8 Mo maximum.";
  return "La vérification n'a pas pu aboutir. Vérifie ta connexion et réessaie.";
}

/** Image de la caméra → JPEG (côté le plus long : 1 280 px). Image non retournée (miroir). */
export function captureFrame(video: HTMLVideoElement, maxSide = 1280): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("capture_failed"))),
      "image/jpeg",
      0.9,
    ),
  );
}
