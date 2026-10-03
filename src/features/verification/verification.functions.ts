import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tâche F — Vérification d'identité automatique, côté serveur.
 *  1. startIdentityVerification : consentement, essais du jour, consigne aléatoire ; renvoie
 *     les emplacements privés où le navigateur dépose les images.
 *  2. completeIdentityVerification : comparaison des visages et décision automatique.
 */
export const DOCUMENT_TYPES = ["id_card", "passport", "student_card", "school_card"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface VerificationStart {
  id: string;
  challenge: "turn_left" | "turn_right" | null;
  selfiePath: string | null;
  challengePath: string | null;
  documentPath: string | null;
  attemptsLeft: number;
}

const KNOWN_ERRORS = [
  "already_verified",
  "consent_required",
  "too_many_attempts",
  "verification_in_progress",
  "nothing_to_check",
  "account_inactive",
  "invalid_document_type",
  "verification_not_found",
];

function errorCode(message: string): string {
  return KNOWN_ERRORS.find((k) => message.includes(k)) ?? "verification_failed";
}

export const startIdentityVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        withSelfie: z.boolean(),
        documentType: z.enum(DOCUMENT_TYPES).optional(),
        consent: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<VerificationStart> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: started, error } = await supabaseAdmin.rpc("start_identity_verification", {
      _user_id: context.userId,
      _with_selfie: data.withSelfie,
      _consent: data.consent,
      ...(data.documentType ? { _document_type: data.documentType } : {}),
    });
    if (error) throw new Error(errorCode(error.message));
    const s = started as {
      id: string;
      challenge: VerificationStart["challenge"];
      selfie_path: string | null;
      challenge_path: string | null;
      document_path: string | null;
      attempts_left: number;
    };
    return {
      id: s.id,
      challenge: s.challenge,
      selfiePath: s.selfie_path,
      challengePath: s.challenge_path,
      documentPath: s.document_path,
      attemptsLeft: s.attempts_left,
    };
  });

export const completeIdentityVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { runVerification } = await import("@/features/verification/verification.server");
    try {
      return await runVerification(context.userId, data.id);
    } catch (error) {
      throw new Error(errorCode(error instanceof Error ? error.message : String(error)));
    }
  });

/** Administration : moteur utilisé (variables d'environnement du serveur, jamais les clés). */
export const verificationEngineInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("admin_required");
    const { faceProviderName } = await import("@/features/verification/face-matching.provider");
    const provider = faceProviderName();
    return {
      provider,
      awsConfigured: !!(
        process.env["AWS_REGION"] &&
        process.env["AWS_ACCESS_KEY_ID"] &&
        process.env["AWS_SECRET_ACCESS_KEY"]
      ),
    };
  });
