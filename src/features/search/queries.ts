import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import type { SearchFilters } from "./filters";

/**
 * Recherche de profils côté serveur (`search_profiles`) : le serveur valide les filtres
 * et n'applique la recherche qu'aux profils visibles et actifs, sans blocage.
 */
export const searchProfilesQuery = (userId: string, filters: SearchFilters) =>
  queryOptions({
    queryKey: ["profiles", "search", userId, filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_profiles", {
        _filters: { ...filters },
        _limit: 30,
      });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
