import { LockOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { formatUnlockDate } from "@/features/messaging/quota";
import { CONVERSATION_UNLOCK, formatDays, formatUsdShort } from "@/features/monetization/rules";

interface UnlockOfferProps {
  conversationId: string;
  otherName: string;
  /** Fin du dernier déblocage terminé, s'il y en a eu un. */
  expiredAt?: string | null;
}

/**
 * Offre de déblocage d'une conversation, affichée quand le serveur signale que les
 * messages gratuits sont épuisés (étape 7.1).
 */
export function UnlockOffer({ conversationId, otherName, expiredAt = null }: UnlockOfferProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      data-testid="unlock-offer"
      className="panel gold-thread space-y-3 p-4 text-center"
    >
      <LockOpen className="mx-auto size-6 text-gold" aria-hidden />
      {expiredAt ? (
        <p className="text-xs text-muted-foreground" data-testid="unlock-expired">
          Le déblocage de cette conversation a expiré le{" "}
          <time dateTime={expiredAt}>{formatUnlockDate(expiredAt)}</time>.
        </p>
      ) : null}
      <h2 id={titleId} className="font-display text-base font-semibold text-foreground">
        Débloquer cette conversation
      </h2>
      <p className="text-sm text-muted-foreground">
        Continuez à écrire à {otherName} sans limite dans cette conversation pendant{" "}
        {formatDays(CONVERSATION_UNLOCK.durationDays)}.
      </p>
      <p className="font-display text-2xl font-semibold text-gold" data-testid="unlock-price">
        {formatUsdShort(CONVERSATION_UNLOCK.amount)}
      </p>
      <p className="text-sm font-medium text-foreground" data-testid="unlock-duration">
        Messages illimités pendant {formatDays(CONVERSATION_UNLOCK.durationDays)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Paiement unique, pour cette conversation seulement. Sans abonnement ni renouvellement
        automatique.
      </p>
      <Button asChild className="w-full">
        <Link to="/messages/$conversationId/debloquer" params={{ conversationId }}>
          Débloquer la conversation pour {formatUsdShort(CONVERSATION_UNLOCK.amount)}
        </Link>
      </Button>
    </section>
  );
}
