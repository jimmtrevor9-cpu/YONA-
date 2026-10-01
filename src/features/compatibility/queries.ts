import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type CompatibilityLevel = "excellent" | "good" | "medium" | "low";

export interface CompatibilityDetail {
  key: string;
  label: string;
  points: number;
  max: number;
  matched: boolean;
  note: string;
}

export interface Compatibility {
  score: number | null;
  level: CompatibilityLevel | null;
  summary: string;
  premium: boolean;
  /** Détail critère par critère : seulement pour les membres Premium (serveur). */
  details: CompatibilityDetail[] | null;
}

export const COMPATIBILITY_LEVEL_LABELS: Record<CompatibilityLevel, string> = {
  excellent: "Excellente compatibilité",
  good: "Bonne compatibilité",
  medium: "Compatibilité moyenne",
  low: "Compatibilité faible",
};

/** 18.3 à 18.5 — Compatibilité avec un membre (calculée par la base). */
export const compatibilityQuery = (userId: string, otherId: string) =>
  queryOptions({
    queryKey: ["compatibility", userId, otherId],
    queryFn: async (): Promise<Compatibility> => {
      const { data, error } = await supabase.rpc("get_compatibility", { _other: otherId });
      if (error) throw error;
      return data as unknown as Compatibility;
    },
    staleTime: 5 * 60 * 1000,
  });

/** Scores seuls, pour les cartes des listes (Découvrir, Recherche). */
export function useCompatibilityScores(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ["compatibility", "scores", ids],
    queryFn: async (): Promise<Map<string, number | null>> => {
      if (!ids.length) return new Map();
      const { data, error } = await supabase.rpc("get_compatibility_scores", { _user_ids: ids });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.user_id, r.score]));
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
