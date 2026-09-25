import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Vérification de rôle côté base de données (fonction sécurisée `has_role`).
 * Ne jamais déduire le rôle d'un stockage local ou d'une valeur du navigateur.
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) return false;
  return data === true;
}

export const isAdminQuery = (userId: string) =>
  queryOptions({
    queryKey: ["roles", "is-admin", userId],
    queryFn: () => checkIsAdmin(userId),
    staleTime: 5 * 60 * 1000,
  });
