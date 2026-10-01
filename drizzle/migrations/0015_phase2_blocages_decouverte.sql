-- ============================================================
-- Phase 2 — Étape 2.8 — Respecter les blocages dans la découverte
--
-- Les blocages sont déjà appliqués dans les deux sens par les règles de lecture
-- (profils, profils chrétiens, photos, fichiers : étapes 0.6 / 1.15), donc par la
-- découverte (discover_profiles) et la recherche, et par l'écriture des Likes / Pass
-- (étape 2.2). Vérifié dans docs/verification/phase-2/etape-2.8-blocages-decouverte.md.
--
-- Problème constaté : la règle likes_update_own refusait toute modification d'un
-- Like entre deux membres bloqués — y compris le RETRAIT de son propre Like.
-- Correction : retirer son Like (« withdrawn ») est toujours permis ; le réactiver
-- (ou le changer en Pass) reste interdit en cas de blocage. Rejouable.
-- ============================================================

DROP POLICY IF EXISTS "likes_update_own" ON public.likes;
CREATE POLICY "likes_update_own" ON public.likes FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      status = 'withdrawn'
      OR (
        NOT public.is_blocked_between(sender_id, receiver_id)
        AND public.can_browse_profiles()
        AND public.is_discoverable_profile(receiver_id)
      )
    )
  );
