-- Phase 10 / Étape 10.1 — Enregistrer la dernière activité.
-- La dernière activité n'est enregistrée que par le serveur, via `touch_activity()` :
-- - membre connecté (sinon refus `not_authenticated`) ;
-- - compte actif seulement (un compte suspendu ou banni n'est pas marqué actif) ;
-- - date fixée par le serveur ; la ligne d'activité est recréée si elle manque.
-- La fonction renvoie `true` si l'activité a été enregistrée, `false` sinon.
-- Toute écriture directe dans `user_activity` est retirée aux membres (aucune règle
-- d'accès ne l'autorisait déjà ; les droits eux-mêmes sont désormais retirés).

REVOKE INSERT, UPDATE, DELETE ON public.user_activity FROM authenticated, anon;

DROP FUNCTION IF EXISTS public.touch_activity();
CREATE FUNCTION public.touch_activity()
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_account(_user) THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_activity AS a (user_id, last_seen_at, is_online)
  VALUES (_user, now(), true)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now(), is_online = true;

  UPDATE public.users SET last_active_at = now() WHERE id = _user;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_activity() TO authenticated, service_role;
