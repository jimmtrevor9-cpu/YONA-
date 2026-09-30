-- Phase 7 / Étape 7.6 — Enregistrer le paiement confirmé.
-- `confirm_payment` enregistre la confirmation d'un paiement par le prestataire. Elle
-- n'est appelable que par le serveur (rôle service) : jamais par un membre ni un
-- visiteur. Contrôles avant d'enregistrer :
--   - le paiement existe et vient bien de ce prestataire ;
--   - montant et devise confirmés identiques à ceux enregistrés (1 USD) — sinon le
--     paiement est marqué « échoué » (motif `amount_mismatch`) et la fonction renvoie
--     `failed` ;
--   - une référence de transaction du prestataire est fournie ; elle ne peut servir qu'à
--     un seul paiement (index unique existant) ;
--   - déjà confirmé avec la même référence : aucun changement (confirmation répétée par
--     le prestataire) ; avec une autre référence : refus.
-- Le paiement passe au statut « réussi » avec la référence et la date de confirmation.
-- (L'activation du déblocage qui en découle est l'étape 7.7.)

CREATE OR REPLACE FUNCTION public.confirm_payment(
  _payment_id uuid,
  _provider text,
  _provider_transaction_id text,
  _amount integer,
  _currency text
)
RETURNS public.payment_status
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _p public.payments%ROWTYPE;
BEGIN
  IF _provider_transaction_id IS NULL OR length(trim(_provider_transaction_id)) = 0 THEN
    RAISE EXCEPTION 'payment_reference_missing' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _p FROM public.payments p WHERE p.id = _payment_id FOR UPDATE;
  IF NOT FOUND OR _p.provider <> _provider THEN
    RAISE EXCEPTION 'payment_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _p.status = 'succeeded' THEN
    IF _p.provider_transaction_id = _provider_transaction_id THEN
      RETURN _p.status;
    END IF;
    RAISE EXCEPTION 'payment_already_confirmed' USING ERRCODE = 'P0001';
  END IF;
  IF _p.status <> 'pending' THEN
    RAISE EXCEPTION 'payment_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF _amount IS DISTINCT FROM _p.amount OR upper(_currency) IS DISTINCT FROM upper(_p.currency) THEN
    UPDATE public.payments p
       SET status = 'failed',
           metadata = p.metadata || jsonb_build_object(
             'failure', 'amount_mismatch',
             'confirmed_amount', _amount,
             'confirmed_currency', _currency)
     WHERE p.id = _p.id;
    -- Pas d'exception ici : elle annulerait l'enregistrement de l'échec.
    RETURN 'failed';
  END IF;

  UPDATE public.payments p
     SET status = 'succeeded',
         provider_transaction_id = _provider_transaction_id,
         metadata = p.metadata || jsonb_build_object('confirmed_at', now())
   WHERE p.id = _p.id;

  RETURN 'succeeded';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid, text, text, integer, text) TO service_role;
