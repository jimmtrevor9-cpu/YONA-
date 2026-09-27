-- Phase 4 / Étape 4.8 — Enregistrer le message.
-- Un message n'est jamais écrit directement par un membre : il passe par `send_message`,
-- qui vérifie tout côté serveur avant l'enregistrement :
--   - personne connectée, participante de la conversation ;
--   - conversation ouverte, Match actif, aucun blocage entre les deux personnes ;
--   - compte de l'expéditeur actif et profil finalisé (non suspendu) ;
--   - profil de l'autre personne toujours visible et compte actif ;
--   - texte nettoyé des espaces de début et de fin, 1 à 4 000 caractères.
-- Auteur, statut « delivered » et date sont fixés par le serveur. La date du dernier
-- message de la conversation est mise à jour dans la même transaction.
-- (Quota des 3 messages gratuits : Phase 5 ; refus des numéros de téléphone : Phase 6.)

CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _content text)
RETURNS TABLE (id uuid, conversation_id uuid, sender_id uuid, content text, status public.message_status, created_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
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
  VALUES (_conv.id, _uid, _text, 'delivered', now())
  RETURNING * INTO _msg;

  UPDATE public.conversations c SET last_message_at = _msg.created_at WHERE c.id = _conv.id;

  RETURN QUERY SELECT _msg.id, _msg.conversation_id, _msg.sender_id, _msg.content, _msg.status, _msg.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_message(uuid, text) TO authenticated, service_role;

-- Aucune écriture directe dans les messages pour les membres (lecture seule via RLS).
REVOKE INSERT, UPDATE, DELETE ON public.messages FROM authenticated, anon;
