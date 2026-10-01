-- Phase 7 / Étape 7.7 — Activer le déblocage.
-- Dès qu'un paiement de déblocage passe au statut « réussi » (confirmation serveur,
-- étape 7.6), le serveur crée le déblocage correspondant :
--   - conversation indiquée par le paiement, payé par l'auteur du paiement, montant et
--     devise du paiement ;
--   - statut « actif », durée fixée par le serveur : 3 jours à partir de la confirmation ;
--   - si un déblocage est déjà en cours sur la conversation (les deux participants ont
--     payé presque en même temps), le nouveau commence à la fin du précédent : aucun jour
--     payé n'est perdu ;
--   - un seul déblocage par paiement (règle d'unicité), même si la confirmation est
--     répétée.
-- Seul le serveur peut provoquer cette activation : les membres n'ont aucun droit
-- d'écriture sur les paiements ni sur les déblocages (étape 7.5).

CREATE UNIQUE INDEX IF NOT EXISTS conversation_unlocks_payment_unique
  ON public.conversation_unlocks (payment_id) WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activate_conversation_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conversation uuid;
  _start timestamptz;
BEGIN
  IF NEW.type <> 'conversation_unlock' OR NEW.status <> 'succeeded'
     OR OLD.status = 'succeeded' THEN
    RETURN NEW;
  END IF;

  _conversation := nullif(NEW.metadata->>'conversation_id', '')::uuid;
  IF _conversation IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = _conversation) THEN
    RETURN NEW;
  END IF;

  -- Verrou sur la conversation : deux activations simultanées se suivent.
  PERFORM 1 FROM public.conversations c WHERE c.id = _conversation FOR UPDATE;

  SELECT greatest(now(), coalesce(max(u.expires_at), now())) INTO _start
  FROM public.conversation_unlocks u
  WHERE u.conversation_id = _conversation AND u.status = 'active' AND u.expires_at > now();

  INSERT INTO public.conversation_unlocks
    (conversation_id, paid_by_user_id, amount, currency, starts_at, expires_at, status, payment_id)
  VALUES
    (_conversation, NEW.user_id, NEW.amount, NEW.currency, _start, _start + interval '3 days',
     'active', NEW.id)
  ON CONFLICT (payment_id) WHERE payment_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_conversation_unlock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS payments_activate_conversation_unlock ON public.payments;
CREATE TRIGGER payments_activate_conversation_unlock
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.activate_conversation_unlock();
