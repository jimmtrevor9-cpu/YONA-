/**
 * Retire les fichiers d'un membre (photos, photos de vérification, messages vocaux) avant la
 * suppression de son compte. Utilisé par « Supprimer mon compte » et par l'administration.
 * Un échec ici n'empêche pas la suppression du compte : il est noté dans le journal des erreurs.
 */
export async function removeUserFiles(userId: string, source: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { data: photos } = await supabaseAdmin.storage
      .from("photos")
      .list(userId, { limit: 100 });
    if (photos?.length) {
      await supabaseAdmin.storage.from("photos").remove(photos.map((f) => `${userId}/${f.name}`));
    }
    const { data: checks } = await supabaseAdmin.storage
      .from("verifications")
      .list(userId, { limit: 100 });
    if (checks?.length) {
      await supabaseAdmin.storage
        .from("verifications")
        .remove(checks.map((f) => `${userId}/${f.name}`));
    }
    const { data: voices } = await supabaseAdmin
      .from("messages")
      .select("audio_path")
      .eq("sender_id", userId)
      .not("audio_path", "is", null);
    const paths = (voices ?? []).map((v) => v.audio_path).filter((p): p is string => !!p);
    if (paths.length) await supabaseAdmin.storage.from("voice-messages").remove(paths);
  } catch (error) {
    const { logServerError } = await import("@/features/journal/server-errors.server");
    await logServerError(source, error, { userId, details: { étape: "nettoyage des fichiers" } });
  }
}
