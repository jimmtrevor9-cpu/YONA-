import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { PREMIUM_MONTHLY, PREMIUM_YEARLY, formatUsdShort } from "@/features/monetization/rules";
import { startPremiumPayment } from "@/features/payments/premium.functions";
import {
  confirmTestPayment,
  getPaymentAvailability,
  unlockPaymentErrorMessage,
} from "@/features/payments/unlock.functions";
import { FREE_FEATURES, PREMIUM_FEATURES } from "@/features/premium/features";
import { myPremiumQuery, type PremiumPlan } from "@/features/premium/queries";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/premium")({
  validateSearch: z.object({ paiement: z.string().optional() }),
  head: () => ({
    meta: [
      { title: `Premium — ${APP_NAME}` },
      {
        name: "description",
        content: "YONA Premium : 5 USD par mois ou 35 USD par an. Demandes et messages illimités.",
      },
    ],
  }),
  component: PremiumPage,
});

const PLANS: Record<
  PremiumPlan,
  { label: string; price: string; period: string; note: string | null }
> = {
  premium_monthly: {
    label: "Mensuel",
    price: formatUsdShort(PREMIUM_MONTHLY.amount),
    period: "par mois",
    note: null,
  },
  premium_yearly: {
    label: "Annuel",
    price: formatUsdShort(PREMIUM_YEARLY.amount),
    period: "par an",
    note: "Soit environ 2,92 USD par mois : 5 mois offerts",
  },
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Page Premium : formules, avantages, paiement et état de l'abonnement. */
function PremiumPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useQuery({ ...myPremiumQuery(userId), enabled: !!userId });
  const fetchAvailability = useServerFn(getPaymentAvailability);
  const availability = useQuery({
    queryKey: ["payments", "availability"],
    queryFn: () => fetchAvailability(),
    staleTime: 5 * 60 * 1000,
  });
  const [plan, setPlan] = useState<PremiumPlan>("premium_yearly");
  const start = useServerFn(startPremiumPayment);
  const payment = useMutation({
    mutationFn: (selected: PremiumPlan) => start({ data: { plan: selected } }),
    onSuccess: (result) => {
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    },
  });
  const confirmTest = useServerFn(confirmTestPayment);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["premium"] });
  const confirmation = useMutation({
    mutationFn: (paymentId: string) => confirmTest({ data: { paymentId } }),
    onSuccess: () => {
      void refresh();
      // Toutes les limites changent : les quotas affichés sont relus.
      void queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["ai"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });

  // Retour de la page de paiement Stripe : l'activation arrive par la notification signée,
  // quelques secondes plus tard. L'état est relu régulièrement pendant une minute.
  const returning = search.paiement === "ok";
  useEffect(() => {
    if (!returning || me?.premium) return;
    const timer = setInterval(() => void refresh(), 3000);
    const stop = setTimeout(() => clearInterval(timer), 60000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returning, me?.premium]);

  const selected = PLANS[plan];

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="YONA Premium" />
      <main className="mx-auto max-w-md space-y-5 px-5 py-6" data-testid="premium-page">
        <section className="panel gold-thread space-y-2 p-5 text-center">
          <Crown className="mx-auto size-8 text-gold" aria-hidden />
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Rencontrez sans limites
          </h2>
          <p className="text-sm text-muted-foreground">
            Demandes, messages et Roi Salomon illimités, et bien plus, pour des rencontres
            sérieuses.
          </p>
        </section>

        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : me?.premium ? (
          <section className="panel-2 space-y-1 p-4" data-testid="premium-active" role="status">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              Vous êtes membre Premium <PremiumBadge />
            </p>
            <p className="text-xs text-muted-foreground" data-testid="premium-expires">
              {me.plan === "premium_yearly" ? "Formule annuelle" : "Formule mensuelle"} · actif
              jusqu'au {dateFormat.format(new Date(me.expiresAt))}. Sans renouvellement automatique
              : vous pouvez prolonger à tout moment, la nouvelle période s'ajoute à la fin de
              l'actuelle.
            </p>
          </section>
        ) : me && me.expiredAt ? (
          <p className="panel-2 p-4 text-xs text-muted-foreground" data-testid="premium-expired">
            Votre abonnement Premium a pris fin le {dateFormat.format(new Date(me.expiredAt))}. Vous
            pouvez le reprendre ci-dessous.
          </p>
        ) : null}

        {returning && !me?.premium ? (
          <p className="panel-2 p-4 text-xs text-muted-foreground" role="status">
            Paiement reçu : l'activation de Premium est en cours, cela peut prendre quelques
            secondes.
          </p>
        ) : null}

        <section aria-label="Choisir une formule" className="space-y-3">
          <p className="eyebrow">Choisissez votre formule</p>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Formule Premium">
            {(Object.keys(PLANS) as PremiumPlan[]).map((key) => {
              const p = PLANS[key];
              const active = plan === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`plan-${key}`}
                  onClick={() => {
                    setPlan(key);
                    payment.reset();
                    confirmation.reset();
                  }}
                  className={cn(
                    "panel relative space-y-1 p-4 text-left transition-colors",
                    active ? "ring-2 ring-gold" : "hover:bg-surface-2",
                  )}
                >
                  {key === "premium_yearly" ? (
                    <span className="absolute -top-2 right-3 rounded-full bg-gold px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      -42 %
                    </span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">{p.label}</span>
                  <span className="block font-display text-2xl font-semibold text-gold">
                    {p.price}
                  </span>
                  <span className="block text-xs text-muted-foreground">{p.period}</span>
                </button>
              );
            })}
          </div>
          {selected.note ? (
            <p className="text-center text-xs text-gold-soft">{selected.note}</p>
          ) : null}
        </section>

        <section className="panel space-y-3 p-5" aria-label="Paiement" data-testid="payment-box">
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
            <div className="space-y-2 text-center" data-testid="payment-confirmed" role="status">
              <Check className="mx-auto size-6 text-gold" aria-hidden />
              <p className="text-sm font-medium text-foreground">
                Paiement confirmé : bienvenue dans Premium !
              </p>
              <p className="text-xs text-muted-foreground">
                Tous les avantages Premium sont actifs dès maintenant.
              </p>
            </div>
          ) : payment.isSuccess && !payment.data.checkoutUrl ? (
            <div className="space-y-3 text-center" data-testid="payment-pending" role="status">
              <p className="text-sm font-medium text-foreground">
                Paiement créé, en attente de confirmation.
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
                onClick={() => payment.mutate(plan)}
                data-testid="premium-pay"
              >
                {payment.isPending
                  ? "Préparation du paiement…"
                  : `${me?.premium ? "Prolonger" : "Payer"} ${selected.price} (${selected.label.toLowerCase()})`}
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
            Paiement unique, sans renouvellement automatique. Montant vérifié par le serveur.
          </p>
        </section>

        <section className="panel gold-thread space-y-3 p-5" data-testid="premium-features">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            Premium <PremiumBadge />
          </h3>
          <p className="text-xs text-muted-foreground">Tout ce qui est gratuit, plus :</p>
          <ul className="space-y-2 text-sm text-foreground">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="panel space-y-3 p-5" data-testid="free-features">
          <h3 className="font-display text-lg font-semibold text-foreground">Gratuit · 0 USD</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
