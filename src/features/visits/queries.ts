import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface ProfileVisitor {
  userId: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  lastVisitedAt: string;
  visitCount: number;
  /** Lien temporaire vers la photo principale validée (bucket privé), s'il y en a une. */
  photoUrl: string | null;
}

export interface ProfileVisitors {
  /** Abonnement Premium actif (vérifié par la base, `is_premium`). */
  premium: boolean;
  visitors: ProfileVisitor[];
}

/**
 * « Qui a visité mon profil » : réservé aux membres Premium. La base
 * (`get_profile_visitors`) vérifie l'abonnement et ne renvoie que les visiteurs encore
 * visibles, sans blocage.
 */
export const profileVisitorsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["visits", "visitors", userId],
    queryFn: async (): Promise<ProfileVisitors> => {
      const { data: premium, error: premiumError } = await supabase.rpc("is_premium", {
        _user_id: userId,
      });
      if (premiumError) throw premiumError;
      if (premium !== true) return { premium: false, visitors: [] };

      const { data: rows, error } = await supabase.rpc("get_profile_visitors");
      if (error) throw error;
      if (!rows?.length) return { premium: true, visitors: [] };

      const urls = new Map<string, string>();
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("user_id, storage_path")
        .in(
          "user_id",
          rows.map((row) => row.visitor_id),
        )
        .eq("is_primary", true)
        .eq("status", "approved");
      if (photosError) throw photosError;
      if (photos?.length) {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
          photos.map((p) => p.storage_path),
          60 * 60,
        );
        photos.forEach((p, i) => {
          const url = signed?.[i]?.signedUrl;
          if (url) urls.set(p.user_id, url);
        });
      }

      return {
        premium: true,
        visitors: rows.map((row) => ({
          userId: row.visitor_id,
          firstName: row.first_name,
          birthDate: row.birth_date,
          city: row.city,
          country: row.country,
          lastVisitedAt: row.visited_at,
          visitCount: row.visit_count,
          photoUrl: urls.get(row.visitor_id) ?? null,
        })),
      };
    },
    staleTime: 30 * 1000,
  });
