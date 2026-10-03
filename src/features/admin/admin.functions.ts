import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const statusInput = z.object({
  userId: z.string().uuid(),
  action: z.enum(["suspend", "reactivate", "ban"]),
  reason: z.string().max(1000).optional(),
});

export const ADMIN_ERRORS: Record<string, string> = {
  admin_required: "Accès réservé aux administrateurs.",
  cannot_moderate_admin: "Impossible de modérer votre compte ou celui d'un autre administrateur.",
  reason_required: "Indiquez la raison de cette décision.",
  user_not_found: "Ce membre n'existe plus.",
  invalid_action: "Action inconnue.",
};

/** Traduit une erreur de la base en message lisible pour l'administrateur. */
export function adminErrorMessage(message: string): string {
  const key = Object.keys(ADMIN_ERRORS).find((k) => message.includes(k));
  return key ? (ADMIN_ERRORS[key] ?? message) : "L'action n'a pas pu aboutir. Réessayez.";
}

/**
 * 23.7 à 23.9 — Suspendre, réactiver ou bannir un membre.
 * 1. La base vérifie le rôle admin, applique le statut et trace l'action
 *    (`admin_set_user_status`, appelée avec la session de l'admin).
 * 2. Ici, avec le rôle service, la connexion est bloquée (suspendu ou banni) ou rétablie
 *    (réactivé) : un membre suspendu ne peut plus ouvrir de session.
 */
export const adminSetUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => statusInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: status, error } = await context.supabase.rpc("admin_set_user_status", {
      _user_id: data.userId,
      _action: data.action,
      ...(data.reason?.trim() ? { _reason: data.reason.trim() } : {}),
    });
    if (error) throw new Error(adminErrorMessage(error.message));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.action === "reactivate" ? "none" : "876000h",
    });
    if (authError) {
      console.error("admin ban_duration", authError.message);
      throw new Error(
        "Le statut est enregistré, mais la connexion n'a pas pu être mise à jour. Réessayez.",
      );
    }
    return { status };
  });

/** Supprime les fichiers en attente (photos de profils de démonstration retirés…). */
export const adminRunStorageCleanup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error(ADMIN_ERRORS["admin_required"]);
    const { processStorageCleanup } = await import("@/features/admin/storage-cleanup.server");
    return { removed: await processStorageCleanup() };
  });
