import { supabase } from "@/integrations/supabase/client";

/** Étape franchie du parcours de création du profil (1 à 4), pour le tableau de bord. */
export function recordSignupStep(step: number): void {
  void supabase.rpc("record_signup_step", { _step: step }).then(
    () => undefined,
    () => undefined,
  );
}
