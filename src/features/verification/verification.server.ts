import { decideVerification, type VerificationDecision } from "@/features/verification/decide";
import {
  getFaceMatchingProvider,
  faceProviderName,
  type AnalyzedImage,
} from "@/features/verification/face-matching.provider";

/**
 * Tâche F — Analyse d'une tentative de vérification (serveur, clé service) : récupère les
 * images privées (selfie, consigne, pièce) et les photos du profil, compare les visages,
 * enregistre la décision. Les images sont ensuite supprimées (file de suppression).
 */
export interface VerificationOutcome {
  status: "approved" | "rejected" | "pending";
  reason: string;
  verified: boolean;
}

async function download(bucket: string, path: string | null): Promise<Uint8Array | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function runVerification(
  userId: string,
  attemptId: string,
): Promise<VerificationOutcome> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { logServerError } = await import("@/features/journal/server-errors.server");
  const { data: attempt } = await supabaseAdmin
    .from("profile_verifications")
    .select("id, user_id, method, status, storage_path, challenge, challenge_path, document_path")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId || attempt.status !== "processing") {
    throw new Error("verification_not_found");
  }
  const { data: settings } = await supabaseAdmin
    .from("verification_settings")
    .select("*")
    .maybeSingle();

  const withSelfie = attempt.method === "selfie";
  const documentPath = withSelfie ? attempt.document_path : attempt.storage_path;

  async function record(
    decision: Pick<VerificationDecision, "status" | "reason"> & Partial<VerificationDecision>,
    engine: string,
  ) {
    const { data, error } = await supabaseAdmin.rpc("record_verification_result", {
      _id: attemptId,
      _status: decision.status,
      _reason: decision.reason,
      _engine: engine,
      ...(decision.profileSimilarity != null
        ? { _profile_similarity: round(decision.profileSimilarity) }
        : {}),
      ...(decision.documentSimilarity != null
        ? { _document_similarity: round(decision.documentSimilarity) }
        : {}),
      ...(decision.livenessSimilarity != null
        ? { _liveness_similarity: round(decision.livenessSimilarity) }
        : {}),
      ...(decision.livenessShift != null ? { _liveness_shift: round(decision.livenessShift) } : {}),
      _details: (decision.details ?? {}) as never,
    });
    if (error) throw new Error(error.message);
    // Images supprimées tout de suite après une décision (file de suppression).
    try {
      const { processStorageCleanup } = await import("@/features/admin/storage-cleanup.server");
      await processStorageCleanup();
    } catch {
      // Le nettoyage régulier s'en chargera.
    }
    const d = (data ?? {}) as {
      status?: VerificationOutcome["status"];
      reason?: string;
      verified?: boolean;
    };
    return {
      status: d.status ?? decision.status,
      reason: d.reason ?? decision.reason,
      verified: d.verified === true,
    } satisfies VerificationOutcome;
  }

  const [selfie, turned, document] = await Promise.all([
    withSelfie ? download("verifications", attempt.storage_path) : Promise.resolve(null),
    withSelfie ? download("verifications", attempt.challenge_path) : Promise.resolve(null),
    download("verifications", documentPath),
  ]);
  if ((withSelfie && (!selfie || !turned)) || (documentPath && !document)) {
    return record({ status: "rejected", reason: "files_missing" }, faceProviderName());
  }

  const { data: photos } = await supabaseAdmin
    .from("photos")
    .select("storage_path, is_primary")
    .eq("user_id", userId)
    .in("status", ["approved", "pending"])
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(5);

  try {
    const provider = await getFaceMatchingProvider();
    const minSharpness = Number(settings?.min_sharpness ?? 15);
    // Une image à la fois : mémoire limitée sur le serveur.
    const analyze = async (bytes: Uint8Array | null) =>
      bytes ? provider.analyze(bytes, { minSharpness }) : null;
    const selfieA = await analyze(selfie);
    const turnedA = await analyze(turned);
    const documentA = await analyze(document);
    const profileA: AnalyzedImage[] = [];
    for (const p of photos ?? []) {
      const bytes = await download("photos", p.storage_path);
      if (!bytes) continue;
      try {
        const a = await analyze(bytes);
        if (a) profileA.push(a);
      } catch {
        // Photo illisible : ignorée.
      }
    }
    const aws = provider.name === "aws";
    const decision = await decideVerification(
      provider,
      {
        challenge: (attempt.challenge as "turn_left" | "turn_right" | null) ?? null,
        selfie: selfieA,
        challengeImage: turnedA,
        document: documentA,
        profilePhotos: profileA,
      },
      {
        accept: Number(
          aws ? (settings?.aws_accept_similarity ?? 0.95) : (settings?.accept_similarity ?? 0.55),
        ),
        reject: Number(
          aws ? (settings?.aws_reject_similarity ?? 0.8) : (settings?.reject_similarity ?? 0.4),
        ),
        livenessMinShift: Number(settings?.liveness_min_shift ?? 0.08),
      },
    );
    return await record(decision, provider.name);
  } catch (error) {
    // Moteur indisponible (ou erreur imprévue) : jamais « vérifié », la demande reste en attente.
    await logServerError("verification", error, { userId, details: { tentative: attemptId } });
    return record({ status: "pending", reason: "engine_unavailable" }, faceProviderName());
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
