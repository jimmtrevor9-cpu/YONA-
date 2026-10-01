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
  /** Fin du dernier déblocage terminé (quand aucun n'est en cours). */
  lastUnlockExpiredAt: string | null;
  /** Membre Premium : messages illimités (vérifié par le serveur). */
  premium: boolean;
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
        lastUnlockExpiredAt: row.last_unlock_expired_at,
        premium: row.premium,
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

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

/** « mardi 30 septembre à 17:58 » (heure locale de la personne). */
export function formatUnlockDate(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** Temps restant avant la fin : « 2 j 5 h », « 5 h 12 min », « 45 min », « moins d'1 min ». */
export function formatRemaining(iso: string, now = Date.now()): string {
  const minutes = Math.floor((new Date(iso).getTime() - now) / 60000);
  if (minutes < 1) return "moins d'1 min";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours > 0 ? `${days} j ${hours} h` : `${days} j`;
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  return `${mins} min`;
}
