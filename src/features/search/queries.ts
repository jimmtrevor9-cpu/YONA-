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

/** Sexe recherché enregistré dans les préférences (valeur de départ de la recherche). */
export const searchDefaultsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "search-defaults", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preferences")
        .select("preferred_gender")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return { gender: data?.preferred_gender ?? null };
    },
    staleTime: 5 * 60 * 1000,
  });

/** Pays renseignés par les profils visibles (aide à la saisie du filtre pays). */
export const searchCountriesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "search-countries", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_search_countries");
      if (error) throw error;
      return (data ?? []).map((row) => row.country);
    },
    staleTime: 5 * 60 * 1000,
  });
