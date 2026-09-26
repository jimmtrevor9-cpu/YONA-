import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const likeProfileInput = z.object({
  // Forme canonique (minuscules) : « ABC… » et « abc… » désignent le même membre.
  receiverId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
});

/** Enregistre uniquement l'intention Like de la personne connectée. */
export const likeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => likeProfileInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.receiverId === context.userId) {
      throw new Error("Vous ne pouvez pas liker votre propre profil.");
    }

    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", data.receiverId)
      .eq("status", "active")
      .eq("visibility", "visible")
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) throw new Error("Ce profil n'est plus disponible.");

    // Un seul Like par couple (contrainte UNIQUE en base) : un Like déjà actif n'est pas
    // réécrit, la réponse l'indique simplement.
    const { data: existing, error: existingError } = await context.supabase
      .from("likes")
      .select("kind, status")
      .eq("sender_id", context.userId)
      .eq("receiver_id", data.receiverId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.kind === "like" && existing.status === "active") {
      return { receiverId: data.receiverId, alreadyLiked: true };
    }

    const { error } = await context.supabase.from("likes").upsert(
      {
        sender_id: context.userId,
        receiver_id: data.receiverId,
        kind: "like",
        status: "active",
      },
      { onConflict: "sender_id,receiver_id" },
    );

    if (error) throw error;
    return { receiverId: data.receiverId, alreadyLiked: false };
  });
