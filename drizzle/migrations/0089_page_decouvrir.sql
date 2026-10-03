-- ============================================================
-- Page Découvrir (nouvelle carte) : revenir au dernier profil passé (Premium)
--
-- undo_last_pass() : retire le dernier « Passer » de la personne connectée (dans les
-- 24 dernières heures) ; le profil réapparaît dans la découverte. Réservé aux membres
-- Premium (abonnement actif), vérifié ici, côté serveur. Renvoie le profil rendu.
-- Rejouable.
-- ============================================================
CREATE OR REPLACE FUNCTION public.undo_last_pass()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _target uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(_me) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.likes l
  WHERE l.id = (
    SELECT p.id FROM public.likes p
    WHERE p.sender_id = _me AND p.kind = 'pass' AND p.status = 'active'
      AND p.created_at > now() - interval '24 hours'
    ORDER BY p.created_at DESC
    LIMIT 1
  )
  RETURNING l.receiver_id INTO _target;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'nothing_to_undo' USING ERRCODE = 'P0002';
  END IF;
  RETURN _target;
END;
$$;
REVOKE ALL ON FUNCTION public.undo_last_pass() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_last_pass() TO authenticated, service_role;
