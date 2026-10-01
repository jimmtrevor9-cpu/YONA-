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

/** Photo HD : fichier d'origine gardé (Premium). En gratuit, 2 Mo au plus (vérifié par la base). */
export const FREE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Côté le plus long d'une photo en qualité standard (gratuit). */
const STANDARD_MAX_SIDE = 1280;

export const myPhotosQuery = (userId: string) =>
  queryOptions({
    queryKey: ["photos", "me", userId],
    queryFn: async (): Promise<{ photos: MyPhoto[]; max: number; hd: boolean }> => {
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
        hd: premium.data === true,
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

/**
 * Qualité standard (gratuit) : la photo est réduite à 1 280 px (JPEG) avant l'envoi.
 * En HD (Premium), le fichier d'origine est gardé tel quel.
 */
export async function preparePhoto(file: File, hd: boolean): Promise<File> {
  if (hd || typeof createImageBitmap === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, STANDARD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= FREE_PHOTO_MAX_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Image illisible par le navigateur : envoyée telle quelle (la base vérifie la taille).
    return file;
  }
}

export async function uploadPhoto(userId: string, original: File, hd = false) {
  const file = await preparePhoto(original, hd);
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
  if (m.includes("photo_hd_premium")) {
    return "Photo trop lourde : les photos HD (plus de 2 Mo) sont réservées aux membres Premium.";
  }
  if (m.includes("mime") || m.includes("invalid_mime_type")) {
    return "Format non accepté : choisissez une photo JPG, PNG ou WebP.";
  }
  if (m.includes("exceeded the maximum allowed size") || m.includes("payload too large")) {
    return "Photo trop lourde : 5 Mo maximum.";
  }
  return "L'opération n'a pas pu aboutir. Réessayez.";
}
