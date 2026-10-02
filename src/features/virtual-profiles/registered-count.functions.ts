import { createServerFn } from "@tanstack/react-start";

/**
 * Nombre de vrais membres inscrits (profil créé), pour masquer autant de profils
 * d'exemple. La fonction SQL `count_registered_members` n'est ouverte qu'au rôle service
 * (règle 24.12) : elle est appelée ici, côté serveur. Elle ne renvoie qu'un nombre.
 * En cas de souci (clé service absente, fonction pas encore créée…), on renvoie 0.
 */
export const getRegisteredMembersCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("count_registered_members");
      if (error || typeof data !== "number") return 0;
      return Math.max(0, data);
    } catch {
      return 0;
    }
  },
);
