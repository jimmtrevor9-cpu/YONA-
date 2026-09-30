-- Phase 12 / Étapes 12.2 à 12.6 — Demandes de contact : enregistrement, réponse et quota.
--
-- 12.2 — Enregistrer la demande : la demande créée à l'étape 12.1 a maintenant un cycle
--        de vie complet, entièrement contrôlé par le serveur :
--        - `respond_contact_request(_request_id, _accept)` : seul le destinataire répond ;
--          accepter crée le Match (et donc la conversation, par le déclencheur existant),
--          refuser clôt la demande ;
--        - `cancel_contact_request(_request_id)` : seul l'expéditeur annule sa demande ;
--        - `list_contact_requests(_direction)` : demandes reçues ou envoyées, avec le
--          prénom, l'âge et la ville de l'autre membre (profils encore visibles, sans
--          blocage) ;
--        - après un refus, l'expéditeur ne peut pas relancer la même personne pendant
--          30 jours (`recently_declined`).
-- 12.3 — Limite gratuite : 5 demandes envoyées par jour (jour calendaire UTC). Une
--        demande compte dès son envoi, même annulée ou refusée ensuite ; une demande
--        « déjà en attente » ne compte pas. Refus : `daily_limit_reached`.
-- 12.4 — `get_contact_request_quota()` : demandes utilisées, limite, restantes et heure de
--        remise à zéro, pour l'affichage.
-- 12.5 — Premium : aucune limite (abonnement vérifié par `is_premium`).
-- 12.6 — Protection serveur : le quota est compté dans la fonction serveur, sous un verrou
--        par membre (des envois simultanés ne peuvent pas dépasser la limite) ; aucune
--        écriture directe sur la table n'est possible (étape 12.1).

-- Début du jour UTC courant (base du quota journalier).
CREATE OR REPLACE FUNCTION public.utc_day_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc('day', now(), 'UTC')
$$;

CREATE INDEX IF NOT EXISTS contact_requests_sender_day_idx
  ON public.contact_requests (sender_id, created_at);

-- Quota de demandes de contact de la personne connectée (lecture seule).
CREATE OR REPLACE FUNCTION public.get_contact_request_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  _premium := public.is_premium(_me);
  SELECT count(*)::integer INTO _used FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
  RETURN jsonb_build_object(
    'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 5 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(5 - _used, 0) END,
    'unlimited', _premium,
    'resets_at', public.utc_day_start() + interval '1 day'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_request_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_request_quota() TO authenticated, service_role;

-- Envoi d'une demande (étape 12.1) + quota journalier (12.3, 12.5, 12.6) + délai après refus.
CREATE OR REPLACE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL)
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

  INSERT INTO public.contact_requests (sender_id, receiver_id, message)
  VALUES (_me, _receiver_id, _text)
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

REVOKE ALL ON FUNCTION public.send_contact_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid, text) TO authenticated, service_role;

-- 12.2 : réponse du destinataire. Accepter crée le Match (la conversation suit).
CREATE OR REPLACE FUNCTION public.respond_contact_request(_request_id uuid, _accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _r public.contact_requests%ROWTYPE;
  _a uuid;
  _b uuid;
  _match uuid;
  _conversation uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _accept IS NULL THEN
    RAISE EXCEPTION 'invalid_response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _r FROM public.contact_requests r WHERE r.id = _request_id FOR UPDATE;
  IF NOT FOUND OR _r.receiver_id <> _me THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _r.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF NOT _accept THEN
    UPDATE public.contact_requests SET status = 'declined', responded_at = now()
    WHERE id = _r.id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_r.sender_id)
     OR public.is_blocked_between(_me, _r.sender_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;

  _a := least(_me, _r.sender_id);
  _b := greatest(_me, _r.sender_id);
  -- Même verrou que la création d'un Match par Like réciproque (pas de doublon).
  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  INSERT INTO public.matches (user_1_id, user_2_id)
  VALUES (_a, _b)
  ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
    WHERE public.matches.status = 'unmatched';

  SELECT m.id INTO _match FROM public.matches m
  WHERE m.user_1_id = _a AND m.user_2_id = _b AND m.status = 'active';
  IF _match IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT c.id INTO _conversation FROM public.conversations c WHERE c.match_id = _match;

  -- Les demandes en attente entre les deux membres (dans les deux sens) sont acceptées.
  UPDATE public.contact_requests r SET status = 'accepted', responded_at = now()
  WHERE r.status = 'pending'
    AND ((r.sender_id = _r.sender_id AND r.receiver_id = _me)
      OR (r.sender_id = _me AND r.receiver_id = _r.sender_id));

  RETURN jsonb_build_object('status', 'accepted', 'match_id', _match,
    'conversation_id', _conversation);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_contact_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_contact_request(uuid, boolean) TO authenticated, service_role;

-- 12.2 : annulation par l'expéditeur (la demande reste comptée dans le quota du jour).
CREATE OR REPLACE FUNCTION public.cancel_contact_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _r public.contact_requests%ROWTYPE;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _r FROM public.contact_requests r WHERE r.id = _request_id FOR UPDATE;
  IF NOT FOUND OR _r.sender_id <> _me THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _r.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contact_requests SET status = 'cancelled', responded_at = now()
  WHERE id = _r.id;
  RETURN jsonb_build_object('status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_contact_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_contact_request(uuid) TO authenticated, service_role;

-- 12.2 : demandes reçues (`received`) ou envoyées (`sent`), les plus récentes d'abord.
-- Seules les demandes dont l'autre membre est encore visible et sans blocage sont listées.
CREATE OR REPLACE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received')
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
  responded_at timestamptz
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
         r.status, r.created_at, r.responded_at
  FROM public.contact_requests r
  JOIN public.profiles o
    ON o.user_id = CASE WHEN _direction = 'received' THEN r.sender_id ELSE r.receiver_id END
  WHERE (CASE WHEN _direction = 'received' THEN r.receiver_id ELSE r.sender_id END) = _me
    AND public.is_discoverable_profile(o.user_id)
    AND NOT public.is_blocked_between(_me, o.user_id)
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_contact_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contact_requests(text) TO authenticated, service_role;
