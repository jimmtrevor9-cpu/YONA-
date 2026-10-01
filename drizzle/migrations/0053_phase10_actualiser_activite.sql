-- Phase 10 / Étape 10.2 — Actualiser l'activité.
-- L'application actualise l'activité régulièrement tant que la page est ouverte et
-- visible. Pour limiter les écritures, `touch_activity()` n'écrit pas si l'activité a été
-- enregistrée il y a moins de 30 secondes (elle est déjà à jour) : elle renvoie alors
-- `true` sans rien modifier.

CREATE OR REPLACE FUNCTION public.touch_activity()
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

  -- Déjà à jour : aucune écriture.
  IF EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = _user AND a.is_online AND a.last_seen_at > now() - interval '30 seconds'
  ) THEN
    RETURN true;
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
