import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Profil de l'utilisateur connecté (RLS : lecture de sa propre ligne). */
export const myProfileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "me", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

/** Données déjà enregistrées utiles à l'onboarding (profil, profil chrétien, préférences). */
export const onboardingDataQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "onboarding", userId],
    queryFn: async () => {
      const [profile, faith, prefs] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, gender, birth_date, city, country, bio, onboarding_completed_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("christian_profiles")
          .select("denomination, church_attendance, faith_importance, marriage_vision")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("preferences")
          .select("preferred_gender, min_age, max_age, relationship_goal")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      if (profile.error) throw profile.error;
      if (faith.error) throw faith.error;
      if (prefs.error) throw prefs.error;
      return { profile: profile.data, faith: faith.data, prefs: prefs.data };
    },
  });

/** Page d'arrivée après connexion : l'onboarding tant que le profil n'est pas créé. */
export async function getPostLoginPath(userId: string): Promise<"/onboarding" | "/discover"> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "/discover";
  return data.onboarding_completed_at ? "/discover" : "/onboarding";
}

export function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  // « AAAA-MM-JJ » est lu tel quel : new Date("AAAA-MM-JJ") serait interprété en UTC et
  // décalerait l'anniversaire d'un jour dans les fuseaux à l'ouest de Greenwich.
  const [year, month, day] = birthDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  const m = now.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && now.getDate() < day)) age -= 1;
  return age;
}
