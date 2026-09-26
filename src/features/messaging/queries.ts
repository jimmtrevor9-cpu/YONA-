import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface ConversationSummary {
  conversationId: string;
  userId: string;
  firstName: string | null;
  photoUrl: string | null;
  /** Dernier message lisible (livré, ou envoyé par la personne connectée). */
  lastMessage: { content: string; fromMe: boolean; at: string } | null;
  /** Date utilisée pour le tri : dernier message, sinon création de la conversation. */
  activityAt: string;
}

/**
 * Conversations de la personne connectée, la plus récente activité d'abord.
 * Tout passe par les règles d'accès existantes (participants seulement). Une conversation
 * n'est affichée que si son Match est actif, si elle n'est pas fermée et si le profil de
 * l'autre personne reste visible (mêmes règles que la liste des Matchs).
 */
export const myConversationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["conversations", "mine", userId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id, match_id, user_1_id, user_2_id, created_at")
        .neq("status", "closed");
      if (error) throw error;
      if (!conversations?.length) return [];

      const others = conversations.map((c) => (c.user_1_id === userId ? c.user_2_id : c.user_1_id));
      const [matchesRes, profilesRes, photosRes, lastMessages] = await Promise.all([
        supabase
          .from("matches")
          .select("id")
          .in(
            "id",
            conversations.map((c) => c.match_id),
          )
          .eq("status", "active"),
        supabase.from("profiles").select("user_id, first_name").in("user_id", others),
        supabase
          .from("photos")
          .select("user_id, storage_path")
          .in("user_id", others)
          .eq("is_primary", true)
          .eq("status", "approved"),
        Promise.all(
          conversations.map((c) =>
            supabase
              .from("messages")
              .select("content, sender_id, created_at")
              .eq("conversation_id", c.id)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        ),
      ]);
      if (matchesRes.error) throw matchesRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (photosRes.error) throw photosRes.error;
      for (const res of lastMessages) if (res.error) throw res.error;

      const urls = new Map<string, string>();
      if (photosRes.data?.length) {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
          photosRes.data.map((p) => p.storage_path),
          60 * 60,
        );
        photosRes.data.forEach((p, i) => {
          const url = signed?.[i]?.signedUrl;
          if (url) urls.set(p.user_id, url);
        });
      }

      const activeMatches = new Set((matchesRes.data ?? []).map((m) => m.id));
      const profiles = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p]));
      return conversations
        .flatMap((c, i) => {
          const other = c.user_1_id === userId ? c.user_2_id : c.user_1_id;
          const profile = profiles.get(other);
          if (!activeMatches.has(c.match_id) || !profile) return [];
          const last = lastMessages[i]?.data ?? null;
          return [
            {
              conversationId: c.id,
              userId: other,
              firstName: profile.first_name,
              photoUrl: urls.get(other) ?? null,
              lastMessage: last
                ? { content: last.content, fromMe: last.sender_id === userId, at: last.created_at }
                : null,
              activityAt: last?.created_at ?? c.created_at,
            },
          ];
        })
        .sort((a, b) => b.activityAt.localeCompare(a.activityAt));
    },
    staleTime: 15 * 1000,
  });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConversationHeader {
  conversationId: string;
  matchId: string;
  status: "open" | "locked" | "closed";
  userId: string;
  firstName: string | null;
  photoUrl: string | null;
}

/**
 * Conversation ouverte depuis la messagerie. `null` si l'adresse est mal formée, si la
 * conversation n'existe pas, est fermée, n'appartient pas à la personne connectée, si son
 * Match n'est plus actif ou si le profil de l'autre personne n'est plus visible
 * (règles d'accès existantes, mêmes conditions que la liste des conversations).
 */
export const conversationQuery = (userId: string, conversationId: string) =>
  queryOptions({
    queryKey: ["conversations", "one", userId, conversationId],
    queryFn: async (): Promise<ConversationHeader | null> => {
      if (!UUID_PATTERN.test(conversationId)) return null;
      const { data: conversation, error } = await supabase
        .from("conversations")
        .select("id, match_id, user_1_id, user_2_id, status")
        .eq("id", conversationId)
        .neq("status", "closed")
        .maybeSingle();
      if (error) throw error;
      if (!conversation) return null;
      const other =
        conversation.user_1_id === userId ? conversation.user_2_id : conversation.user_1_id;

      const [matchRes, profileRes, photoRes] = await Promise.all([
        supabase
          .from("matches")
          .select("id")
          .eq("id", conversation.match_id)
          .eq("status", "active")
          .maybeSingle(),
        supabase.from("profiles").select("first_name").eq("user_id", other).maybeSingle(),
        supabase
          .from("photos")
          .select("storage_path")
          .eq("user_id", other)
          .eq("is_primary", true)
          .eq("status", "approved")
          .maybeSingle(),
      ]);
      if (matchRes.error) throw matchRes.error;
      if (profileRes.error) throw profileRes.error;
      if (photoRes.error) throw photoRes.error;
      if (!matchRes.data || !profileRes.data) return null;

      let photoUrl: string | null = null;
      if (photoRes.data) {
        const { data: signed } = await supabase.storage
          .from("photos")
          .createSignedUrl(photoRes.data.storage_path, 60 * 60);
        photoUrl = signed?.signedUrl ?? null;
      }

      return {
        conversationId: conversation.id,
        matchId: conversation.match_id,
        status: conversation.status,
        userId: other,
        firstName: profileRes.data.first_name,
        photoUrl,
      };
    },
    staleTime: 30 * 1000,
  });
