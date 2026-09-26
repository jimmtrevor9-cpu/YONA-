import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export interface MyMatch {
  matchId: string;
  matchedAt: string;
  userId: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  /** Lien temporaire vers la photo principale validée (bucket privé), s'il y en a une. */
  photoUrl: string | null;
}

/**
 * Matchs actifs de la personne connectée, les plus récents d'abord.
 * Tout passe par les règles d'accès existantes : la personne ne lit que ses propres Matchs,
 * et le profil / la photo de l'autre seulement s'il reste visible pour elle (profil actif et
 * visible, compte actif, aucun blocage). Sinon, le Match n'est pas affiché.
 */
export const myMatchesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["matches", "mine", userId],
    queryFn: async (): Promise<MyMatch[]> => {
      const { data: matches, error } = await supabase
        .from("matches")
        .select("id, user_1_id, user_2_id, created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!matches?.length) return [];

      const others = matches.map((m) => (m.user_1_id === userId ? m.user_2_id : m.user_1_id));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, birth_date, city, country")
        .in("user_id", others);
      if (profilesError) throw profilesError;

      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("user_id, storage_path")
        .in("user_id", others)
        .eq("is_primary", true)
        .eq("status", "approved");
      if (photosError) throw photosError;

      const urls = new Map<string, string>();
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

      const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
      return matches.flatMap((m) => {
        const other = m.user_1_id === userId ? m.user_2_id : m.user_1_id;
        const profile = byId.get(other);
        if (!profile) return [];
        return [
          {
            matchId: m.id,
            matchedAt: m.created_at,
            userId: other,
            firstName: profile.first_name,
            birthDate: profile.birth_date,
            city: profile.city,
            country: profile.country,
            photoUrl: urls.get(other) ?? null,
          },
        ];
      });
    },
    staleTime: 30 * 1000,
  });
