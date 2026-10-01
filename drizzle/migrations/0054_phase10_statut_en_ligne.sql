-- Phase 10 / Étape 10.3 — Déterminer le statut en ligne.
-- Règle (calculée par le serveur, `get_presence`) :
-- - « online »    : connecté (pas de déconnexion depuis) et actif il y a moins de
--                   3 minutes (l'application signale l'activité chaque minute) ;
-- - « recent »    : actif dans les dernières 24 heures ;
-- - « this_week » : actif dans les 7 derniers jours ;
-- - « inactive »  : au-delà ;
-- - « unknown »   : aucune activité connue, ou statut non consultable.
-- Jamais d'horodatage exact. Le statut d'un autre membre n'est consultable que si son
-- profil est visible et actif, sans blocage, et si la personne connectée peut consulter
-- les profils ; sinon « unknown ». Membre non connecté : refus `not_authenticated`.
-- `mark_offline()` : à la déconnexion, le membre n'apparaît plus « en ligne ».

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
  IF _user_id <> _me AND (
    NOT public.can_browse_profiles()
    OR NOT public.is_discoverable_profile(_user_id)
    OR public.is_blocked_between(_me, _user_id)
  ) THEN
    RETURN 'unknown';
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

CREATE OR REPLACE FUNCTION public.mark_offline()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_activity SET is_online = false WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.mark_offline() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_offline() TO authenticated, service_role;
