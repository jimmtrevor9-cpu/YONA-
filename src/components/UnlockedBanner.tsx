import { LockOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { formatRemaining, formatUnlockDate } from "@/features/messaging/quota";

interface UnlockedBannerProps {
  /** La personne connectée a payé le déblocage en cours. */
  byMe: boolean;
  otherName: string;
  /** Fin de la période débloquée (date ISO, calculée par le serveur). */
  expiresAt: string | null;
  /** Appelé quand la fin est atteinte (l'écran relit l'état auprès du serveur). */
  onExpire?: () => void;
}

/** Bandeau « Conversation débloquée », visible par les deux participants. */
export function UnlockedBanner({ byMe, otherName, expiresAt, onExpire }: UnlockedBannerProps) {
  const [now, setNow] = useState(() => Date.now());

  // Temps restant mis à jour chaque minute ; relecture de l'état à l'heure exacte de fin.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    if (!expiresAt || !onExpire) return;
    const delay = new Date(expiresAt).getTime() - Date.now();
    if (delay > 2 ** 31 - 1) return;
    const timer = setTimeout(onExpire, Math.max(delay, 0) + 500);
    return () => clearTimeout(timer);
  }, [expiresAt, onExpire]);

  return (
    <div
      role="status"
      data-testid="conversation-unlocked"
      className="panel gold-thread flex items-center gap-3 px-4 py-3"
    >
      <LockOpen className="size-5 shrink-0 text-gold" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Conversation débloquée</p>
        <p className="text-xs text-muted-foreground">
          {byMe ? "Débloquée par vous" : `Débloquée par ${otherName}`}, pour vous deux.
        </p>
        {expiresAt ? (
          <p className="text-xs text-gold-soft" data-testid="unlock-expiry">
            Jusqu'au <time dateTime={expiresAt}>{formatUnlockDate(expiresAt)}</time> (encore{" "}
            {formatRemaining(expiresAt, now)})
          </p>
        ) : null}
      </div>
    </div>
  );
}
