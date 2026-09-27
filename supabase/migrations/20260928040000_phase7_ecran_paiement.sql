-- Phase 7 / Étape 7.5 — Créer l'écran de paiement.
-- Démarrage d'un paiement de déblocage : `start_conversation_unlock_payment` crée un
-- paiement « en attente » pour la personne connectée. Montant (100 cents = 1 USD),
-- devise, type et statut sont fixés par le serveur, jamais par l'appelant. Le
-- prestataire doit faire partie de la liste autorisée (pour l'instant « test », utilisé
-- uniquement quand le serveur de l'application l'active explicitement). Un paiement en
-- attente de moins d'une heure pour la même conversation est réutilisé (pas de doublon).
-- Aucun paiement n'est confirmé ici : la confirmation (étape 7.6) est réservée au
-- serveur.
-- Protection des paiements : droits d'écriture directe retirés aux membres sur
-- `payments` et `conversation_unlocks` (lecture de leurs propres lignes seulement).

REVOKE INSERT, UPDATE, DELETE ON public.payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.conversation_unlocks FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.start_conversation_unlock_payment(
  _conversation_id uuid,
  _provider text
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv public.conversations%ROWTYPE;
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _conv FROM public.conversations c WHERE c.id = _conversation_id FOR UPDATE;
  IF NOT FOUND OR _uid NOT IN (_conv.user_1_id, _conv.user_2_id)
     OR _conv.status <> 'open'
     OR NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = _conv.match_id AND m.status = 'active')
  THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  IF public.has_active_conversation_unlock(_conv.id) THEN
    RAISE EXCEPTION 'unlock_already_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid
    AND p.type = 'conversation_unlock'
    AND p.status = 'pending'
    AND p.provider = _provider
    AND p.metadata->>'conversation_id' = _conv.id::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (
      _uid, 'conversation_unlock', 100, 'USD', _provider, 'pending',
      jsonb_build_object('conversation_id', _conv.id, 'duration_days', 3)
    )
    RETURNING id INTO _payment;
  END IF;

  RETURN _payment;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_conversation_unlock_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_conversation_unlock_payment(uuid, text) TO authenticated, service_role;
