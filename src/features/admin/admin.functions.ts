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
  demo_profile: "Les profils de démonstration se gèrent dans l'onglet « Profils de démo ».",
  confirmation: "Écrivez SUPPRIMER pour confirmer.",
  delete_failed: "La suppression n'a pas pu aboutir. Réessayez.",
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
      const { logServerError } = await import("@/features/journal/server-errors.server");
      await logServerError("admin", `Blocage de la connexion impossible : ${authError.message}`, {
        details: { membre: data.userId, action: data.action },
      });
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

const deleteInput = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
  confirmation: z.string().max(40),
});

/**
 * Suppression définitive d'un compte par l'administration (RGPD, demande du membre, fraude).
 * 1. Le rôle admin est revérifié en base, la cible ne doit être ni un admin ni un profil de démo.
 * 2. La décision est tracée dans le journal d'audit (avec la raison) AVANT la suppression.
 * 3. Les fichiers sont retirés, puis le compte est supprimé avec le rôle service : les données
 *    liées disparaissent en cascade, le journal est anonymisé (déclencheur en base).
 */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => deleteInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim().toUpperCase() !== "SUPPRIMER") {
      throw new Error(ADMIN_ERRORS["confirmation"]);
    }
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error(ADMIN_ERRORS["admin_required"]);
    if (data.userId === context.userId) throw new Error(ADMIN_ERRORS["cannot_moderate_admin"]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: targetIsAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: data.userId,
      _role: "admin",
    });
    if (targetIsAdmin === true) throw new Error(ADMIN_ERRORS["cannot_moderate_admin"]);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_virtual")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (profile?.is_virtual) throw new Error(ADMIN_ERRORS["demo_profile"]);

    const { error: logError } = await context.supabase.rpc("admin_log_action", {
      _action: "delete_account",
      _target_table: "users",
      _target_id: data.userId,
      _details: { reason: data.reason },
    });
    if (logError) throw new Error(adminErrorMessage(logError.message));

    const { removeUserFiles } = await import("@/features/account/user-files.server");
    await removeUserFiles(data.userId, "admin");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) {
      const { logServerError } = await import("@/features/journal/server-errors.server");
      await logServerError("admin", `Suppression impossible : ${error.message}`, {
        details: { membre: data.userId },
      });
      throw new Error(ADMIN_ERRORS["delete_failed"]);
    }
    return { deleted: true };
  });
