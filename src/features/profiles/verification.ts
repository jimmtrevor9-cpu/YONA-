import {
  deletePhoto,
  setPrimaryPhoto,
  uploadPhoto,
  type MyPhoto,
} from "@/features/profiles/photos";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vérification d'identité : préparation de la photo de la pièce et remplacement de la photo
 * de profil. L'envoi et la décision automatique : src/features/verification/.
 * Les photos vont dans l'espace privé « verifications » (dossier = identifiant du membre).
 */
/** Côté le plus long d'une photo de vérification (lisible, mais légère à envoyer). */
const MAX_SIDE = 1600;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

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
