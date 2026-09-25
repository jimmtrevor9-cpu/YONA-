import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

/**
 * Garde de l'espace connecté.
 * Vérifiée après l'hydratation (et non dans `beforeLoad`) : une redirection pendant
 * l'hydratation d'une route `ssr: false` provoquait une erreur React #418.
 * Le jeton reste revalidé auprès de Supabase (`getUser`) avant d'afficher la page.
 */
function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        // Session locale invalide (compte supprimé, jeton révoqué) : on la retire.
        await supabase.auth.signOut({ scope: "local" });
        return;
      }
      setVerifiedUserId(data.user.id);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (verifiedUserId !== user.id) return null;
  return <Outlet />;
}
