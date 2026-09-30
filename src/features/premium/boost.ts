import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Boost de profil (Premium) : 1 heure en tête de Découvrir et de la Recherche, une fois par semaine. */
export interface MyBoost {
  premium: boolean;
  activeUntil: string | null;
  nextAvailableAt: string | null;
}

export const myBoostQuery = (userId: string) =>
  queryOptions({
    queryKey: ["premium", "boost", userId],
    queryFn: async (): Promise<MyBoost> => {
      const { data, error } = await supabase.rpc("get_my_boost");
      if (error) throw error;
      const d = data as {
        premium: boolean;
        active_until: string | null;
        next_available_at: string | null;
      };
      return {
        premium: d.premium,
        activeUntil: d.active_until,
        nextAvailableAt: d.next_available_at,
      };
    },
    staleTime: 30 * 1000,
  });

export const BOOST_ERRORS = {
  premium_required: "Les boosts sont réservés aux membres Premium.",
  boost_cooldown: "Vous avez déjà utilisé votre boost cette semaine.",
  account_inactive: "Votre compte doit être actif pour booster votre profil.",
} as const;

export async function activateBoost(): Promise<string> {
  const { data, error } = await supabase.rpc("activate_profile_boost");
  if (error) {
    const code = (Object.keys(BOOST_ERRORS) as (keyof typeof BOOST_ERRORS)[]).find((k) =>
      error.message.includes(k),
    );
    throw new Error(code ? BOOST_ERRORS[code] : "Le boost n'a pas pu être activé. Réessayez.");
  }
  return data as string;
}
