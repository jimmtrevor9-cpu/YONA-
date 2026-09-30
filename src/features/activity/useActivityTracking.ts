import { useEffect } from "react";

import { touchActivity } from "./presence";

/** Actualisation de l'activité tant que la page est ouverte et visible. */
export const ACTIVITY_REFRESH_MS = 60 * 1000;
/** Délai minimal entre deux signaux envoyés par cet onglet (retour sur la page…). */
const MIN_TOUCH_INTERVAL_MS = 30 * 1000;

/**
 * Enregistre la dernière activité de la personne connectée à l'ouverture de l'espace
 * connecté, puis l'actualise chaque minute tant que la page est visible, et dès que la
 * personne revient sur la page. Rien n'est envoyé quand la page est cachée (autre onglet,
 * application en arrière-plan). Un échec n'empêche jamais l'utilisation de l'application.
 */
export function useActivityTracking(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    let lastTouch = 0;
    const touch = (force = false) => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (!force && now - lastTouch < MIN_TOUCH_INTERVAL_MS) return;
      lastTouch = now;
      touchActivity().catch(() => {});
    };
    const onVisible = () => touch();

    touch(true);
    const timer = window.setInterval(() => touch(true), ACTIVITY_REFRESH_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId]);
}
