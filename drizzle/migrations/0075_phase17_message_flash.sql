-- Phase 17 — Message Flash.
-- 17.1 — Un Flash est une demande de contact mise en avant : colonne `is_flash`.
-- 17.2 / 17.3 — `send_contact_request(_receiver_id, _message, _flash)` : le Flash est
--        réservé au Premium (vérifié ici) et demande un message (300 caractères au plus,
--        protection téléphone). Toutes les autres règles de la phase 12 s'appliquent.
-- 17.4 — `list_contact_requests` renvoie `is_flash` ; les Flash en attente sont en tête.

ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS is_flash boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.send_contact_request(uuid, text);
CREATE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL, _flash boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_message, '')), '');
  _existing uuid;
  _id uuid;
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _receiver_id IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _receiver_id = _me THEN
    RAISE EXCEPTION 'self_request' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_receiver_id)
     OR public.is_blocked_between(_me, _receiver_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.status = 'active'
      AND m.user_1_id = least(_me, _receiver_id)
      AND m.user_2_id = greatest(_me, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_matched' USING ERRCODE = '22023';
  END IF;
  -- 17.3 : Message Flash réservé au Premium, avec un message obligatoire.
  IF coalesce(_flash, false) THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'flash_premium_required' USING ERRCODE = '42501';
    END IF;
    IF _text IS NULL THEN
      RAISE EXCEPTION 'flash_message_required' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 300 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = '22023';
  END IF;

  -- 12.6 : un seul envoi à la fois par membre (le comptage ci-dessous reste exact même
  -- avec des envois simultanés).
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_request:' || _me::text, 0));

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
  END IF;

  -- Respect d'un refus récent : pas de relance pendant 30 jours.
  IF EXISTS (
    SELECT 1 FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'declined'
      AND r.responded_at > now() - interval '30 days'
  ) THEN
    RAISE EXCEPTION 'recently_declined' USING ERRCODE = 'P0001';
  END IF;

  -- 12.3 / 12.5 : 5 demandes par jour en gratuit, illimité en Premium.
  _premium := public.is_premium(_me);
  IF NOT _premium THEN
    SELECT count(*)::integer INTO _used FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
    IF _used >= 5 THEN
      RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.contact_requests (sender_id, receiver_id, message, is_flash)
  VALUES (_me, _receiver_id, _text, coalesce(_flash, false))
  ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT r.id INTO _id FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
    RETURN jsonb_build_object('id', _id, 'status', 'already_pending');
  END IF;
  RETURN jsonb_build_object('id', _id, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION public.send_contact_request(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid, text, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.list_contact_requests(text);
CREATE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received')
RETURNS TABLE (
  id uuid,
  other_user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  is_flash boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _direction NOT IN ('received', 'sent') THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT r.id, o.user_id, o.first_name, o.birth_date, o.city, o.country, r.message,
         r.status, r.created_at, r.responded_at, r.is_flash
  FROM public.contact_requests r
  JOIN public.profiles o
    ON o.user_id = CASE WHEN _direction = 'received' THEN r.sender_id ELSE r.receiver_id END
  WHERE (CASE WHEN _direction = 'received' THEN r.receiver_id ELSE r.sender_id END) = _me
    AND public.is_discoverable_profile(o.user_id)
    AND NOT public.is_blocked_between(_me, o.user_id)
  -- 17.4 : parmi les demandes en attente, les Messages Flash d'abord.
  ORDER BY (r.status = 'pending') DESC, (r.status = 'pending' AND r.is_flash) DESC, r.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_contact_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contact_requests(text) TO authenticated, service_role;
