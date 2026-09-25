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
