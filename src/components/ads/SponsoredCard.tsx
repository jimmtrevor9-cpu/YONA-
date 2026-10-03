import { ExternalLink, Megaphone, MessageCircle, Phone, X } from "lucide-react";

import { AdMedia } from "@/components/ads/AdMedia";
import { useAdView } from "@/components/ads/useAdView";
import { recordAdEvent, type AdCtaIcon, type SponsoredAd } from "@/features/ads/ads";
import { cn } from "@/lib/utils";

const CTA_ICONS: Record<AdCtaIcon, typeof ExternalLink> = {
  external: ExternalLink,
  message: MessageCircle,
  phone: Phone,
};

/**
 * Publicité plein cadre dans la pile Découvrir, sur le modèle des captures fournies :
 * étiquette « Sponsorisé » en haut à gauche, média sur toute la carte, titre et texte en
 * bas, boutons « Passer » et action. Couleurs YONA.
 * `preview` : aperçu dans l'administration (aucune vue ni aucun clic compté).
 */
export function SponsoredCard({
  ad,
  onSkip,
  onClicked,
  preview = false,
  dragX = 0,
  className,
}: {
  ad: SponsoredAd;
  onSkip: () => void;
  onClicked?: () => void;
  preview?: boolean;
  dragX?: number;
  className?: string;
}) {
  const ref = useAdView<HTMLElement>(preview ? null : ad.id, "discover");
  const Icon = CTA_ICONS[ad.ctaIcon] ?? ExternalLink;
  return (
    <article
      ref={ref}
      className={cn(
        "@container relative h-full w-full select-none overflow-hidden rounded-[2rem] border-2 border-primary/60 bg-black shadow-[0_24px_60px_-24px_oklch(0.3_0.05_340/55%)]",
        className,
      )}
      aria-label={`Publicité : ${ad.title}`}
      data-testid="sponsored-card"
    >
      <AdMedia
        type={ad.mediaType}
        src={ad.mediaUrl}
        poster={ad.posterUrl}
        className="absolute inset-0 size-full"
        soundButtonClassName="absolute right-4 top-4"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute left-4 top-4 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-sm font-semibold text-primary-foreground shadow-md">
          <Megaphone className="size-4" aria-hidden />
          Sponsorisé
        </span>
        {ad.advertiser ? (
          <span className="max-w-full truncate rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-md">
            {ad.advertiser}
          </span>
        ) : null}
      </div>

      {dragX < -40 ? (
        <span className="absolute right-6 top-24 rotate-12 rounded-xl border-4 border-white/90 px-3 py-1 text-2xl font-bold text-white">
          PASSER
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-4 pb-4 pt-24">
        <h2 className="line-clamp-1 font-display text-lg font-bold text-white @[22rem]:text-2xl">
          {ad.title}
        </h2>
        {ad.body ? <p className="mt-1 line-clamp-2 text-sm text-white/85">{ad.body}</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2 @[22rem]:gap-3">
          <button
            type="button"
            onClick={() => {
              if (!preview) recordAdEvent(ad.id, "skip", "discover");
              onSkip();
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/35 bg-white/10 text-sm font-medium @[22rem]:h-12 @[22rem]:gap-2 @[22rem]:text-base text-white backdrop-blur-md transition-colors hover:bg-white/20"
            data-testid="ad-skip"
          >
            <X className="size-4 @[22rem]:size-5" aria-hidden />
            Passer
          </button>
          <a
            href={ad.ctaUrl}
            target="_blank"
            rel="noopener noreferrer sponsored nofollow"
            onClick={() => {
              if (!preview) recordAdEvent(ad.id, "click", "discover");
              onClicked?.();
            }}
            className="inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-gold px-2.5 text-sm font-semibold @[22rem]:h-12 @[22rem]:gap-2 @[22rem]:px-3 @[22rem]:text-base text-white shadow-md transition-opacity hover:opacity-90"
            data-testid="ad-cta"
          >
            <Icon className="size-4 shrink-0 @[22rem]:size-5" aria-hidden />
            <span className="truncate">{ad.ctaLabel}</span>
          </a>
        </div>
      </div>
    </article>
  );
}
