/**
 * Erreurs importantes du serveur (paiement, IA, vérification, fichiers) : enregistrées dans
 * le journal visible par l'administrateur. N'échoue jamais.
 */
export async function logServerError(
  source: string,
  error: unknown,
  extra: { userId?: string | null; path?: string; details?: Record<string, unknown> } = {},
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${source}]`, message);
  try {
    if (!process.env["SUPABASE_SERVICE_ROLE_KEY"]) return;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("log_server_error", {
      _source: source,
      _message: message.slice(0, 2000),
      ...(extra.userId ? { _user_id: extra.userId } : {}),
      ...(extra.path ? { _path: extra.path } : {}),
      _details: (extra.details ?? {}) as never,
    });
  } catch {
    // Journal indisponible : l'erreur reste dans les journaux de Vercel.
  }
}
