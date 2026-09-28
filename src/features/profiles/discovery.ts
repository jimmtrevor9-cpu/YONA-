import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Gender = Database["public"]["Enums"]["gender"];

/**
 * Profils proposés dans la découverte : le serveur (`discover_profiles`) applique les règles
 * d'éligibilité et les préférences enregistrées (sexe recherché, tranche d'âge).
 */
export const discoverFeedQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "discover-feed", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("discover_profiles", { _limit: 30 });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
