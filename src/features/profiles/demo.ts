import { supabase } from "@/integrations/supabase/client";

/** Espace de stockage public des photos des profils de démonstration. */
export const DEMO_BUCKET = "demo-profils";

/** Étiquette toujours affichée sur un profil de démonstration (jamais un vrai membre). */
export const DEMO_LABEL = "Profil de démonstration";

/** Lien public d'une photo de profil de démonstration. */
export function demoPhotoUrl(path: string): string {
  return supabase.storage.from(DEMO_BUCKET).getPublicUrl(path).data.publicUrl;
}
