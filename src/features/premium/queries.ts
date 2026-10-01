import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type PremiumPlan = "premium_monthly" | "premium_yearly";

export type MyPremium =
  | { premium: true; plan: PremiumPlan | null; expiresAt: string }
  | { premium: false; expiredAt: string | null };

/** État Premium de la personne connectée (calculé par la base). */
export const myPremiumQuery = (userId: string) =>
  queryOptions({
    queryKey: ["premium", "me", userId],
    queryFn: async (): Promise<MyPremium> => {
      const { data, error } = await supabase.rpc("get_my_premium");
      if (error) throw error;
      const d = data as {
        premium: boolean;
        plan?: PremiumPlan | null;
        expires_at?: string;
        expired_at?: string | null;
      };
      return d.premium
        ? { premium: true, plan: d.plan ?? null, expiresAt: d.expires_at ?? "" }
        : { premium: false, expiredAt: d.expired_at ?? null };
    },
    staleTime: 30 * 1000,
  });

/**
 * Membres (parmi `userIds`) qui affichent le badge Premium. La base ne renvoie que les
 * membres visibles pour la personne connectée, et seulement l'information « Premium ».
 */
export function usePremiumBadges(userIds: string[]) {
  const ids = [...new Set(userIds)].sort();
  return useQuery({
    queryKey: ["premium", "badges", ids],
    queryFn: async (): Promise<Set<string>> => {
      if (!ids.length) return new Set();
      const { data, error } = await supabase.rpc("get_premium_badges", { _user_ids: ids });
      if (error) throw error;
      return new Set((data ?? []) as string[]);
    },
    enabled: ids.length > 0,
    staleTime: 60 * 1000,
  });
}
