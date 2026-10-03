import { queryOptions } from "@tanstack/react-query";

import { adminErrorMessage } from "@/features/admin/admin.functions";
import { DEMO_BUCKET, demoPhotoUrl, isBundledDemoPhoto } from "@/features/profiles/demo";
import { preparePhoto } from "@/features/profiles/photos";
import { supabase } from "@/integrations/supabase/client";

/** Nature de l'image, attestée par l'administrateur avant la publication. */
export const DEMO_PHOTO_SOURCES = [
  {
    value: "generated",
    label: "Image générée : personne qui n'existe pas",
    detail:
      "Visage créé de zéro par un outil d'images, sans photo d'une personne réelle en modèle.",
  },
  {
    value: "licensed",
    label: "Banque d'images sous licence",
    detail: "Licence qui autorise l'usage sur un site de rencontre.",
  },
  {
    value: "consent",
    label: "Accord écrit de la personne",
    detail:
      "La personne photographiée a accepté par écrit d'apparaître comme profil de démonstration.",
  },
] as const;
export type DemoPhotoSource = (typeof DEMO_PHOTO_SOURCES)[number]["value"];

export const adminDemoProfilesQuery = () =>
  queryOptions({
    queryKey: ["admin", "demo-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_demo_profiles");
      if (error) throw new Error(adminErrorMessage(error.message));
      return (data ?? []).map((p) => ({
        ...p,
        url: p.demo_photo_path ? demoPhotoUrl(p.demo_photo_path) : null,
      }));
    },
  });

const DEMO_ERRORS: Record<string, string> = {
  attestation_required: "Indiquez la nature de l'image avant de la publier.",
  demo_profile_not_found: "Ce profil de démonstration n'existe plus.",
  invalid_path: "Fichier invalide.",
};

function demoError(message: string): Error {
  const key = Object.keys(DEMO_ERRORS).find((k) => message.includes(k));
  return new Error(key ? DEMO_ERRORS[key] : adminErrorMessage(message));
}

/** Envoie la photo (réduite à 1 280 px), l'attache au profil, puis retire l'ancienne. */
export async function setDemoPhoto(userId: string, file: File, source: DemoPhotoSource) {
  const prepared = await preparePhoto(file, false);
  const ext =
    prepared.type === "image/png" ? "png" : prepared.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const upload = await supabase.storage
    .from(DEMO_BUCKET)
    .upload(path, prepared, { contentType: prepared.type, upsert: false });
  if (upload.error) throw new Error("La photo n'a pas pu être envoyée. Réessayez.");
  const { data: old, error } = await supabase.rpc("admin_set_demo_photo", {
    _user_id: userId,
    _path: path,
    _source: source,
  });
  if (error) {
    await supabase.storage.from(DEMO_BUCKET).remove([path]);
    throw demoError(error.message);
  }
  if (old && !isBundledDemoPhoto(old)) await supabase.storage.from(DEMO_BUCKET).remove([old]);
}

/** Retire la photo : le profil de démonstration n'est plus montré aux membres. */
export async function clearDemoPhoto(userId: string) {
  const { data: old, error } = await supabase.rpc("admin_set_demo_photo", {
    _user_id: userId,
    _path: null,
  });
  if (error) throw demoError(error.message);
  if (old && !isBundledDemoPhoto(old)) await supabase.storage.from(DEMO_BUCKET).remove([old]);
}
