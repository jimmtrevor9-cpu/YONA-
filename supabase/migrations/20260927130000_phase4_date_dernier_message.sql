-- Phase 4 / Étape 4.10 — Correction trouvée par la non-régression (étape 4.8).
-- Envois simultanés dans une même conversation : la date d'un message était celle du
-- début de sa transaction (`now()`), pas celle de son écriture. Un envoi commencé plus
-- tôt mais écrit plus tard (après le verrou) pouvait donc ramener la date du dernier
-- message en arrière. Désormais : date prise au moment de l'écriture, après le verrou
-- (`clock_timestamp()`, donc dans l'ordre réel d'écriture), et date du dernier message qui
-- ne recule jamais.

CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _content text)
 RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, content text, status message_status, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _text text;
  _conv public.conversations%ROWTYPE;
  _other uuid;
  _msg public.messages%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  _text := regexp_replace(coalesce(_content, ''), '^\s+|\s+$', '', 'g');
  IF char_length(_text) = 0 THEN
    RAISE EXCEPTION 'message_empty' USING ERRCODE = '22023';
  END IF;
  IF char_length(_text) > 4000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;

  -- Verrou sur la conversation : les envois simultanés sont traités l'un après l'autre.
  SELECT * INTO _conv FROM public.conversations c WHERE c.id = _conversation_id FOR UPDATE;
  IF NOT FOUND OR _uid NOT IN (_conv.user_1_id, _conv.user_2_id) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;
  _other := CASE WHEN _conv.user_1_id = _uid THEN _conv.user_2_id ELSE _conv.user_1_id END;

  IF _conv.status <> 'open'
     OR NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = _conv.match_id AND m.status = 'active')
     OR EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = _uid AND b.blocked_id = _other)
          OR (b.blocker_id = _other AND b.blocked_id = _uid)
     )
     OR NOT public.is_discoverable_profile(_other)
  THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = _uid AND u.status = 'active' AND p.status IN ('active', 'hidden')
      AND p.onboarding_completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'sender_not_allowed' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, status, created_at)
  VALUES (_conv.id, _uid, _text, 'delivered', clock_timestamp())
  RETURNING * INTO _msg;

  UPDATE public.conversations c
     SET last_message_at = greatest(coalesce(c.last_message_at, _msg.created_at), _msg.created_at)
   WHERE c.id = _conv.id;

  RETURN QUERY SELECT _msg.id, _msg.conversation_id, _msg.sender_id, _msg.content, _msg.status, _msg.created_at;
END;
$function$;
