-- Phase 10 / Étape 10.5 — Réserver les informations de présence à Premium.
-- « La visibilité des personnes connectées est Premium » : `get_presence` refuse
-- désormais (erreur `premium_required`) de donner le statut d'un AUTRE membre à une
-- personne sans abonnement Premium actif. Chacun peut toujours consulter son propre
-- statut. Aucune information (ni statut, ni « inconnu ») n'est transmise à un membre
-- gratuit. Les règles de l'étape 10.3 sont inchangées pour les membres Premium.

CREATE OR REPLACE FUNCTION public.get_presence(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _seen timestamptz;
  _online boolean;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF _user_id <> _me THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_browse_profiles()
       OR NOT public.is_discoverable_profile(_user_id)
       OR public.is_blocked_between(_me, _user_id) THEN
      RETURN 'unknown';
    END IF;
  END IF;

  SELECT a.last_seen_at, a.is_online INTO _seen, _online
  FROM public.user_activity a WHERE a.user_id = _user_id;

  RETURN CASE
    WHEN _seen IS NULL THEN 'unknown'
    WHEN _online AND _seen > now() - interval '3 minutes' THEN 'online'
    WHEN _seen > now() - interval '24 hours' THEN 'recent'
    WHEN _seen > now() - interval '7 days' THEN 'this_week'
    ELSE 'inactive'
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.get_presence(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_presence(uuid) TO authenticated, service_role;
