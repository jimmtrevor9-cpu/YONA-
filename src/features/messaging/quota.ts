import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface MessageQuota {
  used: number;
  limit: number;
  remaining: number;
  /** Quota gratuit épuisé (signal du serveur) : déclenche l'offre de déblocage. */
  exhausted: boolean;
  /** Conversation débloquée (pour les deux participants), vérifié par le serveur. */
  unlocked: boolean;
  /** Personne qui a payé le déblocage en cours. */
  unlockedBy: string | null;
  /** Fin de la période débloquée (date ISO). */
  unlockExpiresAt: string | null;
}

/**
 * Quota de messages gratuits de la personne connectée dans une conversation (compteur
 * tenu par le serveur, `get_message_quota`). Rafraîchi après chaque envoi ou refus.
 */
export const messageQuotaQuery = (userId: string, conversationId: string) =>
  queryOptions({
    queryKey: ["conversations", "quota", userId, conversationId],
    queryFn: async (): Promise<MessageQuota> => {
      const { data, error } = await supabase.rpc("get_message_quota", {
        _conversation_id: conversationId,
      });
      if (error) throw error;
      const row = data?.[0];
      if (!row) throw new Error("Quota indisponible.");
      return {
        used: row.used,
        limit: row.quota_limit,
        remaining: row.remaining,
        exhausted: row.exhausted,
        unlocked: row.unlocked,
        unlockedBy: row.unlocked_by,
        unlockExpiresAt: row.unlock_expires_at,
      };
    },
    staleTime: 30 * 1000,
  });

/** Texte affiché sous le champ de message. */
export function remainingLabel(remaining: number): string {
  if (remaining <= 0) return "Vous avez utilisé vos 3 messages gratuits dans cette conversation.";
  return remaining === 1
    ? "1 message gratuit restant dans cette conversation"
    : `${remaining} messages gratuits restants dans cette conversation`;
}
