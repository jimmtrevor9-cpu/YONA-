/**
 * Visibilité du profil pour les autres membres.
 * Le serveur décide seul (règles RLS + migration 20260926140000_phase1_visibilite_profil) :
 * ce résumé sert uniquement à informer le membre de l'état de son propre profil.
 */
import type { Database } from "@/integrations/supabase/types";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "status" | "visibility" | "onboarding_completed_at"
>;

export type ProfileVisibilityState = "incomplete" | "suspended" | "hidden" | "visible";

export function profileVisibilityState(profile: ProfileRow): ProfileVisibilityState {
  if (profile.status === "suspended") return "suspended";
  if (!profile.onboarding_completed_at || profile.status === "incomplete") return "incomplete";
  if (profile.status === "hidden" || profile.visibility === "hidden") return "hidden";
  return "visible";
}

export const PROFILE_VISIBILITY_MESSAGES: Record<
  Exclude<ProfileVisibilityState, "incomplete">,
  string
> = {
  visible: "Votre profil est visible par les autres membres.",
  hidden: "Votre profil est masqué : les autres membres ne le voient pas.",
  suspended: "Votre profil est suspendu par la modération : il n'est pas visible.",
};
