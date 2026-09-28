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
    retry: (count, error) => !isLocationRequired(error) && count < 2,
  });

/** Refus du serveur : la recherche par distance demande une position enregistrée. */
export function isLocationRequired(error: unknown): boolean {
  return (
    error instanceof Object &&
    "message" in error &&
    String(error.message).includes("location_required")
  );
}

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

/**
 * Villes renseignées par les profils visibles (aide à la saisie du filtre ville),
 * limitées au pays saisi s'il y en a un.
 */
export const searchCitiesQuery = (userId: string, country: string) =>
  queryOptions({
    queryKey: ["profiles", "search-cities", userId, country],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "list_search_cities",
        country ? { _country: country } : {},
      );
      if (error) throw error;
      return (data ?? []).map((row) => row.city);
    },
    staleTime: 5 * 60 * 1000,
  });

/** Critères texte du profil chrétien proposant des suggestions (valeurs publiques). */
export type SearchValueField = "denomination" | "faith_commitment" | "interests";

/** Valeurs réellement renseignées par les profils visibles (aide à la saisie). */
export const searchValuesQuery = (userId: string, field: SearchValueField) =>
  queryOptions({
    queryKey: ["profiles", "search-values", userId, field],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_search_values", { _field: field });
      if (error) throw error;
      return (data ?? []).map((row) => row.value);
    },
    staleTime: 5 * 60 * 1000,
  });

/** Abonnement Premium actif de la personne connectée (vérifié par la base). */
export const searchPremiumQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "search-premium", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_premium", { _user_id: userId });
      if (error) throw error;
      return data === true;
    },
    staleTime: 60 * 1000,
  });
