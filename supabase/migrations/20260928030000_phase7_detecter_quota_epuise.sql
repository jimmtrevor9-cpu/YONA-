-- Phase 7 / Étape 7.1 — Détecter le quota épuisé.
-- `get_message_quota` indique désormais explicitement si la personne connectée a épuisé
-- ses messages gratuits dans la conversation (`exhausted`) : c'est ce signal, calculé par
-- le serveur, qui déclenche l'offre de déblocage (étapes suivantes). Il n'y a pas encore
-- de déblocage actif possible (étape 7.7) : épuisé = 3 messages utilisés.

DROP FUNCTION IF EXISTS public.get_message_quota(uuid);

CREATE FUNCTION public.get_message_quota(_conversation_id uuid)
RETURNS TABLE (used integer, quota_limit integer, remaining integer, exhausted boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND _uid IN (c.user_1_id, c.user_2_id)
  ) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT u.free_messages_used INTO _used
  FROM public.conversation_user_usage u
  WHERE u.conversation_id = _conversation_id AND u.user_id = _uid;
  _used := coalesce(_used, 0);

  RETURN QUERY SELECT _used, 3, greatest(3 - _used, 0), _used >= 3;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_message_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(uuid) TO authenticated, service_role;
