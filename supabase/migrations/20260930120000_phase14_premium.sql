-- Phase 14 — Premium : paiement mensuel / annuel, activation, badge, expiration.
--
-- La table `subscriptions` et `is_premium` existent depuis la Phase 2. Cette migration ajoute :
-- 14.6 à 14.9 — `start_premium_payment(_plan, _provider)` : crée (ou réutilise) un paiement
--        « en attente » de type abonnement. Le montant est fixé ici par le serveur :
--        5 USD (500 cents) par mois, 35 USD (3 500 cents) par an. Jamais par le navigateur.
-- 14.10 / 14.11 — `activate_premium_subscription()` : quand un paiement d'abonnement passe
--        à « réussi » (fonction `confirm_payment`, rôle service, déjà existante), l'abonnement
--        est créé actif. S'il reste du temps sur un abonnement en cours, la nouvelle période
--        commence à sa fin (aucun jour perdu). Un paiement ne crée qu'un seul abonnement.
-- 14.12 — `get_premium_badges(_user_ids)` : parmi des membres visibles, lesquels ont le badge
--        Premium (abonnement actif). N'expose rien d'autre (ni formule, ni dates).
-- 14.13 — Expiration : `is_premium` compare déjà les dates (expiration exacte, automatique).
--        `expire_subscriptions()` met aussi le statut « expiré » (historique, admin), toutes
--        les 5 minutes via pg_cron quand il est disponible.
--        `get_my_premium()` renvoie l'état de la personne connectée (formule, date de fin
--        de la période continue) pour l'affichage.
-- Paiement : le prestataire `stripe` est accepté en plus de `test` (voir
-- src/features/payments/stripe.server.ts) pour les abonnements et les déblocages.

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_unique
  ON public.subscriptions (payment_id) WHERE payment_id IS NOT NULL;

-- Montant d'une formule, en cents USD (source de vérité serveur).
CREATE OR REPLACE FUNCTION public.premium_plan_amount(_plan public.subscription_plan)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan WHEN 'premium_monthly' THEN 500 WHEN 'premium_yearly' THEN 3500 END
$$;

CREATE OR REPLACE FUNCTION public.start_premium_payment(_plan public.subscription_plan, _provider text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;

  -- Un paiement en attente récent pour la même formule est réutilisé (double clic).
  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid AND p.type = 'subscription' AND p.status = 'pending'
    AND p.provider = _provider AND p.metadata->>'plan' = _plan::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (_uid, 'subscription', public.premium_plan_amount(_plan), 'USD', _provider, 'pending',
      jsonb_build_object('plan', _plan))
    RETURNING id INTO _payment;
  END IF;
  RETURN _payment;
END;
$$;

REVOKE ALL ON FUNCTION public.start_premium_payment(public.subscription_plan, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_premium_payment(public.subscription_plan, text) TO authenticated, service_role;

-- Activation de l'abonnement après paiement confirmé.
CREATE OR REPLACE FUNCTION public.activate_premium_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.subscription_plan;
  _start timestamptz;
BEGIN
  IF NEW.type <> 'subscription' OR NEW.status <> 'succeeded' OR OLD.status = 'succeeded' THEN
    RETURN NEW;
  END IF;
  BEGIN
    _plan := (NEW.metadata->>'plan')::public.subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF _plan IS NULL OR NEW.amount <> public.premium_plan_amount(_plan) THEN
    RETURN NEW;
  END IF;

  -- Verrou par membre : deux activations simultanées se suivent.
  PERFORM pg_advisory_xact_lock(hashtextextended('premium:' || NEW.user_id::text, 0));

  SELECT greatest(now(), coalesce(max(s.expires_at), now())) INTO _start
  FROM public.subscriptions s
  WHERE s.user_id = NEW.user_id AND s.status = 'active' AND s.expires_at > now();

  INSERT INTO public.subscriptions
    (user_id, plan, amount, currency, status, starts_at, expires_at, payment_id)
  VALUES
    (NEW.user_id, _plan, NEW.amount, NEW.currency, 'active', _start,
     _start + CASE WHEN _plan = 'premium_yearly' THEN interval '1 year' ELSE interval '1 month' END,
     NEW.id)
  ON CONFLICT (payment_id) WHERE payment_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_activate_premium ON public.payments;
CREATE TRIGGER payments_activate_premium
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.activate_premium_subscription();

-- is_premium : une période qui commence plus tard (renouvellement anticipé) ne compte
-- qu'à partir de son début ; inchangé sinon.
CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  )
$$;

-- État Premium de la personne connectée (affichage de la page /premium).
CREATE OR REPLACE FUNCTION public.get_my_premium()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _end timestamptz;
  _plan public.subscription_plan;
  _s record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    SELECT max(s.expires_at) INTO _end FROM public.subscriptions s
    WHERE s.user_id = _uid AND s.status IN ('active', 'expired') AND s.expires_at <= now();
    RETURN jsonb_build_object('premium', false, 'expired_at', _end);
  END IF;
  -- Fin de la période continue (abonnements qui se suivent).
  _end := now();
  FOR _s IN
    SELECT s.starts_at, s.expires_at, s.plan FROM public.subscriptions s
    WHERE s.user_id = _uid AND s.status = 'active' AND s.expires_at > now()
    ORDER BY s.starts_at
  LOOP
    IF _s.starts_at <= _end THEN
      _end := greatest(_end, _s.expires_at);
      _plan := _s.plan;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('premium', true, 'plan', _plan, 'expires_at', _end);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_premium() TO authenticated, service_role;

-- 14.12 : badge Premium des membres visibles (ou de soi-même).
CREATE OR REPLACE FUNCTION public.get_premium_badges(_user_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u
  FROM unnest(_user_ids[1:200]) AS u
  WHERE auth.uid() IS NOT NULL
    AND public.is_premium(u)
    AND (
      u = auth.uid()
      OR (public.can_browse_profiles()
          AND public.is_discoverable_profile(u)
          AND NOT public.is_blocked_between(auth.uid(), u))
    )
$$;

REVOKE ALL ON FUNCTION public.get_premium_badges(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_badges(uuid[]) TO authenticated, service_role;

-- 14.13 : statut « expiré » pour l'historique.
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.subscriptions s SET status = 'expired'
  WHERE s.status = 'active' AND s.expires_at IS NOT NULL AND s.expires_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscriptions() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-expirer-abonnements';
    PERFORM cron.schedule('yona-expirer-abonnements', '*/5 * * * *',
      'select public.expire_subscriptions()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : expiration des abonnements par date seulement.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : expiration par date seulement.', SQLERRM;
END;
$cron$;

-- Déblocage de conversation : le prestataire `stripe` est aussi accepté.
CREATE OR REPLACE FUNCTION public.start_conversation_unlock_payment(_conversation_id uuid, _provider text)
RETURNS uuid
LANGUAGE plpgsql
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
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
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
