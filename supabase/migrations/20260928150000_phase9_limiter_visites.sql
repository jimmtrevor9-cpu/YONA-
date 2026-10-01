-- Phase 9 / Étape 9.2 — Limiter les visites répétées.
-- Règles (côté serveur, dans `record_profile_visit`) :
-- 1. une seule visite enregistrée par heure pour un même couple visiteur → visité,
--    y compris quand plusieurs appels arrivent en même temps (verrou transactionnel
--    par couple : plus de doublon possible par appels simultanés) ;
-- 2. au plus 100 visites enregistrées par visiteur sur 24 heures glissantes, pour
--    empêcher un compte d'inonder tous les membres de « visites » (au-delà, les visites
--    sont ignorées sans erreur).
-- Index dédié pour ces vérifications.

CREATE INDEX IF NOT EXISTS profile_visits_pair_recent_idx
  ON public.profile_visits (visitor_id, visited_user_id, visited_at DESC);

CREATE OR REPLACE FUNCTION public.record_profile_visit(_visited_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _visitor uuid := auth.uid();
BEGIN
  IF _visitor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _visited_user_id IS NULL OR _visited_user_id = _visitor THEN
    RETURN false;
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_visited_user_id)
     OR public.is_blocked_between(_visitor, _visited_user_id) THEN
    RETURN false;
  END IF;

  -- Appels simultanés pour le même couple : traités l'un après l'autre.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('profile_visit:' || _visitor::text || ':' || _visited_user_id::text, 0)
  );

  -- 1. Une visite par heure et par profil visité.
  IF EXISTS (
    SELECT 1 FROM public.profile_visits v
    WHERE v.visitor_id = _visitor
      AND v.visited_user_id = _visited_user_id
      AND v.visited_at > now() - interval '1 hour'
  ) THEN
    RETURN false;
  END IF;

  -- 2. Au plus 100 visites enregistrées par visiteur sur 24 heures.
  IF (
    SELECT count(*) FROM public.profile_visits v
    WHERE v.visitor_id = _visitor AND v.visited_at > now() - interval '24 hours'
  ) >= 100 THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_visits (visitor_id, visited_user_id)
  VALUES (_visitor, _visited_user_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_profile_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_profile_visit(uuid) TO authenticated, service_role;
