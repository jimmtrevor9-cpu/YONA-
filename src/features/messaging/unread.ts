import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Messages non lus par conversation (seules les conversations avec au moins un non-lu). */
export type UnreadCounts = Record<string, number>;

/**
 * Non-lus de la personne connectée, calculés par la base (`get_unread_counts`) : messages
 * délivrés par l'autre personne après la dernière lecture, dans les conversations affichées.
 */
export const unreadCountsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["conversations", "unread", userId],
    queryFn: async (): Promise<UnreadCounts> => {
      const { data, error } = await supabase.rpc("get_unread_counts");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.conversation_id, row.unread]));
    },
    staleTime: 10 * 1000,
  });

export const totalUnread = (counts: UnreadCounts | undefined): number =>
  Object.values(counts ?? {}).reduce((sum, n) => sum + n, 0);

/** Texte court d'un compteur (au-delà de 99 : « 99+ »). */
export const unreadBadge = (n: number): string => (n > 99 ? "99+" : String(n));

export const unreadLabel = (n: number): string =>
  n === 1 ? "1 message non lu" : `${n} messages non lus`;

/**
 * Boîte de réception en direct : tout nouveau message lisible par la personne connectée
 * (la base n'envoie que ceux-là) rafraîchit la liste des conversations et les non-lus.
 * Renvoie `false` si le direct n'est pas établi (l'appelant vérifie alors régulièrement).
 */
export function useLiveInbox(userId: string): boolean {
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["conversations", "unread"] });
        void queryClient.invalidateQueries({ queryKey: ["conversations", "mine"] });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return live;
}

/** Nombre total de non-lus, tenu à jour en direct (ou toutes les 30 s sans direct). */
export function useUnreadTotal(userId: string): number {
  const live = useLiveInbox(userId);
  const { data } = useQuery({
    ...unreadCountsQuery(userId),
    enabled: !!userId,
    refetchInterval: live ? false : 30 * 1000,
  });
  return totalUnread(data);
}

/**
 * Marque la conversation ouverte comme lue : à l'ouverture, puis à chaque nouveau message
 * reçu tant que la page est affichée à l'écran (onglet visible).
 */
export function useMarkConversationRead(
  userId: string,
  conversationId: string,
  lastIncomingId: string | null,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const markedRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !userId || !conversationId) return;

    const mark = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      if (markedRef.current === lastIncomingId) return;
      markedRef.current = lastIncomingId;
      const { error } = await supabase.rpc("mark_conversation_read", {
        _conversation_id: conversationId,
      });
      if (error) {
        markedRef.current = undefined; // nouvel essai au prochain passage
        return;
      }
      queryClient.setQueryData<UnreadCounts>(unreadCountsQuery(userId).queryKey, (counts) => {
        if (!counts?.[conversationId]) return counts;
        const next = { ...counts };
        delete next[conversationId];
        return next;
      });
      // Un rafraîchissement lancé avant la lecture pourrait remettre l'ancien compte.
      void queryClient.invalidateQueries({ queryKey: ["conversations", "unread"] });
    };

    void mark();
    const onVisible = () => void mark();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [queryClient, userId, conversationId, lastIncomingId, enabled]);
}
