import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { readPaymentAvailability } from "./provider";
import { UNLOCK_PAYMENT_ERRORS } from "./unlock.functions";

const startInput = z.object({ plan: z.enum(["premium_monthly", "premium_yearly"]) });

const PLAN_LABELS = {
  premium_monthly: "YONA Premium — 1 mois",
  premium_yearly: "YONA Premium — 1 an",
} as const;

/**
 * Démarre le paiement d'un abonnement Premium (mensuel ou annuel) : la base crée un
 * paiement « en attente » avec le montant officiel (5 USD ou 35 USD). L'abonnement n'est
 * activé qu'à la confirmation du paiement, par le serveur.
 */
export const startPremiumPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => startInput.parse(data))
  .handler(async ({ data, context }) => {
    const availability = readPaymentAvailability(process.env);
    if (!availability.available || !availability.provider) {
      throw new Error(UNLOCK_PAYMENT_ERRORS.payment_provider_unavailable);
    }
    const { data: paymentId, error } = await context.supabase.rpc("start_premium_payment", {
      _plan: data.plan,
      _provider: availability.provider,
    });
    if (error) {
      const code = (
        Object.keys(UNLOCK_PAYMENT_ERRORS) as (keyof typeof UNLOCK_PAYMENT_ERRORS)[]
      ).find((key) => error.message.includes(key));
      if (code) throw new Error(UNLOCK_PAYMENT_ERRORS[code]);
      throw error;
    }
    let checkoutUrl: string | null = null;
    try {
      const { checkoutUrlFor } = await import("./checkout.server");
      checkoutUrl = await checkoutUrlFor({
        provider: availability.provider,
        paymentId: paymentId as string,
        label: PLAN_LABELS[data.plan],
        successPath: "/premium?paiement=ok",
        cancelPath: "/premium",
        email: typeof context.claims.email === "string" ? context.claims.email : null,
      });
    } catch {
      throw new Error(UNLOCK_PAYMENT_ERRORS.stripe_checkout_failed);
    }
    return { paymentId: paymentId as string, testMode: availability.testMode, checkoutUrl };
  });
