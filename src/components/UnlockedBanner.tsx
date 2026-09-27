import { LockOpen } from "lucide-react";

interface UnlockedBannerProps {
  /** La personne connectée a payé le déblocage en cours. */
  byMe: boolean;
  otherName: string;
}

/** Bandeau « Conversation débloquée », visible par les deux participants. */
export function UnlockedBanner({ byMe, otherName }: UnlockedBannerProps) {
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
      </div>
    </div>
  );
}
