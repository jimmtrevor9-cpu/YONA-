import { createFileRoute } from "@tanstack/react-router";

/**
 * Notifications de paiement Stripe (webhook). Adresse à déclarer chez Stripe :
 * https://<votre-domaine>/api/stripe-webhook — événement `checkout.session.completed`.
 *
 * La signature est vérifiée avec `STRIPE_WEBHOOK_SECRET` ; seul ce chemin peut confirmer
 * un paiement Stripe, via `confirm_payment` (rôle service) qui revérifie le montant et la
 * devise. L'activation (Premium ou déblocage) est ensuite faite par la base.
 */
export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const { verifyStripeSignature } = await import("@/features/payments/stripe.server");
        const valid = await verifyStripeSignature(
          payload,
          request.headers.get("stripe-signature"),
          process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
        );
        if (!valid) return new Response("Signature invalide", { status: 400 });

        let event: {
          type?: string;
          data?: {
            object?: {
              id?: string;
              payment_status?: string;
              amount_total?: number;
              currency?: string;
              metadata?: { payment_id?: string };
              client_reference_id?: string;
            };
          };
        };
        try {
          event = JSON.parse(payload);
        } catch {
          return new Response("Contenu invalide", { status: 400 });
        }
        if (event.type !== "checkout.session.completed") {
          return new Response("Ignoré", { status: 200 });
        }
        const session = event.data?.object ?? {};
        const paymentId = session.metadata?.payment_id ?? session.client_reference_id;
        if (session.payment_status !== "paid" || !paymentId || !session.id) {
          return new Response("Ignoré", { status: 200 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: status, error } = await supabaseAdmin.rpc("confirm_payment", {
          _payment_id: paymentId,
          _provider: "stripe",
          _provider_transaction_id: session.id,
          _amount: session.amount_total ?? -1,
          _currency: session.currency ?? "",
        });
        if (error) {
          // Paiement inconnu ou déjà traité : Stripe n'a pas besoin de réessayer.
          console.error("[Stripe] Confirmation refusée :", error.message);
          const retry = !/payment_not_found|payment_already_confirmed|payment_not_pending/.test(
            error.message,
          );
          return new Response("Refusé", { status: retry ? 500 : 200 });
        }
        return new Response(JSON.stringify({ status }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
