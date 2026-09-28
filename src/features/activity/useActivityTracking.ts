import { useEffect } from "react";

import { touchActivity } from "./presence";

/**
 * Enregistre la dernière activité de la personne connectée à l'ouverture de l'espace
 * connecté. Un échec n'empêche jamais l'utilisation de l'application.
 */
export function useActivityTracking(userId: string | null) {
  useEffect(() => {
    if (!userId) return;
    touchActivity().catch(() => {});
  }, [userId]);
}
