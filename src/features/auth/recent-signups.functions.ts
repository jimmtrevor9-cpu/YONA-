import { createServerFn } from "@tanstack/react-start";

export interface RecentSignup {
  first_name: string;
  country: string | null;
}

/**
 * Derniers inscrits visibles pour la bulle de l'écran d'inscription (prénom et pays).
 * La fonction SQL `recent_signups` n'est ouverte qu'au rôle service (règle 24.12 : aucune
 * fonction SECURITY DEFINER ouverte aux visiteurs) : elle est appelée ici, côté serveur.
 * En cas de souci (clé service absente…), la bulle ne s'affiche simplement pas.
 */
export const getRecentSignups = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecentSignup[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("recent_signups");
      if (error) return [];
      return (data ?? []).map((r) => ({ first_name: r.first_name, country: r.country }));
    } catch {
      return [];
    }
  },
);
