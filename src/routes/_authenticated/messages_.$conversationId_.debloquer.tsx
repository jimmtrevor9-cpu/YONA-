import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, LockOpen, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { conversationQuery } from "@/features/messaging/queries";
import { CONVERSATION_UNLOCK, formatDays, formatUsdShort } from "@/features/monetization/rules";
import {
  confirmTestPayment,
  getPaymentAvailability,
  startUnlockPayment,
  unlockPaymentErrorMessage,
} from "@/features/payments/unlock.functions";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/messages_/$conversationId_/debloquer")({
  head: () => ({
    meta: [
      { title: `Débloquer la conversation — ${APP_NAME}` },
      {
        name: "description",
        content: "Paiement du déblocage d'une conversation : messages illimités pendant 3 jours.",
      },
    ],
  }),
  component: UnlockPaymentPage,
});

const PRICE = formatUsdShort(CONVERSATION_UNLOCK.amount);
const DURATION = formatDays(CONVERSATION_UNLOCK.durationDays);

/** Écran de paiement du déblocage d'une conversation (1 USD, 3 jours). */
function UnlockPaymentPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    ...conversationQuery(user?.id ?? "", conversationId),
    enabled: !!user?.id,
  });
  const fetchAvailability = useServerFn(getPaymentAvailability);
  const availability = useQuery({
    queryKey: ["payments", "availability"],
    queryFn: () => fetchAvailability(),
    staleTime: 5 * 60 * 1000,
  });
  const start = useServerFn(startUnlockPayment);
  const payment = useMutation({
    mutationFn: () => start({ data: { conversationId } }),
  });
  const confirmTest = useServerFn(confirmTestPayment);
  const queryClient = useQueryClient();
  const confirmation = useMutation({
    mutationFn: (paymentId: string) => confirmTest({ data: { paymentId } }),
    // Le déblocage vient d'être activé par le serveur : la conversation est relue.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
  const name = data?.firstName ?? "Membre";

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Débloquer la conversation" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="unlock-payment-page">
        <Link
          to="/messages/$conversationId"
          params={{ conversationId }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Retour à la conversation
        </Link>

        {isLoading ? (
          <Skeleton className="h-60 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Cette page n'a pas pu être chargée. Réessayez dans un instant.
          </p>
        ) : !data ? (
          <div className="panel space-y-4 p-6 text-center" data-testid="unlock-unavailable">
            <p className="text-sm text-muted-foreground">
              Cette conversation n'est pas disponible.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/messages">Retour à mes messages</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="panel gold-thread space-y-4 p-5" aria-label="Récapitulatif">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 ring-1 ring-gold/20">
                  {data.photoUrl ? (
                    <AvatarImage
                      src={data.photoUrl}
                      alt={`Photo de ${name}`}
                      className="object-cover"
                    />
                  ) : null}
                  <AvatarFallback className="bg-accent font-display text-lg text-gold-soft">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Conversation avec</p>
                  <h2 className="truncate font-display text-lg font-semibold text-foreground">
                    {name}
                  </h2>
                </div>
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Déblocage de la conversation</span>
                <span
                  className="font-display text-2xl font-semibold text-gold"
                  data-testid="payment-price"
                >
                  {PRICE}
                </span>
              </div>
              <ul className="space-y-2 text-sm text-foreground" aria-label="Ce qui est inclus">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  Messages illimités dans cette conversation pendant {DURATION}
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  Paiement unique, sans abonnement ni renouvellement automatique
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  Activation dès la confirmation du paiement
                </li>
              </ul>
            </section>

            <section
              className="panel space-y-3 p-5"
              aria-label="Paiement"
              data-testid="payment-box"
            >
              {availability.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : !availability.data?.available ? (
                <div className="space-y-2 text-center" data-testid="payment-not-available">
                  <p className="text-sm font-medium text-foreground">
                    Le paiement en ligne n'est pas encore disponible.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Aucun paiement ne peut être effectué pour le moment. Revenez bientôt.
                  </p>
                </div>
              ) : confirmation.isSuccess ? (
                <div
                  className="space-y-2 text-center"
                  data-testid="payment-confirmed"
                  role="status"
                >
                  <Check className="mx-auto size-6 text-gold" aria-hidden />
                  <p className="text-sm font-medium text-foreground">Paiement confirmé.</p>
                  <p className="text-xs text-muted-foreground">
                    Votre paiement de {PRICE} a bien été enregistré. Le déblocage de la conversation
                    avec {name} est activé pour {DURATION}.
                  </p>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/messages/$conversationId" params={{ conversationId }}>
                      Revenir à la conversation
                    </Link>
                  </Button>
                </div>
              ) : payment.isSuccess ? (
                <div className="space-y-3 text-center" data-testid="payment-pending" role="status">
                  <LockOpen className="mx-auto size-6 text-gold" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    Paiement créé, en attente de confirmation.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    La conversation sera débloquée dès que le paiement sera confirmé.
                  </p>
                  {payment.data.testMode ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full border border-gold/40"
                      disabled={confirmation.isPending}
                      onClick={() => confirmation.mutate(payment.data.paymentId)}
                    >
                      {confirmation.isPending
                        ? "Confirmation…"
                        : "Confirmer le paiement de test (aucun argent réel)"}
                    </Button>
                  ) : null}
                  {confirmation.isError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {unlockPaymentErrorMessage(confirmation.error)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <>
                  {availability.data.testMode ? (
                    <p
                      className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold-soft"
                      data-testid="payment-test-mode"
                    >
                      Mode test : aucun paiement réel ne sera effectué.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full"
                    disabled={payment.isPending}
                    onClick={() => payment.mutate()}
                  >
                    {payment.isPending ? "Préparation du paiement…" : `Payer ${PRICE}`}
                  </Button>
                  {payment.isError ? (
                    <p className="text-center text-xs text-destructive" role="alert">
                      {unlockPaymentErrorMessage(payment.error)}
                    </p>
                  ) : null}
                </>
              )}
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5" aria-hidden />
                Le montant est fixé et vérifié par le serveur.
              </p>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
