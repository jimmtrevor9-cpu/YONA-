import { queryOptions } from "@tanstack/react-query";

import { FREE_MAX_PHOTOS, PREMIUM_MAX_PHOTOS } from "@/features/monetization/rules";
import { supabase } from "@/integrations/supabase/client";

/**
 * Photos du profil (bucket privé « photos », dossier = identifiant du membre).
 * Le serveur applique : types et taille (bucket), 3 / 10 photos (enforce_photo_limit),
 * statut « en attente » à l'ajout (protect_photo_status), photo principale
 * (photos_before_insert, photos_after_delete, set_primary_photo).
 */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const EXTENSIONS: Record<(typeof PHOTO_TYPES)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** Durée de validité des liens d'affichage (bucket privé). */
const SIGNED_URL_SECONDS = 60 * 60;

export interface MyPhoto {
  id: string;
  storagePath: string;
  isPrimary: boolean;
  status: "pending" | "approved" | "rejected";
  url: string | null;
}

export const myPhotosQuery = (userId: string) =>
  queryOptions({
    queryKey: ["photos", "me", userId],
    queryFn: async (): Promise<{ photos: MyPhoto[]; max: number }> => {
      const [rows, premium] = await Promise.all([
        supabase
          .from("photos")
          .select("id, storage_path, is_primary, status")
          .eq("user_id", userId)
          .order("position")
          .order("created_at"),
        supabase.rpc("is_premium", { _user_id: userId }),
      ]);
      if (rows.error) throw rows.error;
      const list = rows.data ?? [];
      const signed = list.length
        ? await supabase.storage.from("photos").createSignedUrls(
            list.map((p) => p.storage_path),
            SIGNED_URL_SECONDS,
          )
        : { data: [] };
      const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
      return {
        photos: list.map((p) => ({
          id: p.id,
          storagePath: p.storage_path,
          isPrimary: p.is_primary,
          status: p.status,
          url: urls.get(p.storage_path) ?? null,
        })),
        max: premium.data === true ? PREMIUM_MAX_PHOTOS : FREE_MAX_PHOTOS,
      };
    },
  });

/** Vérification avant envoi (le serveur refuse de toute façon les fichiers non conformes). */
export function validatePhotoFile(file: File): string | null {
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Format non accepté : choisissez une photo JPG, PNG ou WebP.";
  }
  if (file.size > PHOTO_MAX_BYTES) return "Photo trop lourde : 5 Mo maximum.";
  return null;
}

export async function uploadPhoto(userId: string, file: File) {
  const ext = EXTENSIONS[file.type as (typeof PHOTO_TYPES)[number]];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) throw upload.error;
  const insert = await supabase.from("photos").insert({ user_id: userId, storage_path: path });
  if (insert.error) {
    // Limite atteinte ou autre refus : on ne laisse pas de fichier orphelin.
    await supabase.storage.from("photos").remove([path]);
    throw insert.error;
  }
}

export async function deletePhoto(photo: MyPhoto) {
  const { error } = await supabase.from("photos").delete().eq("id", photo.id);
  if (error) throw error;
  await supabase.storage.from("photos").remove([photo.storagePath]);
}

export async function setPrimaryPhoto(photoId: string) {
  const { error } = await supabase.rpc("set_primary_photo", { _photo_id: photoId });
  if (error) throw error;
}

export function photoErrorMessage(error: unknown, max: number): string {
  const m = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (m.includes("photo_limit_reached")) return `Vous avez atteint la limite de ${max} photos.`;
  if (m.includes("mime") || m.includes("invalid_mime_type")) {
    return "Format non accepté : choisissez une photo JPG, PNG ou WebP.";
  }
  if (m.includes("exceeded the maximum allowed size") || m.includes("payload too large")) {
    return "Photo trop lourde : 5 Mo maximum.";
  }
  return "L'opération n'a pas pu aboutir. Réessayez.";
}
