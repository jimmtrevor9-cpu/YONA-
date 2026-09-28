import { useQuery } from "@tanstack/react-query";

import { PRESENCE_LABELS, presenceQuery } from "@/features/activity/presence";
import { cn } from "@/lib/utils";

/**
 * Statut de présence d'un membre (« En ligne », « Actif récemment »…), calculé par le
 * serveur. Rien n'est affiché si le statut est inconnu ou non consultable.
 */
export function PresenceBadge({ userId, className }: { userId: string; className?: string }) {
  const { data } = useQuery({ ...presenceQuery(userId), enabled: !!userId });
  if (!data || data === "unknown") return null;
  const online = data === "online";
  return (
    <p
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      data-testid="presence"
      data-presence={data}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          online ? "bg-success" : "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      {PRESENCE_LABELS[data]}
    </p>
  );
}
