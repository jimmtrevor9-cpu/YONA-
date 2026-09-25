import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const likeProfileInput = z.object({
  receiverId: z.string().uuid(),
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
    return { receiverId: data.receiverId };
  });
