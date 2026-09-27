import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Membres que la personne connectée a ajoutés à ses favoris (identifiants), lus selon les
 * règles d'accès : chacun ne lit que ses propres favoris.
 */
export const myFavoriteIdsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", "ids", userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("favorites").select("favorite_user_id");
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.favorite_user_id));
    },
    staleTime: 30 * 1000,
  });
