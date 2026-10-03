import { ExternalLink, Megaphone, MessageCircle, Phone, X } from "lucide-react";

import { AdMedia } from "@/components/ads/AdMedia";
import { useAdView } from "@/components/ads/useAdView";
import {
  recordAdEvent,
  type AdCtaIcon,
  type AdPlacement,
  type SponsoredAd,
} from "@/features/ads/ads";

const CTA_ICONS: Record<AdCtaIcon, typeof ExternalLink> = {
  external: ExternalLink,
  message: MessageCircle,
  phone: Phone,
};

/** Publicité dans une liste (Matchs, Messages) : même cadre que les lignes de la liste. */
export function SponsoredBanner({
  ad,
  placement,
  onHide,
  preview = false,
}: {
  ad: SponsoredAd;
  placement: AdPlacement;
  onHide: () => void;
  preview?: boolean;
}) {
  const ref = useAdView<HTMLDivElement>(preview ? null : ad.id, placement);
  const Icon = CTA_ICONS[ad.ctaIcon] ?? ExternalLink;
  return (
    <div
      ref={ref}
      className="panel relative flex gap-3 overflow-hidden p-3"
      aria-label={`Publicité : ${ad.title}`}
      data-testid="sponsored-banner"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-black sm:size-24">
        <AdMedia
          type={ad.mediaType}
          src={ad.mediaUrl}
          poster={ad.posterUrl}
          className="absolute inset-0 size-full"
          soundButtonClassName="absolute bottom-1 right-1 size-7 [&_svg]:size-3.5"
        />
      </div>
      <div className="min-w-0 flex-1 pr-6">
        <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-primary-foreground">
            <Megaphone className="size-3" aria-hidden />
            Sponsorisé
          </span>
          {ad.advertiser ? (
            <span className="truncate font-semibold uppercase text-muted-foreground">
              {ad.advertiser}
            </span>
          ) : null}
        </p>
        <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{ad.title}</p>
        {ad.body ? <p className="line-clamp-2 text-xs text-muted-foreground">{ad.body}</p> : null}
        <a
          href={ad.ctaUrl}
          target="_blank"
          rel="noopener noreferrer sponsored nofollow"
          onClick={() => {
            if (!preview) recordAdEvent(ad.id, "click", placement);
          }}
          className="mt-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-gold px-3 text-xs font-semibold text-white"
          data-testid="ad-cta"
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{ad.ctaLabel}</span>
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          if (!preview) recordAdEvent(ad.id, "skip", placement);
          onHide();
        }}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        aria-label="Masquer cette publicité"
        data-testid="ad-hide"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
