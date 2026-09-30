-- Phase 7 / Étape 7.11 — Afficher l'expiration.
-- `get_message_quota` renvoie en plus `last_unlock_expired_at` : date de fin du dernier
-- déblocage terminé de la conversation (quand aucun n'est en cours), pour annoncer
-- « Le déblocage a expiré le … ». La date de fin du déblocage en cours
-- (`unlock_expires_at`, étape 7.8) sert à afficher « jusqu'au … » et le temps restant.

DROP FUNCTION IF EXISTS public.get_message_quota(uuid);

CREATE FUNCTION public.get_message_quota(_conversation_id uuid)
 RETURNS TABLE(used integer, quota_limit integer, remaining integer, exhausted boolean, unlocked boolean, unlocked_by uuid, unlock_expires_at timestamp with time zone, last_unlock_expired_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
  _unlocked boolean := false;
  _by uuid;
  _end timestamptz;
  _u record;
  _last_end timestamptz;
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

  IF public.has_active_conversation_unlock(_conversation_id) THEN
    _unlocked := true;
    SELECT u.paid_by_user_id INTO _by
    FROM public.conversation_unlocks u
    WHERE u.conversation_id = _conversation_id AND u.status = 'active'
      AND u.starts_at <= now() AND u.expires_at > now()
    ORDER BY u.starts_at DESC
    LIMIT 1;
    -- Fin de la période continue (déblocages qui se suivent).
    _end := now();
    FOR _u IN
      SELECT u.starts_at, u.expires_at FROM public.conversation_unlocks u
      WHERE u.conversation_id = _conversation_id AND u.status = 'active'
        AND u.expires_at > now()
      ORDER BY u.starts_at
    LOOP
      IF _u.starts_at <= _end THEN
        _end := greatest(_end, _u.expires_at);
      END IF;
    END LOOP;
  END IF;

  -- Étape 7.11 : date de fin du dernier déblocage terminé (affichée après expiration).
  IF NOT _unlocked THEN
    SELECT max(u.expires_at) INTO _last_end
    FROM public.conversation_unlocks u
    WHERE u.conversation_id = _conversation_id
      AND u.status IN ('active', 'expired')
      AND u.expires_at <= now();
  END IF;

  RETURN QUERY SELECT _used, 3, greatest(3 - _used, 0), _used >= 3, _unlocked, _by,
    CASE WHEN _unlocked THEN _end END, _last_end;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_message_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(uuid) TO authenticated, service_role;
