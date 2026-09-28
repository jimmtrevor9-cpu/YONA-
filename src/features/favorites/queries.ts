import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Membres que la personne connectée a ajoutés à ses favoris (identifiants), lus selon les
 * règles d'accès : chacun ne lit que ses propres favoris.
 */
export const myFavoriteIdsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", "ids", userId],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("favorites").select("favorite_user_id");
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.favorite_user_id));
    },
    staleTime: 30 * 1000,
  });

export interface MyFavorite {
  userId: string;
  favoritedAt: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  /** Lien temporaire vers la photo principale validée (bucket privé), s'il y en a une. */
  photoUrl: string | null;
  /** Match actif avec ce membre, s'il existe (accès à son profil complet). */
  matchId: string | null;
}

export interface MyFavorites {
  favorites: MyFavorite[];
  /** Favoris dont le profil n'est plus visible (masqué, suspendu, bloqué…). */
  unavailableCount: number;
}

/**
 * Favoris de la personne connectée, les plus récents d'abord. Tout passe par les règles
 * d'accès existantes : la personne ne lit que ses propres favoris, et le profil / la photo
 * de l'autre seulement s'il reste visible pour elle (profil actif et visible, compte actif,
 * aucun blocage). Sinon, le favori est seulement compté comme indisponible.
 */
export const myFavoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", "list", userId],
    queryFn: async (): Promise<MyFavorites> => {
      const { data: rows, error } = await supabase
        .from("favorites")
        .select("favorite_user_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!rows?.length) return { favorites: [], unavailableCount: 0 };

      const ids = rows.map((row) => row.favorite_user_id);
      const [profilesResult, photosResult, matchesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, first_name, birth_date, city, country")
          .in("user_id", ids),
        supabase
          .from("photos")
          .select("user_id, storage_path")
          .in("user_id", ids)
          .eq("is_primary", true)
          .eq("status", "approved"),
        supabase
          .from("matches")
          .select("id, user_1_id, user_2_id")
          .eq("status", "active")
          .or(`user_1_id.eq.${userId},user_2_id.eq.${userId}`),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (photosResult.error) throw photosResult.error;
      if (matchesResult.error) throw matchesResult.error;

      const urls = new Map<string, string>();
      const photos = photosResult.data ?? [];
      if (photos.length) {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
          photos.map((p) => p.storage_path),
          60 * 60,
        );
        photos.forEach((p, i) => {
          const url = signed?.[i]?.signedUrl;
          if (url) urls.set(p.user_id, url);
        });
      }

      const matchIds = new Map(
        (matchesResult.data ?? []).map((m) => [
          m.user_1_id === userId ? m.user_2_id : m.user_1_id,
          m.id,
        ]),
      );
      const byId = new Map((profilesResult.data ?? []).map((p) => [p.user_id, p]));
      const favorites = rows.flatMap((row) => {
        const profile = byId.get(row.favorite_user_id);
        if (!profile) return [];
        return [
          {
            userId: row.favorite_user_id,
            favoritedAt: row.created_at,
            firstName: profile.first_name,
            birthDate: profile.birth_date,
            city: profile.city,
            country: profile.country,
            photoUrl: urls.get(row.favorite_user_id) ?? null,
            matchId: matchIds.get(row.favorite_user_id) ?? null,
          },
        ];
      });
      return { favorites, unavailableCount: rows.length - favorites.length };
    },
    staleTime: 30 * 1000,
  });

export interface FavoritedByMember {
  userId: string;
  favoritedAt: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  /** Lien temporaire vers la photo principale validée (bucket privé), s'il y en a une. */
  photoUrl: string | null;
}

export interface FavoritedBy {
  /** Abonnement Premium actif (vérifié par la base, `is_premium`). */
  premium: boolean;
  members: FavoritedByMember[];
}

/**
 * « Qui m'a mis en favori » : réservé aux membres Premium. La base (`get_favorited_by`)
 * vérifie l'abonnement (refus `premium_required` sinon) et ne renvoie que les membres
 * encore visibles, sans blocage. Un membre gratuit ne reçoit aucune information.
 */
export const favoritedByQuery = (userId: string) =>
  queryOptions({
    queryKey: ["favorites", "by", userId],
    queryFn: async (): Promise<FavoritedBy> => {
      const { data: premium, error: premiumError } = await supabase.rpc("is_premium", {
        _user_id: userId,
      });
      if (premiumError) throw premiumError;
      if (premium !== true) return { premium: false, members: [] };

      const { data: rows, error } = await supabase.rpc("get_favorited_by");
      // Abonnement expiré entre les deux lectures : la base refuse (réservé Premium).
      if (error?.message.includes("premium_required")) return { premium: false, members: [] };
      if (error) throw error;
      if (!rows?.length) return { premium: true, members: [] };

      const urls = new Map<string, string>();
      const { data: photos, error: photosError } = await supabase
        .from("photos")
        .select("user_id, storage_path")
        .in(
          "user_id",
          rows.map((row) => row.user_id),
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
        members: rows.map((row) => ({
          userId: row.user_id,
          favoritedAt: row.favorited_at,
          firstName: row.first_name,
          birthDate: row.birth_date,
          city: row.city,
          country: row.country,
          photoUrl: urls.get(row.user_id) ?? null,
        })),
      };
    },
    staleTime: 30 * 1000,
  });
