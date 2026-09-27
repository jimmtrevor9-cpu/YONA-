-- Phase 5 / Étape 5.6 — Afficher les messages restants.
-- Lecture, par la personne connectée, de son propre quota dans une conversation :
-- messages gratuits utilisés, limite (3) et restants. Réservé aux participants ; la
-- valeur vient du compteur tenu par le serveur (0 si le compteur n'existe pas encore).

CREATE OR REPLACE FUNCTION public.get_message_quota(_conversation_id uuid)
RETURNS TABLE (used integer, quota_limit integer, remaining integer)
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

  RETURN QUERY SELECT _used, 3, greatest(3 - _used, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_message_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(uuid) TO authenticated, service_role;
