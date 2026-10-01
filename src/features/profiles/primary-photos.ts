import { supabase } from "@/integrations/supabase/client";

/**
 * Liens temporaires (1 h) vers la photo principale validée de plusieurs membres.
 * Lecture soumise aux règles d'accès : seules les photos que la personne connectée a le
 * droit de voir sont renvoyées. Clé : identifiant du membre.
 */
export async function primaryPhotoUrls(userIds: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return urls;
  const { data: photos, error } = await supabase
    .from("photos")
    .select("user_id, storage_path")
    .in("user_id", ids)
    .eq("is_primary", true)
    .eq("status", "approved");
  if (error) throw error;
  if (!photos?.length) return urls;
  const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
    photos.map((p) => p.storage_path),
    60 * 60,
  );
  photos.forEach((p, i) => {
    const url = signed?.[i]?.signedUrl;
    if (url) urls.set(p.user_id, url);
  });
  return urls;
}
