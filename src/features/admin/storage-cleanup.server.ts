/**
 * Vide la file `storage_cleanup_queue` : fichiers à supprimer du stockage (photo d'un
 * profil de démonstration retiré, pièces d'identité après décision…). La base ne peut pas
 * effacer un fichier elle-même : elle l'inscrit dans la file, le serveur le supprime avec
 * la clé service. Sans effet si la clé service manque.
 */
export async function processStorageCleanup(limit = 100): Promise<number> {
  if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("storage_cleanup_queue")
    .select("id, bucket_id, path")
    .is("done_at", null)
    .order("created_at")
    .limit(limit);
  if (error || !rows?.length) return 0;
  const byBucket = new Map<string, { ids: number[]; paths: string[] }>();
  for (const row of rows) {
    const entry = byBucket.get(row.bucket_id) ?? { ids: [], paths: [] };
    entry.ids.push(row.id);
    entry.paths.push(row.path);
    byBucket.set(row.bucket_id, entry);
  }
  let done = 0;
  for (const [bucket, { ids, paths }] of byBucket) {
    const { error: removeError } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error("storage cleanup", bucket, removeError.message);
      continue;
    }
    await supabaseAdmin
      .from("storage_cleanup_queue")
      .update({ done_at: new Date().toISOString() })
      .in("id", ids);
    done += ids.length;
  }
  return done;
}
