-- ============================================================
-- Journal de tout ce qui se passe (administration, tâche D1)
--
-- Tables (lecture réservée aux administrateurs, écriture uniquement par la base ou le
-- serveur) :
--   auth_events      connexions réussies et échouées, déconnexions, inscriptions,
--                    mot de passe oublié / changé, méthode (e-mail, Google)
--   signup_events    parcours d'inscription : compte, étapes 1 à 4, profil terminé,
--                    vérification demandée / réussie / refusée (1re fois seulement)
--   payment_events   paiements : créé, en attente, réussi, échoué (motif), annulé,
--                    remboursé, abandonné ; webhooks Stripe reçus
--   activity_events  actions : likes, passes, Matchs, messages (jamais le contenu),
--                    blocages, signalements, demandes de contact, favoris, visites,
--                    suspensions, bannissements, suppressions de compte
--   server_errors    erreurs importantes du serveur
--   admin_audit_log  actions des administrateurs (qui, quoi, quand, changements)
-- Chaque événement garde, si connus : date et heure, membre, pays et ville (d'après
-- l'adresse IP), appareil / navigateur, adresse IP. Ces informations viennent des
-- en-têtes de la requête (request.headers) ; le serveur du site les transmet pour les
-- actions qu'il fait au nom d'un membre (en-têtes x-yona-*).
-- RGPD : les adresses IP et appareils sont effacés après 12 mois (purge_old_logs), et
-- dès la suppression d'un compte (journal anonymisé).
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Contexte de la requête (IP, pays, ville, navigateur)
-- ------------------------------------------------------------
-- Ville transmise encodée (en-tête HTTP : caractères ASCII seulement).
CREATE OR REPLACE FUNCTION public.url_decode(_s text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  _bytes bytea := ''::bytea;
  _i integer := 1;
  _c text;
BEGIN
  IF _s IS NULL THEN
    RETURN NULL;
  END IF;
  WHILE _i <= length(_s) LOOP
    _c := substr(_s, _i, 1);
    IF _c = '%' AND substr(_s, _i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' THEN
      _bytes := _bytes || decode(substr(_s, _i + 1, 2), 'hex');
      _i := _i + 3;
    ELSE
      _bytes := _bytes || convert_to(CASE WHEN _c = '+' THEN ' ' ELSE _c END, 'UTF8');
      _i := _i + 1;
    END IF;
  END LOOP;
  RETURN convert_from(_bytes, 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.request_context()
RETURNS jsonb
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'ip', nullif(btrim(split_part(coalesce(
      h ->> 'x-yona-ip', h ->> 'cf-connecting-ip', h ->> 'x-real-ip', h ->> 'x-forwarded-for', ''
    ), ',', 1)), ''),
    'country', upper(nullif(btrim(coalesce(h ->> 'x-yona-country', h ->> 'cf-ipcountry', '')), '')),
    'city', left(nullif(btrim(coalesce(public.url_decode(h ->> 'x-yona-city'), '')), ''), 100),
    'user_agent', left(nullif(coalesce(h ->> 'x-yona-ua', h ->> 'user-agent', ''), ''), 400)
  )
  FROM (SELECT coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb AS h) x
$$;
REVOKE ALL ON FUNCTION public.request_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_context() TO service_role;

-- ------------------------------------------------------------
-- 2. Tables du journal
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  email text,
  event text NOT NULL,
  method text,
  ip text,
  country text,
  city text,
  user_agent text,
  timezone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_events_event_check CHECK (event IN (
    'signup', 'login', 'login_failed', 'logout', 'password_reset_requested', 'password_changed'
  )),
  CONSTRAINT auth_events_method_check CHECK (method IS NULL OR method IN ('email', 'google', 'other')),
  CONSTRAINT auth_events_email_length CHECK (email IS NULL OR char_length(email) <= 320),
  CONSTRAINT auth_events_timezone_length CHECK (timezone IS NULL OR char_length(timezone) <= 64)
);
CREATE INDEX IF NOT EXISTS auth_events_created_idx ON public.auth_events (created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_user_idx ON public.auth_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_ip_failed_idx ON public.auth_events (ip, created_at)
  WHERE event = 'login_failed';

CREATE TABLE IF NOT EXISTS public.signup_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  step text NOT NULL,
  method text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT signup_events_step_check CHECK (step IN (
    'account_created', 'step_1', 'step_2', 'step_3', 'step_4', 'profile_completed',
    'verification_requested', 'verification_approved', 'verification_rejected'
  )),
  CONSTRAINT signup_events_once UNIQUE (user_id, step)
);
CREATE INDEX IF NOT EXISTS signup_events_created_idx ON public.signup_events (created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payment_id uuid,
  user_id uuid,
  event text NOT NULL,
  product text,
  amount integer,
  currency text,
  provider text,
  provider_ref text,
  reason text,
  ip text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_event_check CHECK (event IN (
    'created', 'pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'abandoned', 'webhook'
  )),
  CONSTRAINT payment_events_reason_length CHECK (reason IS NULL OR char_length(reason) <= 300)
);
CREATE INDEX IF NOT EXISTS payment_events_created_idx ON public.payment_events (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_payment_idx ON public.payment_events (payment_id);
CREATE INDEX IF NOT EXISTS payment_events_user_idx ON public.payment_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  event text NOT NULL,
  target_user_id uuid,
  ref_id uuid,
  ip text,
  country text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_events_event_check CHECK (event IN (
    'like', 'pass', 'match', 'message', 'voice_message', 'block', 'report', 'contact_request',
    'flash_message', 'favorite', 'visit', 'account_suspended', 'account_banned',
    'account_reactivated', 'account_deleted'
  ))
);
CREATE INDEX IF NOT EXISTS activity_events_created_idx ON public.activity_events (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_event_idx ON public.activity_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_user_idx ON public.activity_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.server_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  message text NOT NULL,
  user_id uuid,
  path text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_errors_source_length CHECK (char_length(source) <= 100),
  CONSTRAINT server_errors_message_length CHECK (char_length(message) <= 2000),
  CONSTRAINT server_errors_path_length CHECK (path IS NULL OR char_length(path) <= 300)
);
CREATE INDEX IF NOT EXISTS server_errors_created_idx ON public.server_errors (created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id uuid,
  action text NOT NULL,
  target_table text,
  target_id text,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_log_action_length CHECK (char_length(action) <= 100)
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

-- Droits : lecture par les administrateurs seulement (règles ci-dessous), écriture par la
-- base (déclencheurs, fonctions) et le serveur (clé service).
DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['auth_events', 'signup_events', 'payment_events', 'activity_events',
                            'server_errors', 'admin_audit_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', _t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', _t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', _t);
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', _t || '_id_seq');
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO service_role', _t || '_id_seq');
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _t || '_select_admin', _t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_admin())',
                   _t || '_select_admin', _t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. Comptes : inscription, connexion, mot de passe (déclencheur sur auth.users)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_method(_provider text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE lower(coalesce(_provider, '')) WHEN 'email' THEN 'email' WHEN 'google' THEN 'google'
              ELSE 'other' END
$$;

CREATE OR REPLACE FUNCTION public.log_auth_user_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _provider text := NEW.raw_app_meta_data ->> 'provider';
  _ctx jsonb := public.request_context();
BEGIN
  -- Les profils de démonstration ne sont pas des connexions.
  IF _provider = 'virtual' THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.auth_events (user_id, email, event, method, ip, country, user_agent)
      VALUES (NEW.id, NEW.email, 'signup', public.auth_method(_provider),
              _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
      INSERT INTO public.signup_events (user_id, step, method)
      VALUES (NEW.id, 'account_created', public.auth_method(_provider))
      ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
    ELSE
      IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
        INSERT INTO public.auth_events (user_id, email, event, method, ip, country, user_agent)
        VALUES (NEW.id, NEW.email, 'login', public.auth_method(_provider),
                _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
      END IF;
      IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password AND OLD.encrypted_password IS NOT NULL
         AND OLD.encrypted_password <> '' THEN
        INSERT INTO public.auth_events (user_id, email, event, method)
        VALUES (NEW.id, NEW.email, 'password_changed', 'email');
      END IF;
      IF NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at AND NEW.recovery_sent_at IS NOT NULL THEN
        INSERT INTO public.auth_events (user_id, email, event, method)
        VALUES (NEW.id, NEW.email, 'password_reset_requested', 'email');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Le journal ne doit jamais empêcher une inscription ou une connexion.
    RAISE WARNING 'log_auth_user_change: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_auth_user_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_logged ON auth.users;
CREATE TRIGGER on_auth_user_logged AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.log_auth_user_change();

-- Contexte d'une connexion (appareil, IP, pays, ville, fuseau) : envoyé par le site juste
-- après la connexion, rattaché aux connexions / inscriptions sans contexte des 15 dernières
-- minutes (avec Google, l'inscription et la première connexion arrivent ensemble).
CREATE OR REPLACE FUNCTION public.record_session_context(_timezone text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _ctx jsonb := public.request_context();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.auth_events e
  SET ip = _ctx ->> 'ip', country = _ctx ->> 'country', city = _ctx ->> 'city',
      user_agent = _ctx ->> 'user_agent', timezone = left(nullif(btrim(_timezone), ''), 64)
  WHERE e.user_id = _me AND e.event IN ('login', 'signup')
    AND e.created_at > now() - interval '15 minutes' AND e.user_agent IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.record_session_context(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_session_context(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_logout()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _ctx jsonb := public.request_context();
BEGIN
  IF _me IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.auth_events (user_id, email, event, ip, country, city, user_agent)
  SELECT _me, u.email, 'logout', _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'city', _ctx ->> 'user_agent'
  FROM public.users u WHERE u.id = _me;
END; $$;
REVOKE ALL ON FUNCTION public.record_logout() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_logout() TO authenticated, service_role;

-- Connexion échouée (adresse saisie, jamais le mot de passe) : enregistrée par le serveur
-- du site, 20 au plus par adresse IP et par 10 minutes (anti-abus du journal).
CREATE OR REPLACE FUNCTION public.record_login_failure(_email text, _method text DEFAULT 'email')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.request_context();
  _clean text := lower(left(btrim(coalesce(_email, '')), 320));
BEGIN
  IF (SELECT count(*) FROM public.auth_events e
      WHERE e.event = 'login_failed' AND e.ip IS NOT DISTINCT FROM (_ctx ->> 'ip')
        AND e.created_at > now() - interval '10 minutes') >= 20 THEN
    RETURN;
  END IF;
  INSERT INTO public.auth_events (user_id, email, event, method, ip, country, city, user_agent)
  VALUES ((SELECT u.id FROM public.users u WHERE lower(u.email) = _clean LIMIT 1),
          nullif(_clean, ''), 'login_failed',
          CASE WHEN _method IN ('email', 'google') THEN _method ELSE 'other' END,
          _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'city', _ctx ->> 'user_agent');
END; $$;
REVOKE ALL ON FUNCTION public.record_login_failure(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_login_failure(text, text) TO service_role;

-- ------------------------------------------------------------
-- 4. Parcours d'inscription
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_signup_step(_step integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _step IS NULL OR _step NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_step' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.signup_events (user_id, step, country)
  VALUES (_me, 'step_' || _step, public.request_context() ->> 'country')
  ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
END; $$;
REVOKE ALL ON FUNCTION public.record_signup_step(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_signup_step(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.log_signup_milestone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user uuid;
  _step text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.is_virtual OR NEW.onboarding_completed_at IS NULL OR OLD.onboarding_completed_at IS NOT NULL THEN
      RETURN NULL;
    END IF;
    _user := NEW.user_id;
    _step := 'profile_completed';
  ELSIF TG_OP = 'INSERT' THEN
    _user := NEW.user_id;
    _step := 'verification_requested';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    _user := NEW.user_id;
    _step := 'verification_' || NEW.status;
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.signup_events (user_id, step) VALUES (_user, _step)
  ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_signup_milestone: %', SQLERRM;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_signup_milestone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_log_signup ON public.profiles;
CREATE TRIGGER profiles_log_signup AFTER UPDATE OF onboarding_completed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_signup_milestone();
DROP TRIGGER IF EXISTS profile_verifications_log_signup ON public.profile_verifications;
CREATE TRIGGER profile_verifications_log_signup AFTER INSERT OR UPDATE OF status ON public.profile_verifications
  FOR EACH ROW EXECUTE FUNCTION public.log_signup_milestone();

-- ------------------------------------------------------------
-- 5. Paiements
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_product(_type public.payment_type, _metadata jsonb)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _type WHEN 'conversation_unlock' THEN 'conversation_unlock'
                    ELSE coalesce(_metadata ->> 'plan', 'premium') END
$$;

CREATE OR REPLACE FUNCTION public.log_payment_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.payment_events (payment_id, user_id, event, product, amount, currency, provider,
                                     provider_ref, reason, ip, country, user_agent)
  VALUES (NEW.id, NEW.user_id,
          CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE NEW.status::text END,
          public.payment_product(NEW.type, NEW.metadata), NEW.amount, NEW.currency, NEW.provider,
          NEW.provider_transaction_id, left(NEW.metadata ->> 'failure_reason', 300),
          _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_payment_change: %', SQLERRM;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_payment_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS payments_log ON public.payments;
CREATE TRIGGER payments_log AFTER INSERT OR UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_change();

-- Webhook reçu (Stripe) : toujours tracé ; un paiement en attente expiré ou refusé passe
-- à « annulé » / « échoué » avec son motif.
CREATE OR REPLACE FUNCTION public.record_payment_webhook(
  _event_type text, _payment_id uuid DEFAULT NULL, _reason text DEFAULT NULL, _provider_ref text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _pay public.payments%ROWTYPE;
BEGIN
  SELECT * INTO _pay FROM public.payments p WHERE p.id = _payment_id;
  INSERT INTO public.payment_events (payment_id, user_id, event, product, amount, currency, provider,
                                     provider_ref, reason)
  VALUES (_payment_id, _pay.user_id, 'webhook',
          CASE WHEN _pay.id IS NULL THEN NULL ELSE public.payment_product(_pay.type, _pay.metadata) END,
          _pay.amount, _pay.currency, coalesce(_pay.provider, 'stripe'), left(_provider_ref, 200),
          left(coalesce(_event_type, '') || CASE WHEN _reason IS NULL THEN '' ELSE ' : ' || _reason END, 300));
  IF _pay.id IS NOT NULL AND _pay.status = 'pending'
     AND _event_type IN ('checkout.session.expired', 'checkout.session.async_payment_failed',
                         'payment_intent.payment_failed') THEN
    UPDATE public.payments
    SET status = CASE WHEN _event_type = 'checkout.session.expired' THEN 'cancelled' ELSE 'failed' END::public.payment_status,
        metadata = metadata || jsonb_build_object('failure_reason', left(coalesce(_reason, _event_type), 300))
    WHERE id = _pay.id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_payment_webhook(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_payment_webhook(text, uuid, text, text) TO service_role;

-- ------------------------------------------------------------
-- 6. Actions des membres (aucun contenu de message n'est copié)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_activity(_user uuid, _event text, _target uuid, _ref uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  INSERT INTO public.activity_events (user_id, event, target_user_id, ref_id, ip, country, user_agent)
  VALUES (_user, _event, _target, _ref, _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_activity: %', SQLERRM;
END; $$;
REVOKE ALL ON FUNCTION public.log_activity(uuid, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(uuid, text, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.log_member_action()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row jsonb := to_jsonb(NEW);
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'likes' THEN
      IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.kind IS DISTINCT FROM NEW.kind
                                    OR OLD.status IS DISTINCT FROM NEW.status) THEN
        PERFORM public.log_activity(NEW.sender_id, NEW.kind::text, NEW.receiver_id, NEW.id);
      END IF;
    WHEN 'matches' THEN
      PERFORM public.log_activity(NEW.user_1_id, 'match', NEW.user_2_id, NEW.id);
    WHEN 'messages' THEN
      PERFORM public.log_activity(NEW.sender_id,
        CASE WHEN _row ->> 'kind' = 'voice' THEN 'voice_message' ELSE 'message' END,
        NULL, NEW.conversation_id);
    WHEN 'blocks' THEN
      PERFORM public.log_activity(NEW.blocker_id, 'block', NEW.blocked_id, NEW.id);
    WHEN 'reports' THEN
      PERFORM public.log_activity((_row ->> 'reporter_id')::uuid, 'report',
                                  (_row ->> 'reported_user_id')::uuid, NEW.id);
    WHEN 'contact_requests' THEN
      PERFORM public.log_activity(NEW.sender_id,
        CASE WHEN coalesce((_row ->> 'is_flash')::boolean, false) THEN 'flash_message' ELSE 'contact_request' END,
        NEW.receiver_id, NEW.id);
    WHEN 'favorites' THEN
      PERFORM public.log_activity(NEW.user_id, 'favorite', NEW.favorite_user_id, NEW.id);
    WHEN 'profile_visits' THEN
      PERFORM public.log_activity((_row ->> 'visitor_id')::uuid, 'visit',
                                  (_row ->> 'visited_user_id')::uuid, NEW.id);
    ELSE
      NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_member_action (%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_member_action() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['matches', 'messages', 'blocks', 'reports', 'contact_requests',
                            'favorites', 'profile_visits'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _t || '_log_activity', _t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_member_action()',
                   _t || '_log_activity', _t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS likes_log_activity ON public.likes;
CREATE TRIGGER likes_log_activity AFTER INSERT OR UPDATE OF kind, status ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.log_member_action();

-- Statut d'un compte (suspension, bannissement, réactivation) et suppression d'un compte :
-- tracés ; à la suppression, le journal du membre est anonymisé (IP, appareil, e-mail).
CREATE OR REPLACE FUNCTION public.log_account_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.auth_events SET ip = NULL, user_agent = NULL, city = NULL, email = NULL
    WHERE user_id = OLD.id;
    UPDATE public.activity_events SET ip = NULL, user_agent = NULL WHERE user_id = OLD.id;
    UPDATE public.payment_events SET ip = NULL, user_agent = NULL WHERE user_id = OLD.id;
    IF NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = OLD.id AND a.raw_app_meta_data ->> 'provider' = 'virtual')
       AND OLD.email NOT LIKE '%@profils-virtuels.yona.invalid' THEN
      INSERT INTO public.activity_events (user_id, event) VALUES (OLD.id, 'account_deleted');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity(NEW.id,
      CASE NEW.status WHEN 'suspended' THEN 'account_suspended' WHEN 'disabled' THEN 'account_banned'
                      WHEN 'active' THEN 'account_reactivated' ELSE 'account_deleted' END,
      NULL, NULL);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_account_change: %', SQLERRM;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.log_account_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS users_log_account ON public.users;
CREATE TRIGGER users_log_account AFTER UPDATE OF status OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.log_account_change();

-- ------------------------------------------------------------
-- 7. Erreurs du serveur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_server_error(
  _source text, _message text, _user_id uuid DEFAULT NULL, _path text DEFAULT NULL, _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.server_errors (source, message, user_id, path, details)
  VALUES (left(coalesce(_source, 'serveur'), 100), left(coalesce(_message, '?'), 2000), _user_id,
          left(_path, 300), coalesce(_details, '{}'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.log_server_error(text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_server_error(text, text, uuid, text, jsonb) TO service_role;

-- ------------------------------------------------------------
-- 8. Journal d'audit des administrateurs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _new jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _old jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  _row jsonb := coalesce(_new, _old);
  _changes jsonb;
  _ctx jsonb;
BEGIN
  -- Seulement les modifications faites par un administrateur connecté.
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(jsonb_object_agg(k, jsonb_build_object('avant', _old -> k, 'après', v)), '{}'::jsonb)
    INTO _changes
    FROM jsonb_each(_new) AS e(k, v)
    WHERE _old -> k IS DISTINCT FROM v AND k NOT IN ('updated_at');
    IF _changes = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  ELSE
    _changes := _row - 'content';
  END IF;
  _ctx := public.request_context();
  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, changes, ip, user_agent)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME,
          coalesce(_row ->> 'id', _row ->> 'user_id'), _changes, _ctx ->> 'ip', _ctx ->> 'user_agent');
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'audit_admin_change (%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.audit_admin_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['users', 'profiles', 'photos', 'profile_verifications', 'reports',
                            'support_tickets', 'user_roles', 'subscriptions', 'payments',
                            'moderation_actions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _t || '_audit_admin', _t);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change()',
                   _t || '_audit_admin', _t);
  END LOOP;
END $$;

-- Action d'un administrateur faite par le serveur (clé service) : tracée explicitement.
CREATE OR REPLACE FUNCTION public.admin_log_action(_action text, _target_table text, _target_id text, _details jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, changes, ip, user_agent)
  VALUES (auth.uid(), left(_action, 100), _target_table, _target_id, coalesce(_details, '{}'::jsonb),
          _ctx ->> 'ip', _ctx ->> 'user_agent');
END; $$;
REVOKE ALL ON FUNCTION public.admin_log_action(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_action(text, text, text, jsonb) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 9. Conservation limitée (RGPD) : IP et appareils effacés après 12 mois
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_old_logs()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer := 0;
  _c integer;
BEGIN
  UPDATE public.auth_events SET ip = NULL, user_agent = NULL, city = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.activity_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.payment_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.admin_audit_log SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.server_errors WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.purge_old_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_logs() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-purge-journaux';
    PERFORM cron.schedule('yona-purge-journaux', '17 3 * * *', 'select public.purge_old_logs()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : purge des journaux à lancer par le serveur.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : purge à lancer par le serveur.', SQLERRM;
END;
$cron$;
