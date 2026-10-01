-- ============================================================
-- Phase 2 — Étape 2.2 — Enregistrer le Like
--
-- Constat (voir docs/verification/phase-2/etape-2.2-enregistrer-like.md) :
-- la fonction serveur likeProfile vérifie le profil visé, mais la base acceptait
-- en écriture directe (API) :
--   1. un Like vers un profil masqué, suspendu, non finalisé ou d'un compte suspendu ;
--   2. un Like envoyé par un membre qui n'a pas le droit de parcourir les profils
--      (profil non finalisé, suspendu, compte suspendu — étape 1.15) ;
--   3. une date de Like choisie par le membre (created_at antidaté ou futur).
-- Rejouable.
-- ============================================================

DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id <> receiver_id
    AND NOT public.is_blocked_between(sender_id, receiver_id)
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(receiver_id)
  );

-- Retirer un Like (statut « withdrawn ») reste possible même si le profil n'est plus visible.
DROP POLICY IF EXISTS "likes_update_own" ON public.likes;
CREATE POLICY "likes_update_own" ON public.likes FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT public.is_blocked_between(sender_id, receiver_id)
    AND (
      status = 'withdrawn'
      OR (public.can_browse_profiles() AND public.is_discoverable_profile(receiver_id))
    )
  );

-- Date du Like fixée par le serveur pour les requêtes des membres.
CREATE OR REPLACE FUNCTION public.set_like_created_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.created_at := CASE WHEN TG_OP = 'INSERT' THEN now() ELSE OLD.created_at END;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_like_created_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS likes_set_created_at ON public.likes;
CREATE TRIGGER likes_set_created_at BEFORE INSERT OR UPDATE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.set_like_created_at();
