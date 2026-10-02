import { queryOptions } from "@tanstack/react-query";

import {
  deletePhoto,
  setPrimaryPhoto,
  uploadPhoto,
  type MyPhoto,
} from "@/features/profiles/photos";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vérification du profil (selfie ou pièce d'identité).
 * Les photos vont dans l'espace privé « verifications » (dossier = identifiant du membre) :
 * jamais publiées, consultées seulement par les administrateurs, puis supprimées après
 * l'examen. La base refuse tout dépôt hors de son propre dossier.
 */
export type VerificationMethod = "selfie" | "id_document";

export interface MyVerification {
  id: string;
  method: VerificationMethod;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

const BUCKET = "verifications";
/** Côté le plus long d'une photo de vérification (lisible, mais légère à envoyer). */
const MAX_SIDE = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export const myVerificationsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["verifications", "me", userId],
    queryFn: async (): Promise<MyVerification[]> => {
      const { data, error } = await supabase
        .from("profile_verifications")
        .select("id, method, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        method: row.method as VerificationMethod,
        status: row.status as MyVerification["status"],
        createdAt: row.created_at,
      }));
    },
  });

/** Réduit l'image et la convertit en JPEG ; garde l'original si le navigateur ne peut pas la lire. */
export async function prepareVerificationImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "undefined") {
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.88),
      );
      if (blob) return blob;
    } catch {
      // Image illisible ici : on essaie l'original ci-dessous.
    }
  }
  if (ACCEPTED.includes(file.type)) return file;
  throw new Error("unsupported_image");
}

export async function submitVerification(
  userId: string,
  method: VerificationMethod,
  image: Blob,
): Promise<void> {
  const prepared = await prepareVerificationImage(image);
  const ext =
    prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${method}-${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared, { contentType: prepared.type || "image/jpeg", upsert: false });
  if (upload.error) throw upload.error;
  const insert = await supabase
    .from("profile_verifications")
    .insert({ user_id: userId, method, storage_path: path });
  if (insert.error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw insert.error;
  }
}

/**
 * Remplace la photo de profil principale : la nouvelle photo est ajoutée puis devient
 * principale, et l'ancienne est retirée. Si la limite de photos est atteinte, l'ancienne
 * est retirée d'abord pour faire de la place.
 */
export async function replacePrimaryPhoto(
  userId: string,
  file: File,
  current: MyPhoto | null,
  hd: boolean,
): Promise<void> {
  let removed = false;
  try {
    await uploadPhoto(userId, file, hd);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (!current || !message.includes("photo_limit_reached")) throw error;
    await deletePhoto(current);
    removed = true;
    await uploadPhoto(userId, file, hd);
  }
  const { data, error } = await supabase
    .from("photos")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) await setPrimaryPhoto(data.id);
  if (current && !removed) await deletePhoto(current);
}

export function verificationErrorMessage(error: unknown): string {
  const m = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  if (m.includes("unsupported_image")) return "Format non accepté : choisis une photo JPG ou PNG.";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload"))
    return "Photo trop lourde : 8 Mo maximum.";
  return "L'envoi n'a pas abouti. Vérifie ta connexion et réessaie.";
}
