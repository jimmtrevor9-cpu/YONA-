import { queryOptions } from "@tanstack/react-query";

import { adminErrorMessage } from "@/features/admin/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Tâche F — Administration de la vérification automatique : cas incertains et réglages. */
export type QueueRow =
  Database["public"]["Functions"]["admin_verification_queue"]["Returns"][number];
export type VerificationSettings = Database["public"]["Tables"]["verification_settings"]["Row"];

export const verificationQueueQuery = () =>
  queryOptions({
    queryKey: ["admin", "verification-queue"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_verification_queue");
      if (error) throw new Error(adminErrorMessage(error.message));
      const rows = data ?? [];
      const paths = rows.flatMap((r) =>
        [r.storage_path, r.challenge_path, r.document_path].filter((p): p is string => !!p),
      );
      const urls = new Map<string, string>();
      if (paths.length) {
        // Liens temporaires (10 minutes) : les images restent privées.
        const { data: signed } = await supabase.storage
          .from("verifications")
          .createSignedUrls(paths, 600);
        signed?.forEach((s, i) => {
          const p = paths[i];
          if (p && s.signedUrl) urls.set(p, s.signedUrl);
        });
      }
      return rows.map((r) => ({
        ...r,
        selfieUrl: r.method === "selfie" ? (urls.get(r.storage_path) ?? null) : null,
        challengeUrl: r.challenge_path ? (urls.get(r.challenge_path) ?? null) : null,
        documentUrl:
          r.method === "selfie"
            ? r.document_path
              ? (urls.get(r.document_path) ?? null)
              : null
            : (urls.get(r.storage_path) ?? null),
      }));
    },
  });

export const verificationSettingsQuery = () =>
  queryOptions({
    queryKey: ["admin", "verification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("verification_settings")
        .select("*")
        .maybeSingle();
      if (error) throw new Error(adminErrorMessage(error.message));
      return data;
    },
  });

export async function saveVerificationSettings(
  values: Partial<Omit<VerificationSettings, "id" | "updated_at">>,
) {
  const { error } = await supabase.from("verification_settings").update(values).eq("id", true);
  if (error) {
    if (error.message.includes("_order")) {
      throw new Error("Le seuil de refus doit être inférieur ou égal au seuil d'acceptation.");
    }
    throw new Error(adminErrorMessage(error.message));
  }
}

export async function reviewQueued(id: string, approve: boolean) {
  const { error } = await supabase.rpc("admin_review_verification", {
    _verification_id: id,
    _approve: approve,
  });
  if (error) throw new Error(adminErrorMessage(error.message));
}

export const REASON_LABELS: Record<string, string> = {
  gray_zone: "Zone grise (ressemblance incertaine)",
  engine_unavailable: "Moteur indisponible",
};

export const DOC_LABELS: Record<string, string> = {
  id_card: "Carte d'identité",
  passport: "Passeport",
  student_card: "Carte d'étudiant",
  school_card: "Carte scolaire",
};
