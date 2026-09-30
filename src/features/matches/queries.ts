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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MatchProfile {
  matchId: string;
  matchedAt: string;
  userId: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  profession: string | null;
  bio: string | null;
  interests: string[];
  faith: {
    denomination: string | null;
    churchAttendance: string | null;
    faithImportance: string | null;
    faithCommitment: string | null;
    prayerPractice: string | null;
    marriageVision: string | null;
    christianValues: string[];
  } | null;
  /** Photos validées (principale d'abord), liens temporaires du stockage privé. */
  photoUrls: string[];
}

/**
 * Profil de l'autre personne d'un Match, ouvert depuis la liste des Matchs.
 * `null` si le Match n'existe pas, n'est pas actif, n'appartient pas à la personne connectée,
 * ou si le profil n'est plus visible pour elle (règles d'accès existantes).
 * Les préférences de recherche restent privées et ne sont jamais lues.
 */
export const matchProfileQuery = (userId: string, matchId: string) =>
  queryOptions({
    queryKey: ["matches", "profile", userId, matchId],
    queryFn: async (): Promise<MatchProfile | null> => {
      // Adresse mal formée : rien à chercher.
      if (!UUID_PATTERN.test(matchId)) return null;
      const { data: match, error } = await supabase
        .from("matches")
        .select("id, user_1_id, user_2_id, created_at")
        .eq("id", matchId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!match) return null;
      const other = match.user_1_id === userId ? match.user_2_id : match.user_1_id;

      const [profileRes, faithRes, photosRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("first_name, birth_date, city, country, profession, bio, interests")
          .eq("user_id", other)
          .maybeSingle(),
        supabase
          .from("christian_profiles")
          .select(
            "denomination, church_attendance, faith_importance, faith_commitment, prayer_practice, marriage_vision, christian_values",
          )
          .eq("user_id", other)
          .maybeSingle(),
        supabase
          .from("photos")
          .select("storage_path, is_primary, position")
          .eq("user_id", other)
          .eq("status", "approved")
          .order("is_primary", { ascending: false })
          .order("position", { ascending: true }),
      ]);
      if (profileRes.error) throw profileRes.error;
      if (faithRes.error) throw faithRes.error;
      if (photosRes.error) throw photosRes.error;
      const profile = profileRes.data;
      if (!profile) return null;

      let photoUrls: string[] = [];
      if (photosRes.data?.length) {
        const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
          photosRes.data.map((p) => p.storage_path),
          60 * 60,
        );
        photoUrls = (signed ?? []).flatMap((s) => (s.signedUrl ? [s.signedUrl] : []));
      }

      const f = faithRes.data;
      return {
        matchId: match.id,
        matchedAt: match.created_at,
        userId: other,
        firstName: profile.first_name,
        birthDate: profile.birth_date,
        city: profile.city,
        country: profile.country,
        profession: profile.profession,
        bio: profile.bio,
        interests: profile.interests ?? [],
        faith: f
          ? {
              denomination: f.denomination,
              churchAttendance: f.church_attendance,
              faithImportance: f.faith_importance,
              faithCommitment: f.faith_commitment,
              prayerPractice: f.prayer_practice,
              marriageVision: f.marriage_vision,
              christianValues: f.christian_values ?? [],
            }
          : null,
        photoUrls,
      };
    },
    staleTime: 30 * 1000,
  });
