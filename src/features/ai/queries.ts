import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import type { AiQuotaState } from "./roi-salomon.functions";

/** Quota IA du jour (lecture seule, calculé par la base). */
export const aiQuotaQuery = (userId: string, feature: "roi_salomon" | "ice_breaker") =>
  queryOptions({
    queryKey: ["ai", "quota", feature, userId],
    queryFn: async (): Promise<AiQuotaState> => {
      const { data, error } = await supabase.rpc("get_ai_quota", { _feature: feature });
      if (error) throw error;
      const q = data as AiQuotaState;
      return { used: q.used, limit: q.limit, remaining: q.remaining, unlimited: q.unlimited };
    },
    staleTime: 15 * 1000,
  });

/** Texte des questions restantes. */
export function aiQuotaLabel(quota: AiQuotaState): string {
  if (quota.unlimited) return "Premium : questions illimitées";
  const remaining = quota.remaining ?? 0;
  if (remaining === 0) return "Plus aucune question gratuite aujourd'hui";
  return remaining === 1
    ? "Il vous reste 1 question gratuite aujourd'hui"
    : `Il vous reste ${remaining} questions gratuites aujourd'hui`;
}
