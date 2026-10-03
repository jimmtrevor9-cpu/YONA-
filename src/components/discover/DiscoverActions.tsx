import { Crown, Heart, LoaderCircle, Lock, MessageCircle, RotateCcw, X, Zap } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DiscoverActionsProps {
  name: string;
  /** Membre Premium : « revenir » et « Message Flash » disponibles sans redirection. */
  viewerPremium: boolean;
  isLiked: boolean;
  isLikePending: boolean;
  disabled?: boolean;
  /** Profil de démonstration : il ne peut pas recevoir de message. */
  isDemo: boolean;
  /** Plus de demande de contact gratuite aujourd'hui. */
  messageLocked: boolean;
  onUndo: () => void;
  onPass: () => void;
  onLike: () => void;
  onFlash: () => void;
  onMessage: () => void;
}

function RoundButton({
  label,
  onClick,
  disabled,
  className,
  size = "md",
  badge,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  size?: "md" | "lg";
  badge?: ReactNode;
  children: ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 border-white/80 shadow-[0_10px_24px_-8px_rgb(0_0_0/0.55)] transition-transform active:scale-90 disabled:opacity-60",
        size === "lg"
          ? "size-16 min-[360px]:size-[4.6rem] sm:size-20"
          : "size-12 min-[360px]:size-14 sm:size-16",
        className,
      )}
    >
      {children}
      {badge ? <span className="absolute -right-1 -top-1">{badge}</span> : null}
    </button>
  );
}

/**
 * Les 5 boutons du modèle : revenir (Premium), passer, aimer, Message Flash (Premium),
 * demande de contact. Les règles (Premium, quotas, démonstration) restent appliquées par
 * le serveur ; ici, seulement l'affichage.
 */
export function DiscoverActions({
  name,
  viewerPremium,
  isLiked,
  isLikePending,
  disabled = false,
  isDemo,
  messageLocked,
  onUndo,
  onPass,
  onLike,
  onFlash,
  onMessage,
}: DiscoverActionsProps) {
  return (
    <div className="flex w-full items-center justify-between gap-1" data-testid="discover-actions">
      <RoundButton
        label={
          viewerPremium ? "Revenir au profil précédent" : "Revenir au profil précédent (Premium)"
        }
        onClick={onUndo}
        disabled={disabled}
        className="bg-surface text-gold"
        badge={
          viewerPremium ? null : (
            <Crown className="size-5 fill-gold-soft text-gold drop-shadow" aria-hidden />
          )
        }
        testId="discover-undo"
      >
        <RotateCcw className="size-6 min-[360px]:size-7" aria-hidden />
      </RoundButton>
      <RoundButton
        label={`Passer le profil de ${name}`}
        onClick={onPass}
        disabled={disabled || isLikePending}
        className="bg-surface text-destructive"
        testId="discover-pass"
      >
        <X className="size-7 min-[360px]:size-8" strokeWidth={3} aria-hidden />
      </RoundButton>
      <RoundButton
        label={isLiked ? `Profil de ${name} aimé` : `Liker le profil de ${name}`}
        onClick={onLike}
        disabled={disabled || isLiked || isLikePending}
        className="bg-gradient-to-br from-primary to-gold text-primary-foreground"
        size="lg"
        testId="discover-like"
      >
        {isLikePending ? (
          <LoaderCircle className="size-9 animate-spin" aria-hidden />
        ) : (
          <Heart className="size-9 fill-current" aria-hidden />
        )}
      </RoundButton>
      <RoundButton
        label={
          isDemo
            ? "Message Flash indisponible : profil de démonstration"
            : viewerPremium
              ? `Envoyer un Message Flash à ${name}`
              : "Message Flash (Premium)"
        }
        onClick={onFlash}
        disabled={disabled}
        className="bg-gradient-to-br from-gold-soft to-gold text-primary-foreground"
        badge={
          viewerPremium ? null : (
            <Crown className="size-5 fill-gold-soft text-gold drop-shadow" aria-hidden />
          )
        }
        testId="discover-flash"
      >
        <Zap className="size-6 fill-current min-[360px]:size-7" aria-hidden />
      </RoundButton>
      <RoundButton
        label={
          isDemo
            ? "Demande de contact indisponible : profil de démonstration"
            : `Envoyer une demande de contact à ${name}`
        }
        onClick={onMessage}
        disabled={disabled}
        className="bg-surface text-primary"
        badge={
          isDemo || messageLocked ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-gold text-primary-foreground ring-2 ring-white">
              <Lock className="size-3.5" aria-hidden />
            </span>
          ) : null
        }
        testId="discover-message"
      >
        <MessageCircle className="size-6 min-[360px]:size-7" aria-hidden />
      </RoundButton>
    </div>
  );
}
