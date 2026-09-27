import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { readPaymentAvailability } from "./provider";

export const UNLOCK_PAYMENT_ERRORS = {
  not_authenticated: "Votre session a expiré. Reconnectez-vous pour continuer.",
  payment_provider_unavailable: "Le paiement en ligne n'est pas encore disponible.",
  conversation_unavailable: "Cette conversation n'est plus disponible.",
  unlock_already_active: "Cette conversation est déjà débloquée.",
} as const;

type UnlockPaymentErrorCode = keyof typeof UNLOCK_PAYMENT_ERRORS;

const errorCode = (message: string | undefined): UnlockPaymentErrorCode | null =>
  (Object.keys(UNLOCK_PAYMENT_ERRORS) as UnlockPaymentErrorCode[]).find((code) =>
    message?.includes(code),
  ) ?? null;

/** Disponibilité du paiement en ligne (lue sur le serveur, jamais dans le navigateur). */
export const getPaymentAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => readPaymentAvailability(process.env));

const startInput = z.object({
  conversationId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
});

/**
 * Démarre le paiement du déblocage d'une conversation : crée (ou réutilise) un paiement
 * « en attente ». Montant et devise sont fixés par la base ; rien n'est confirmé ici.
 */
export const startUnlockPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startInput.parse(data))
  .handler(async ({ data, context }) => {
    const availability = readPaymentAvailability(process.env);
    if (!availability.available || !availability.provider) {
      throw new Error(UNLOCK_PAYMENT_ERRORS.payment_provider_unavailable);
    }
    const { data: paymentId, error } = await context.supabase.rpc(
      "start_conversation_unlock_payment",
      { _conversation_id: data.conversationId, _provider: availability.provider },
    );
    if (error) {
      const code = errorCode(error.message);
      if (code) throw new Error(UNLOCK_PAYMENT_ERRORS[code]);
      throw error;
    }
    return { paymentId: paymentId as string, testMode: availability.testMode };
  });

/** Message à afficher pour une erreur de démarrage du paiement. */
export function unlockPaymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : undefined;
  if (message && (Object.values(UNLOCK_PAYMENT_ERRORS) as string[]).includes(message)) {
    return message;
  }
  return "Le paiement n'a pas pu démarrer. Vérifiez votre connexion et réessayez.";
}
