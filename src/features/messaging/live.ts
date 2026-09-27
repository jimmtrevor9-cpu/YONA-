import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import {
  conversationMessagesQuery,
  mergeThreadMessage,
  toThreadMessage,
  type MessageRow,
} from "./queries";

/**
 * Réception en direct des nouveaux messages d'une conversation (Supabase Realtime).
 * La base n'envoie que les messages que la personne a le droit de lire (mêmes règles
 * d'accès que la lecture normale). Renvoie `false` si la connexion en direct n'est pas
 * établie : l'appelant recharge alors régulièrement les messages.
 */
export function useLiveConversation(userId: string, conversationId: string): boolean {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!userId || !conversationId) return;
    const { queryKey } = conversationMessagesQuery(userId, conversationId);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageRow;
          if (!row?.id || row.status === "deleted") return;
          queryClient.setQueryData(queryKey, (list) =>
            mergeThreadMessage(list, toThreadMessage(row, userId)),
          );
          void queryClient.invalidateQueries({ queryKey: ["conversations", "mine"] });
        },
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        // Reconnexion : rattraper les messages arrivés pendant la coupure.
        if (status === "SUBSCRIBED") void queryClient.invalidateQueries({ queryKey });
      });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId, conversationId]);

  return live;
}
