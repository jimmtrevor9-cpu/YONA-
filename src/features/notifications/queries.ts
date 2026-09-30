import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  "like" | "match" | "message" | "favorite" | "visit" | "contact_request";

export interface AppNotification {
  id: string;
  type: NotificationType;
  /** Auteur (masqué par le serveur pour « favori » et « visite » hors Premium). */
  actorId: string | null;
  actorName: string | null;
  data: {
    match_id?: string;
    conversation_id?: string;
    request_id?: string;
    is_flash?: boolean;
    count?: number;
  };
  readAt: string | null;
  createdAt: string;
}

export const notificationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["notifications", "list", userId],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase.rpc("list_notifications", { _limit: 100 });
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        type: n.type as NotificationType,
        actorId: n.actor_id,
        actorName: n.actor_first_name,
        data: (n.data ?? {}) as AppNotification["data"],
        readAt: n.read_at,
        createdAt: n.created_at,
      }));
    },
    staleTime: 15 * 1000,
  });

/** 19.8 — Nombre de notifications non lues (relu toutes les 30 s). */
export const unreadNotificationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["notifications", "unread", userId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_unread_notification_count");
      if (error) throw error;
      return data ?? 0;
    },
    refetchInterval: 30 * 1000,
    staleTime: 10 * 1000,
  });

/** 19.9 — Marquer comme lue(s). */
export async function markNotificationRead(id: string) {
  const { error } = await supabase.rpc("mark_notification_read", { _id: id });
  if (error) throw error;
}
export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}

/** Texte d'une notification (prénom caché si le serveur ne l'a pas transmis). */
export function notificationText(n: AppNotification): string {
  const who = n.actorName ?? "Quelqu'un";
  const count = n.data.count ?? 1;
  switch (n.type) {
    case "like":
      return `${who} vous a envoyé un Like.`;
    case "match":
      return `Nouveau Match avec ${who} ! Vous pouvez vous écrire.`;
    case "message":
      return count > 1 ? `${who} vous a écrit ${count} messages.` : `${who} vous a écrit.`;
    case "favorite":
      return n.actorName
        ? `${who} vous a ajouté à ses favoris.`
        : "Quelqu'un vous a ajouté à ses favoris. Passez Premium pour savoir qui.";
    case "visit":
      return n.actorName
        ? `${who} a visité votre profil.`
        : "Quelqu'un a visité votre profil. Passez Premium pour savoir qui.";
    case "contact_request":
      return n.data.is_flash
        ? `${who} vous a envoyé un Message Flash.`
        : `${who} vous a envoyé une demande de contact.`;
  }
}

/** Page ouverte en touchant une notification. */
export function notificationTarget(
  n: AppNotification,
):
  | { to: "/messages/$conversationId"; params: { conversationId: string } }
  | { to: "/matches/$matchId"; params: { matchId: string } }
  | { to: "/demandes" | "/favoris" | "/visiteurs" | "/premium" | "/discover" } {
  if (n.type === "message" && n.data.conversation_id)
    return { to: "/messages/$conversationId", params: { conversationId: n.data.conversation_id } };
  if (n.type === "match" && n.data.match_id)
    return { to: "/matches/$matchId", params: { matchId: n.data.match_id } };
  if (n.type === "contact_request") return { to: "/demandes" };
  if (n.type === "favorite") return { to: n.actorName ? "/favoris" : "/premium" };
  if (n.type === "visit") return { to: n.actorName ? "/visiteurs" : "/premium" };
  return { to: "/discover" };
}
