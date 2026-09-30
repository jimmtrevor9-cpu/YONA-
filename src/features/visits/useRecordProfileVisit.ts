import { useEffect, useRef } from "react";

import { recordProfileVisit } from "@/features/monetization/quotas";

/**
 * Enregistre une visite quand le profil complet d'un membre est affiché (une fois par
 * affichage). Le serveur décide seul si la visite compte ; un échec n'empêche jamais
 * l'affichage du profil.
 */
export function useRecordProfileVisit(visitedUserId: string | undefined) {
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    if (!visitedUserId || recorded.current === visitedUserId) return;
    recorded.current = visitedUserId;
    recordProfileVisit(visitedUserId).catch(() => {});
  }, [visitedUserId]);
}
