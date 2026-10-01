import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Crown } from "lucide-react";

import { PremiumBadge } from "@/components/PremiumBadge";
import { myPremiumQuery } from "@/features/premium/queries";

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });

/** Carte « Premium » du profil : état de l'abonnement et accès à la page /premium. */
export function PremiumCard({ userId }: { userId: string }) {
  const { data } = useQuery(myPremiumQuery(userId));
  const active = data?.premium === true;
  return (
    <Link
      to="/premium"
      className="panel-2 flex items-center gap-3 p-4 transition-colors hover:bg-surface-2"
      data-testid="premium-link"
    >
      <Crown className="size-4 shrink-0 text-gold" aria-hidden />
      <span className="flex-1">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          {active ? "Mon abonnement Premium" : "Passer en Premium"}
          {active ? <PremiumBadge /> : null}
        </span>
        <span className="block text-xs text-muted-foreground">
          {data?.premium
            ? `Actif jusqu'au ${DATE_FORMAT.format(new Date(data.expiresAt))}`
            : "Demandes, messages et Roi Salomon illimités"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
