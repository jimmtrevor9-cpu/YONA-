import { useEffect, useRef } from "react";

import { recordAdEvent, type AdPlacement } from "@/features/ads/ads";

/**
 * Compte une vue quand la publicité est visible à moitié pendant au moins une seconde
 * (une fois par affichage ; la base ignore les répétitions rapprochées).
 */
export function useAdView<T extends HTMLElement>(
  adId: string | null,
  placement: AdPlacement,
  enabled = true,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !adId || !enabled || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (done) return;
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
          timer ??= setTimeout(() => {
            done = true;
            recordAdEvent(adId, "view", placement);
            observer.disconnect();
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [adId, placement, enabled]);
  return ref;
}
