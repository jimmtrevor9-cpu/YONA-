import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FAVORITE_ERRORS = {
  unavailable: "Ce profil n'est plus disponible.",
} as const;

const favoriteInput = z.object({
  // Forme canonique (minuscules) : « ABC… » et « abc… » désignent le même membre.
  profileId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
});

/**
 * Ajoute un profil aux favoris de la personne connectée. Les règles d'accès de la base
 * vérifient tout : pour soi-même, profil ajouté visible et actif, pas de blocage, profil
 * de la personne connectée actif ; la date est fixée par le serveur.
 */
export const addFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => favoriteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("favorites")
      .insert({ user_id: context.userId, favorite_user_id: data.profileId });
    if (error) {
      // Déjà en favori (autre onglet, double clic…) : la contrainte d'unicité de la base
      // garantit un seul favori par couple ; rien n'est écrit une seconde fois.
      if (error.code === "23505") return { profileId: data.profileId, alreadyFavorite: true };
      // Règle d'accès non respectée (profil masqué, suspendu, bloqué…).
      if (error.code === "42501") throw new Error(FAVORITE_ERRORS.unavailable);
      throw error;
    }
    return { profileId: data.profileId, alreadyFavorite: false };
  });

/**
 * Retire un profil des favoris de la personne connectée. La règle d'accès de la base ne
 * laisse retirer que ses propres favoris ; le retrait reste possible même si le profil
 * est depuis masqué, suspendu ou bloqué. Retirer un profil qui n'est pas (ou plus) en
 * favori ne fait rien.
 */
export const removeFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => favoriteInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: removed, error } = await context.supabase
      .from("favorites")
      .delete()
      .eq("user_id", context.userId)
      .eq("favorite_user_id", data.profileId)
      .select("id");
    if (error) throw error;
    return { profileId: data.profileId, wasFavorite: (removed ?? []).length > 0 };
  });

/** Message à afficher pour une erreur de favori. */
export function favoriteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : undefined;
  if (message && (Object.values(FAVORITE_ERRORS) as string[]).includes(message)) return message;
  return "Le favori n'a pas pu être mis à jour. Vérifiez votre connexion et réessayez.";
}
