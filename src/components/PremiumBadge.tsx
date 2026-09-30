import { BadgeCheck } from "lucide-react";

import { cn } from "@/lib/utils";

/** Badge « Premium vérifié » (abonnement actif vérifié par le serveur). */
export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-gold",
        className,
      )}
      title="Membre Premium vérifié"
      data-testid="premium-badge"
    >
      <BadgeCheck className="size-3" aria-hidden />
      Premium
    </span>
  );
}
