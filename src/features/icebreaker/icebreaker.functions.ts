import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { readAiAvailability } from "@/features/ai/provider";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ICE_BREAKER_ERRORS = {
  premium_required: "L'Ice Breaker personnalisé est réservé aux membres Premium.",
  ai_unavailable: "Les suggestions personnalisées ne sont pas encore disponibles.",
  conversation_unavailable: "Cette conversation n'est plus disponible.",
  provider_error: "La suggestion n'a pas pu être créée pour le moment. Réessayez.",
} as const;

const SYSTEM_PROMPT = `Tu aides un membre de YONA, une application de rencontre chrétienne pour des relations sérieuses, à écrire un premier message à une personne avec qui il a un Match.

Écris UN seul message d'ouverture :
- en français, chaleureux, respectueux, en vouvoyant la personne ;
- 1 à 3 phrases, 280 caractères au plus ;
- personnalisé à partir du profil fourni (intérêts, présentation, foi), avec une question ouverte ;
- sans flatterie sur le physique, sans numéro de téléphone, sans lien, sans adresse ;
- sans guillemets, sans explication : uniquement le texte du message.`;

const input = z.object({ conversationId: z.string().uuid() });

/**
 * 16.3 / 16.4 — Suggestion personnalisée par l'IA, réservée au Premium (vérifié ici, sur
 * le serveur). Le profil de l'autre personne est lu avec les droits de la personne
 * connectée : seulement si elle participe à la conversation.
 */
export const generateIceBreaker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: premium, error: premiumError } = await supabase.rpc("is_premium", {
      _user_id: userId,
    });
    if (premiumError) throw premiumError;
    if (premium !== true) throw new Error(ICE_BREAKER_ERRORS.premium_required);

    const availability = readAiAvailability(process.env);
    if (!availability.available || !availability.provider) {
      throw new Error(ICE_BREAKER_ERRORS.ai_unavailable);
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("user_1_id, user_2_id, status")
      .eq("id", data.conversationId)
      .maybeSingle();
    if (!conv || conv.status !== "open") {
      throw new Error(ICE_BREAKER_ERRORS.conversation_unavailable);
    }
    const otherId = conv.user_1_id === userId ? conv.user_2_id : conv.user_1_id;
    const [{ data: profile }, { data: faith }] = await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, bio, interests, city")
        .eq("user_id", otherId)
        .maybeSingle(),
      supabase
        .from("christian_profiles")
        .select("denomination, faith_importance, marriage_vision")
        .eq("user_id", otherId)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error(ICE_BREAKER_ERRORS.conversation_unavailable);

    const { data: consumed, error } = await supabase.rpc("consume_ai_quota", {
      _feature: "ice_breaker",
    });
    if (error) throw error;
    if (!(consumed as { allowed: boolean }).allowed) {
      throw new Error(ICE_BREAKER_ERRORS.premium_required);
    }

    const firstName = profile.first_name ?? "cette personne";
    const facts = [
      `Prénom : ${firstName}`,
      profile.city ? `Ville : ${profile.city}` : null,
      profile.interests?.length ? `Intérêts : ${profile.interests.join(", ")}` : null,
      profile.bio ? `Présentation : ${profile.bio.slice(0, 600)}` : null,
      faith?.denomination ? `Dénomination : ${faith.denomination}` : null,
      faith?.faith_importance ? `Importance de la foi : ${faith.faith_importance}` : null,
      faith?.marriage_vision
        ? `Vision du mariage : ${String(faith.marriage_vision).slice(0, 300)}`
        : null,
    ].filter(Boolean);

    const { generateText } = await import("@/features/ai/claude.server");
    let text: string;
    try {
      text = await generateText({
        provider: availability.provider,
        system: SYSTEM_PROMPT,
        maxTokens: 400,
        messages: [{ role: "user", content: `Profil de la personne :\n${facts.join("\n")}` }],
        testReply: `Bonjour ${firstName} ! ${
          profile.interests?.[0]
            ? `Votre intérêt pour « ${profile.interests[0]} » m'a donné envie de vous écrire.`
            : "Votre profil m'a donné envie de vous écrire."
        } Qu'est-ce qui vous rend le plus reconnaissant(e) en ce moment ?`,
      });
    } catch {
      throw new Error(ICE_BREAKER_ERRORS.provider_error);
    }
    const suggestion = text.replace(/^["«\s]+|["»\s]+$/g, "").slice(0, 500);
    // Jamais de numéro de téléphone dans une suggestion (même règle que les messages).
    const { containsPhoneNumber } = await import("@/features/ai/phone.server");
    const hasPhone = await containsPhoneNumber(suggestion);
    if (hasPhone) throw new Error(ICE_BREAKER_ERRORS.provider_error);
    return { suggestion };
  });

export function iceBreakerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if ((Object.values(ICE_BREAKER_ERRORS) as string[]).includes(message)) return message;
  return ICE_BREAKER_ERRORS.provider_error;
}
