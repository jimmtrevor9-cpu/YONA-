// Stripe — SERVEUR UNIQUEMENT (importé dynamiquement dans les gestionnaires serveur).
// Utilise l'API REST de Stripe directement (pas de dépendance supplémentaire).

/** Adresse de l'API Stripe (modifiable seulement pour les tests locaux, avec un faux Stripe). */
const stripeApi = () =>
  (process.env["STRIPE_API_URL"] ?? "").trim().replace(/\/+$/, "") || "https://api.stripe.com/v1";

export interface CheckoutInput {
  paymentId: string;
  /** Montant en cents USD, lu depuis la base (jamais depuis le navigateur). */
  amount: number;
  currency: string;
  label: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
}

/** Crée une page de paiement Stripe Checkout et renvoie son adresse. */
export async function createStripeCheckout(input: CheckoutInput): Promise<string> {
  const secret = process.env["STRIPE_SECRET_KEY"] ?? "";
  const body = new URLSearchParams({
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.paymentId,
    "metadata[payment_id]": input.paymentId,
    "payment_intent_data[metadata][payment_id]": input.paymentId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.label,
    locale: "fr",
  });
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  const res = await fetch(`${stripeApi()}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Un même paiement YONA ne crée qu'une page de paiement.
      "Idempotency-Key": `yona-${input.paymentId}`,
    },
    body,
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) {
    const { logServerError } = await import("@/features/journal/server-errors.server");
    await logServerError(
      "stripe",
      `Création du paiement impossible : ${json.error?.message ?? res.status}`,
    );
    throw new Error("stripe_checkout_failed");
  }
  return json.url;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Vérifie la signature d'une notification Stripe (en-tête `Stripe-Signature`) :
 * HMAC-SHA256 du texte « horodatage.contenu » avec le secret du webhook, et horodatage
 * de moins de 5 minutes (protection contre le rejeu).
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!timestamp || !signatures.length) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(nowSeconds - sentAt) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = toHex(
    await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`)),
  );
  return signatures.some((s) => safeEqual(s, expected));
}
