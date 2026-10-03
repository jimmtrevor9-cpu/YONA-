import { queryOptions } from "@tanstack/react-query";

import { demoPhotoUrl } from "@/features/profiles/demo";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Gender = Database["public"]["Enums"]["gender"];
type DiscoverRow = Database["public"]["Functions"]["discover_profiles"]["Returns"][number];

/** Profil proposé dans la découverte, avec le lien de sa photo principale. */
export interface DiscoverProfile extends DiscoverRow {
  photoUrl: string | null;
}

/** Durée de validité des liens de photos (espace privé). */
const SIGNED_URL_SECONDS = 60 * 60;

/**
 * Profils proposés dans la découverte : le serveur (`discover_profiles`) applique les règles
 * d'éligibilité, le sexe recherché (intercalé quand le membre cherche les deux), la
 * préférence réciproque et la tranche d'âge.
 */
export const discoverFeedQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "discover-feed", userId],
    queryFn: async (): Promise<DiscoverProfile[]> => {
      const { data, error } = await supabase.rpc("discover_profiles", { _limit: 30 });
      if (error) throw error;
      const rows = data ?? [];
      const paths = rows.flatMap((r) => (r.photo_path ? [r.photo_path] : []));
      const signed = paths.length
        ? await supabase.storage.from("photos").createSignedUrls(paths, SIGNED_URL_SECONDS)
        : { data: [] };
      const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
      return rows.map((r) => ({
        ...r,
        photoUrl: r.photo_path
          ? (urls.get(r.photo_path) ?? null)
          : r.demo_photo_path
            ? demoPhotoUrl(r.demo_photo_path)
            : null,
      }));
    },
    staleTime: 60 * 1000,
  });

/** Revenir au dernier profil passé (Premium, vérifié par le serveur). */
export async function undoLastPass(): Promise<string> {
  const { data, error } = await supabase.rpc("undo_last_pass");
  if (error) {
    if (error.message.includes("premium_required")) throw new Error("premium_required");
    if (error.message.includes("nothing_to_undo")) {
      throw new Error("Aucun profil passé à retrouver (dernières 24 heures).");
    }
    throw new Error("Le retour en arrière n'a pas pu aboutir. Réessayez.");
  }
  return data;
}

/**
 * Nombre de critères actifs de la personne connectée (pastille du bouton « filtres ») :
 * sexe recherché, tranche d'âge modifiée, distance, objectif.
 */
export const discoveryCriteriaCountQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profiles", "discover-criteria", userId],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("preferences")
        .select("preferred_gender, min_age, max_age, max_distance_km, relationship_goal")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return 0;
      return [
        data.preferred_gender !== null,
        data.min_age !== 18 || data.max_age !== 60,
        data.max_distance_km !== null,
        !!data.relationship_goal,
      ].filter(Boolean).length;
    },
    staleTime: 5 * 60 * 1000,
  });
