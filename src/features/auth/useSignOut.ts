import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { markOffline } from "@/features/activity/presence";
import { supabase } from "@/integrations/supabase/client";

/** Déconnexion propre : annule les requêtes, vide le cache, ferme la session, remplace l'historique. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    // N'apparaît plus « en ligne » ; un échec n'empêche jamais la déconnexion.
    await markOffline().catch(() => {});
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}
