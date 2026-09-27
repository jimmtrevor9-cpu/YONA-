import { LockOpen } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { CONVERSATION_UNLOCK, formatUsdShort } from "@/features/monetization/rules";

interface UnlockOfferProps {
  otherName: string;
}

/**
 * Offre de déblocage d'une conversation, affichée quand le serveur signale que les
 * messages gratuits sont épuisés (étape 7.1).
 */
export function UnlockOffer({ otherName }: UnlockOfferProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      data-testid="unlock-offer"
      className="panel gold-thread space-y-3 p-4 text-center"
    >
      <LockOpen className="mx-auto size-6 text-gold" aria-hidden />
      <h2 id={titleId} className="font-display text-base font-semibold text-foreground">
        Débloquer cette conversation
      </h2>
      <p className="text-sm text-muted-foreground">
        Continuez à écrire à {otherName} sans limite dans cette conversation.
      </p>
      <p className="font-display text-2xl font-semibold text-gold" data-testid="unlock-price">
        {formatUsdShort(CONVERSATION_UNLOCK.amount)}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Paiement unique, pour cette conversation seulement.
      </p>
      <Button type="button" className="w-full" disabled>
        Débloquer la conversation pour {formatUsdShort(CONVERSATION_UNLOCK.amount)}
      </Button>
      <p className="text-[11px] text-muted-foreground">Le paiement arrive très bientôt.</p>
    </section>
  );
}
