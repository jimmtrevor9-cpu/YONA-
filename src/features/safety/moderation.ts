import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ReportReason = Database["public"]["Enums"]["report_reason"];

/** Motifs de signalement (22.1), dans l'ordre affiché. */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "fake_profile", label: "Faux profil" },
  { value: "harassment", label: "Harcèlement" },
  { value: "inappropriate_content", label: "Contenu inapproprié" },
  { value: "scam", label: "Arnaque ou demande d'argent" },
  { value: "suspicious_behavior", label: "Comportement suspect" },
  { value: "other", label: "Autre" },
];

export const REPORT_DESCRIPTION_MAX = 2000;

const ERRORS: Record<string, string> = {
  invalid_target: "Ce membre n'est pas disponible.",
  reason_required: "Choisissez un motif.",
  description_too_long: `La description ne doit pas dépasser ${REPORT_DESCRIPTION_MAX} caractères.`,
  invalid_message: "Ce message ne peut pas être signalé.",
  report_daily_limit: "Vous avez atteint la limite de signalements pour aujourd'hui.",
};

function friendly(error: { message: string }, fallback: string): Error {
  const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
  return new Error(key ? ERRORS[key] : fallback);
}

/** 21.1 — Bloque un membre : Match et conversation fermés côté serveur. */
export async function blockUser(userId: string) {
  const { error } = await supabase.rpc("block_user", { _user_id: userId });
  if (error) throw friendly(error, "Le blocage n'a pas pu être enregistré. Réessayez.");
}

/** 21.5 — Débloque un membre (le Match fermé n'est pas rouvert). */
export async function unblockUser(userId: string) {
  const { error } = await supabase.rpc("unblock_user", { _user_id: userId });
  if (error) throw friendly(error, "Le déblocage n'a pas pu être enregistré. Réessayez.");
}

/** 22.1 / 22.2 — Signale un profil, ou un message précis de ce membre. */
export async function reportUser(input: {
  userId: string;
  reason: ReportReason;
  description?: string;
  messageId?: string;
}) {
  const { error } = await supabase.rpc("report_user", {
    _user_id: input.userId,
    _reason: input.reason,
    ...(input.description?.trim() ? { _description: input.description.trim() } : {}),
    ...(input.messageId ? { _message_id: input.messageId } : {}),
  });
  if (error) throw friendly(error, "Le signalement n'a pas pu être envoyé. Réessayez.");
}
