import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Likes actifs envoyés par la personne connectée (filtrés par les règles d'accès). */
export const sentLikesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["likes", "sent", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("receiver_id")
        .eq("sender_id", userId)
        .eq("kind", "like")
        .eq("status", "active");

      if (error) throw error;
      return (data ?? []).map((like) => like.receiver_id);
    },
    staleTime: 60 * 1000,
  });

/** Refus explicites renvoyés par le serveur (`likeProfile`) et affichés tels quels. */
const LIKE_SERVER_MESSAGES = [
  "Ce profil n'est plus disponible.",
  "Vous ne pouvez pas liker votre propre profil.",
];

/** Message à afficher après l'échec d'un Like. */
export function likeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return LIKE_SERVER_MESSAGES.includes(message)
    ? message
    : "Le Like n'a pas pu être envoyé. Réessayez dans un instant.";
}

/** Vrai si le profil visé n'est plus proposable (masqué, suspendu, bloqué…). */
export const isProfileUnavailableError = (error: unknown) =>
  error instanceof Error && error.message === LIKE_SERVER_MESSAGES[0];
