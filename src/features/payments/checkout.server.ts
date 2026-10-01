// Démarrage d'un paiement chez le prestataire configuré — SERVEUR UNIQUEMENT.
import { getRequest } from "@tanstack/react-start/server";

import type { PaymentProviderId } from "./provider";

/** Adresse publique de l'application (APP_URL, sinon celle de la requête en cours). */
export function appOrigin(): string {
  const configured = (process.env["APP_URL"] ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const request = getRequest();
  return new URL(request.url).origin;
}

/**
 * Pour Stripe : crée la page de paiement du paiement YONA « en attente » et renvoie son
 * adresse. Montant et devise sont relus dans la base (jamais pris du navigateur).
 * Pour le prestataire de test : rien à faire (`null`).
 */
export async function checkoutUrlFor(options: {
  provider: PaymentProviderId;
  paymentId: string;
  label: string;
  successPath: string;
  cancelPath: string;
  email?: string | null;
}): Promise<string | null> {
  if (options.provider !== "stripe") return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("id, amount, currency, status")
    .eq("id", options.paymentId)
    .single();
  if (error || !payment || payment.status !== "pending") throw new Error("payment_not_pending");
  const { createStripeCheckout } = await import("./stripe.server");
  const origin = appOrigin();
  return createStripeCheckout({
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
    label: options.label,
    successUrl: `${origin}${options.successPath}`,
    cancelUrl: `${origin}${options.cancelPath}`,
    customerEmail: options.email ?? null,
  });
}
