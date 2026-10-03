import { queryOptions, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/features/auth/AuthProvider";
import { myPremiumQuery } from "@/features/premium/queries";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tâche D3 — Publicités sponsorisées. La base ne renvoie des publicités qu'aux membres
 * gratuits (`get_ads_for_me`) : jamais à un membre Premium, à un administrateur ni à un
 * profil de démonstration. Ici, par prudence, rien n'est affiché non plus tant que le
 * statut Premium n'est pas connu ou s'il est actif. Aucun traceur tiers : les médias
 * viennent de l'espace de fichiers de YONA, les vues et clics sont comptés par YONA.
 */
export type AdPlacement = "discover" | "matches" | "messages";
export type AdEvent = "view" | "click" | "skip";
export type AdCtaIcon = "external" | "message" | "phone";

export const ADS_BUCKET = "ads";

export interface SponsoredAd {
  id: string;
  title: string;
  body: string | null;
  advertiser: string | null;
  mediaType: "image" | "video";
  mediaUrl: string;
  posterUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
  ctaIcon: AdCtaIcon;
  /** Une publicité toutes les N cartes (Découvrir) ou N lignes (listes). */
  everyN: number;
}

export function adFileUrl(path: string): string {
  return supabase.storage.from(ADS_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Lien de destination : https uniquement (la base le vérifie aussi). */
export function safeAdUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const myAdsQuery = (userId: string, placement: AdPlacement) =>
  queryOptions({
    queryKey: ["ads", placement, userId],
    staleTime: 60_000,
    queryFn: async (): Promise<SponsoredAd[]> => {
      const { data, error } = await supabase.rpc("get_ads_for_me", {
        _placement: placement,
        _limit: 5,
      });
      if (error) return []; // une publicité ne doit jamais casser la page
      return (data ?? []).flatMap((row) => {
        const ctaUrl = safeAdUrl(row.cta_url);
        if (!ctaUrl) return [];
        return [
          {
            id: row.id,
            title: row.title,
            body: row.body,
            advertiser: row.advertiser,
            mediaType: row.media_type === "video" ? "video" : "image",
            mediaUrl: adFileUrl(row.media_path),
            posterUrl: row.poster_path ? adFileUrl(row.poster_path) : null,
            ctaLabel: row.cta_label,
            ctaUrl,
            ctaIcon: (["external", "message", "phone"].includes(row.cta_icon)
              ? row.cta_icon
              : "external") as AdCtaIcon,
            everyN: Math.max(2, row.every_n || 5),
          } satisfies SponsoredAd,
        ];
      });
    },
  });

/**
 * Publicités à montrer au membre connecté pour un emplacement. Liste vide pour un
 * membre Premium (dès que son abonnement est actif) ou tant que son statut est inconnu.
 */
export function useSponsoredAds(placement: AdPlacement): SponsoredAd[] {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data: premium } = useQuery({ ...myPremiumQuery(userId), enabled: !!userId });
  const isFree = premium?.premium === false;
  const { data: ads } = useQuery({ ...myAdsQuery(userId, placement), enabled: !!userId && isFree });
  return isFree ? (ads ?? []) : [];
}

/** Vue, clic ou « Passer » : compté par la base (sans effet pour un membre Premium). */
export function recordAdEvent(adId: string, event: AdEvent, placement: AdPlacement): void {
  void supabase.rpc("record_ad_event", { _ad_id: adId, _event: event, _placement: placement }).then(
    () => undefined,
    () => undefined,
  );
}

/** Connexion lente ou mode économie de données : pas de lecture automatique des vidéos. */
export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  return !!c && (c.saveData === true || c.effectiveType === "slow-2g" || c.effectiveType === "2g");
}

/**
 * Place les publicités dans une liste : une après chaque groupe de N lignes (N réglé par
 * l'administration), et une à la fin si la liste est plus courte.
 */
export function adSlots(length: number, ads: SponsoredAd[]): Map<number, SponsoredAd> {
  const slots = new Map<number, SponsoredAd>();
  if (!ads.length || length === 0) return slots;
  const every = ads[0]?.everyN ?? 6;
  let k = 0;
  for (let i = every - 1; i < length; i += every) slots.set(i, ads[k++ % ads.length]!);
  if (!slots.size) slots.set(length - 1, ads[0]!);
  return slots;
}
