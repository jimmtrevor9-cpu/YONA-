import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Gender = Database["public"]["Enums"]["gender"];

export interface DiscoveryFilters {
  gender?: Gender | undefined;
  city?: string | undefined;
}

/** Profils visibles par la personne connectée (les règles d'accès filtrent le reste). */
export const discoverProfilesQuery = (userId: string, filters: DiscoveryFilters = {}) =>
  queryOptions({
    queryKey: ["profiles", "discover", userId, filters],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("user_id, first_name, birth_date, city, country, bio, gender, interests")
        .eq("status", "active")
        .eq("visibility", "visible")
        .neq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(30);

      if (filters.gender) query = query.eq("gender", filters.gender);
      if (filters.city?.trim()) query = query.ilike("city", `%${filters.city.trim()}%`);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });
