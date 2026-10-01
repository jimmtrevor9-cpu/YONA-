-- Phase 12 / Étape 12.1 — Créer une demande de contact.
-- Une demande de contact est envoyée par un membre à un autre membre avec qui il n'a pas
-- encore de Match, avec un court message facultatif. Le destinataire pourra l'accepter
-- ou la refuser (étape 12.2).
-- - Table `contact_requests` : lisible uniquement par l'expéditeur et le destinataire ;
--   aucune écriture directe (tout passe par les fonctions serveur) ; date fixée par le
--   serveur ; une seule demande en attente par couple expéditeur → destinataire.
-- - `send_contact_request(_receiver_id, _message)` : membre connecté pouvant consulter
--   les profils, destinataire visible et actif, jamais soi-même, aucun blocage, pas de
--   Match actif entre eux ; message facultatif de 300 caractères au plus, sans numéro de
--   téléphone. Renvoie `{ "id", "status": "sent" | "already_pending" }`.
--   Refus : `not_authenticated`, `profile_unavailable`, `self_request`, `already_matched`,
--   `message_too_long`, `phone_number_detected`.

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT contact_requests_no_self CHECK (sender_id <> receiver_id),
  CONSTRAINT contact_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  CONSTRAINT contact_requests_message_length
    CHECK (message IS NULL OR char_length(message) BETWEEN 1 AND 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_one_pending
  ON public.contact_requests (sender_id, receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS contact_requests_receiver_idx
  ON public.contact_requests (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_requests_sender_idx
  ON public.contact_requests (sender_id, created_at DESC);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;

DROP POLICY IF EXISTS contact_requests_select_parties ON public.contact_requests;
CREATE POLICY contact_requests_select_parties ON public.contact_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

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

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
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
