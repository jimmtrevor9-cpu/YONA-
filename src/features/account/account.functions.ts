import { createClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DELETE_ACCOUNT_CONFIRMATION = "SUPPRIMER";

export const ACCOUNT_ERRORS = {
  confirmation: `Écrivez ${DELETE_ACCOUNT_CONFIRMATION} pour confirmer la suppression.`,
  wrong_password: "Mot de passe incorrect.",
  admin_account: "Un compte administrateur ne peut pas être supprimé depuis l'application.",
  failed: "La suppression n'a pas pu aboutir. Réessayez ou contactez le support.",
} as const;

const deleteInput = z.object({
  confirmation: z.string().max(40),
  password: z.string().min(1).max(200),
});

/**
 * 20.9 — Suppression définitive du compte. Le mot de passe est revérifié ici ; puis les
 * fichiers (photos, photos de vérification, messages vocaux) sont retirés et le compte est supprimé avec le rôle
 * service : toutes les données liées (profil, Likes, Matchs, messages, paiements…)
 * disparaissent avec lui (suppression en cascade dans la base).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
      throw new Error(ACCOUNT_ERRORS.confirmation);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = target?.user?.email;
    if (!email) throw new Error(ACCOUNT_ERRORS.failed);

    // Vérification du mot de passe avec un client séparé (aucune session conservée).
    const checker = createClient(
      process.env["SUPABASE_URL"] ?? "",
      process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: signInError } = await checker.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (signInError) throw new Error(ACCOUNT_ERRORS.wrong_password);

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin === true) throw new Error(ACCOUNT_ERRORS.admin_account);

    // Fichiers du membre (un échec ici n'empêche pas la suppression du compte).
    try {
      const { data: photos } = await supabaseAdmin.storage
        .from("photos")
        .list(context.userId, { limit: 100 });
      if (photos?.length) {
        await supabaseAdmin.storage
          .from("photos")
          .remove(photos.map((f) => `${context.userId}/${f.name}`));
      }
      const { data: checks } = await supabaseAdmin.storage
        .from("verifications")
        .list(context.userId, { limit: 100 });
      if (checks?.length) {
        await supabaseAdmin.storage
          .from("verifications")
          .remove(checks.map((f) => `${context.userId}/${f.name}`));
      }
      const { data: voices } = await supabaseAdmin
        .from("messages")
        .select("audio_path")
        .eq("sender_id", context.userId)
        .not("audio_path", "is", null);
      const paths = (voices ?? []).map((v) => v.audio_path).filter((p): p is string => !!p);
      if (paths.length) await supabaseAdmin.storage.from("voice-messages").remove(paths);
    } catch (error) {
      const { logServerError } = await import("@/features/journal/server-errors.server");
      await logServerError("compte", error, {
        userId: context.userId,
        details: { étape: "nettoyage des fichiers" },
      });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) {
      const { logServerError } = await import("@/features/journal/server-errors.server");
      await logServerError("compte", `Suppression impossible : ${error.message}`, {
        userId: context.userId,
      });
      throw new Error(ACCOUNT_ERRORS.failed);
    }
    return { deleted: true };
  });

export function accountErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if ((Object.values(ACCOUNT_ERRORS) as string[]).includes(message)) return message;
  return ACCOUNT_ERRORS.failed;
}
