-- ============================================================================
-- YONA — CRÉER TOUTE LA BASE DE DONNÉES (projet Supabase neuf et vide)
--
-- Ce fichier installe en une seule fois tout ce dont le site a besoin :
--   31 tables, 122 fonctions, 84 règles d'accès, les droits de chaque rôle,
--   la création automatique du profil à l'inscription (e-mail ou Google), 3 espaces de
--   fichiers privés (photos, messages vocaux, vérifications), les messages en temps réel,
--   les tâches automatiques, les 247 pays et les 50 profils virtuels.
--
-- Mode d'emploi : Supabase → SQL Editor → New query → coller TOUT le fichier → Run.
-- Si Supabase affiche un avertissement (« destructive operation »), choisir
-- « Run this query » : rien n'est supprimé, ce sont des mots présents dans les fonctions.
-- Le tableau affiché à la fin doit indiquer ✅ sur chaque ligne.
--
-- Tout ou rien : en cas d'erreur, rien n'est enregistré. Le fichier refuse de s'exécuter
-- dans une base qui contient déjà des tables.
--
-- Les comptes, mots de passe, connexions et e-mails « mot de passe oublié » sont gérés par
-- Supabase Auth (schéma auth, mots de passe chiffrés) : aucune table à créer pour eux.
-- Le déclencheur de la section « Comptes » relie chaque nouveau compte à son profil.
--
-- Fichier généré par scripts/generate-base-complete.py à partir de supabase/migrations/
-- (87 migrations). Ne pas modifier à la main.
-- ============================================================================

-- ============================================================================
-- 1. Vérification : la base doit être vide
-- ============================================================================

DO $garde$
DECLARE
  _tables text;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'YONA est déjà installé dans cette base : rien n''a été modifié.'
      USING HINT = 'Ce fichier sert uniquement à remplir un projet Supabase neuf et vide.';
  END IF;
  SELECT string_agg(relname, ', ' ORDER BY relname) INTO _tables
  FROM pg_catalog.pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p', 'v', 'm');
  IF _tables IS NOT NULL THEN
    RAISE EXCEPTION 'Cette base n''est pas vide (tables : %) : rien n''a été modifié.', _tables
      USING HINT = 'Ce fichier est prévu pour un projet Supabase neuf et vide.';
  END IF;
END
$garde$;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;

-- ============================================================================
-- 2. Extensions
-- ============================================================================

-- unaccent : recherche sans accents (villes, prénoms).
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- ============================================================================
-- 3. Types : listes de valeurs fixes (rôles, statuts, motifs…)
-- ============================================================================

CREATE TYPE public.account_status AS ENUM (
    'active',
    'suspended',
    'disabled',
    'deleted'
);

CREATE TYPE public.app_role AS ENUM (
    'user',
    'admin'
);

CREATE TYPE public.conversation_status AS ENUM (
    'open',
    'locked',
    'closed'
);

CREATE TYPE public.gender AS ENUM (
    'male',
    'female'
);

CREATE TYPE public.like_kind AS ENUM (
    'like',
    'pass'
);

CREATE TYPE public.like_status AS ENUM (
    'active',
    'withdrawn'
);

CREATE TYPE public.match_status AS ENUM (
    'active',
    'unmatched',
    'blocked'
);

CREATE TYPE public.message_status AS ENUM (
    'delivered',
    'blocked',
    'deleted'
);

CREATE TYPE public.moderation_action_type AS ENUM (
    'warn',
    'suspend',
    'unsuspend',
    'disable',
    'delete_photo',
    'hide_profile',
    'note'
);

CREATE TYPE public.moderation_status AS ENUM (
    'clean',
    'flagged',
    'rejected'
);

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
);

CREATE TYPE public.payment_type AS ENUM (
    'conversation_unlock',
    'subscription'
);

CREATE TYPE public.photo_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE public.profile_status AS ENUM (
    'incomplete',
    'active',
    'hidden',
    'suspended'
);

CREATE TYPE public.profile_visibility AS ENUM (
    'visible',
    'hidden'
);

CREATE TYPE public.report_reason AS ENUM (
    'fake_profile',
    'harassment',
    'inappropriate_content',
    'scam',
    'suspicious_behavior',
    'other'
);

CREATE TYPE public.report_status AS ENUM (
    'open',
    'reviewing',
    'resolved',
    'dismissed'
);

CREATE TYPE public.subscription_plan AS ENUM (
    'premium_monthly',
    'premium_yearly'
);

CREATE TYPE public.subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);

CREATE TYPE public.unlock_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);

-- ============================================================================
-- 4. Fonctions : les règles du site exécutées par la base
-- ============================================================================

CREATE FUNCTION public.activate_conversation_unlock() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.activate_premium_subscription() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.activate_profile_boost() RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _end timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('boost:' || _uid::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _uid AND b.starts_at > now() - interval '7 days'
  ) THEN
    RAISE EXCEPTION 'boost_cooldown' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.profile_boosts (user_id, starts_at, expires_at)
  VALUES (_uid, now(), now() + interval '1 hour')
  RETURNING expires_at INTO _end;
  RETURN _end;
END;
$$;

CREATE FUNCTION public.admin_list_payments() RETURNS TABLE(id uuid, user_id uuid, email text, type public.payment_type, amount integer, currency text, provider text, status public.payment_status, provider_transaction_id text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT py.id, py.user_id, u.email, py.type, py.amount, py.currency, py.provider, py.status,
         py.provider_transaction_id, py.created_at
  FROM public.payments py LEFT JOIN public.users u ON u.id = py.user_id
  ORDER BY py.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_pending_photos() RETURNS TABLE(id uuid, user_id uuid, first_name text, storage_path text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT ph.id, ph.user_id, p.first_name, ph.storage_path, ph.created_at
  FROM public.photos ph LEFT JOIN public.profiles p ON p.user_id = ph.user_id
  WHERE ph.status = 'pending'
  ORDER BY ph.created_at
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_pending_verifications() RETURNS TABLE(id uuid, user_id uuid, first_name text, method text, storage_path text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, v.user_id, p.first_name, v.method, v.storage_path, v.created_at
  FROM public.profile_verifications v LEFT JOIN public.profiles p ON p.user_id = v.user_id
  WHERE v.status = 'pending'
  ORDER BY v.created_at
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_reports(_status text DEFAULT NULL::text) RETURNS TABLE(id uuid, reason public.report_reason, description text, status public.report_status, created_at timestamp with time zone, reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text, reported_status public.account_status, message_id uuid, message_content text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT r.id, r.reason, r.description, r.status, r.created_at,
         r.reporter_id, rp.first_name, r.reported_user_id, tp.first_name, tu.status,
         r.message_id, m.content
  FROM public.reports r
  LEFT JOIN public.profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN public.profiles tp ON tp.user_id = r.reported_user_id
  LEFT JOIN public.users tu ON tu.id = r.reported_user_id
  LEFT JOIN public.messages m ON m.id = r.message_id
  WHERE _status IS NULL OR r.status::text = _status
  ORDER BY (r.status IN ('open', 'reviewing')) DESC, r.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_subscriptions() RETURNS TABLE(id uuid, user_id uuid, email text, plan public.subscription_plan, status public.subscription_status, starts_at timestamp with time zone, expires_at timestamp with time zone, active_now boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT s.id, s.user_id, u.email, s.plan, s.status, s.starts_at, s.expires_at,
         (s.status = 'active' AND s.starts_at <= now() AND s.expires_at > now())
  FROM public.subscriptions s LEFT JOIN public.users u ON u.id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_support_tickets() RETURNS TABLE(id uuid, user_id uuid, email text, first_name text, subject text, message text, priority text, status text, admin_reply text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT t.id, t.user_id, u.email, p.first_name, t.subject, t.message, t.priority, t.status,
         t.admin_reply, t.created_at
  FROM public.support_tickets t
  LEFT JOIN public.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  ORDER BY (t.status = 'open') DESC, (t.priority = 'priority') DESC, t.created_at
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_unlocks() RETURNS TABLE(id uuid, conversation_id uuid, paid_by uuid, email text, status public.unlock_status, starts_at timestamp with time zone, expires_at timestamp with time zone, active_now boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT cu.id, cu.conversation_id, cu.paid_by_user_id, u.email, cu.status, cu.starts_at, cu.expires_at,
         (cu.status = 'active' AND cu.starts_at <= now() AND cu.expires_at > now())
  FROM public.conversation_unlocks cu LEFT JOIN public.users u ON u.id = cu.paid_by_user_id
  ORDER BY cu.created_at DESC
  LIMIT 200;
END;
$$;

CREATE FUNCTION public.admin_list_users(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0) RETURNS TABLE(id uuid, email text, first_name text, status public.account_status, profile_status public.profile_status, created_at timestamp with time zone, premium boolean, is_admin boolean, reports_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _q text := nullif(btrim(coalesce(_search, '')), '');
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT u.id, u.email, p.first_name, u.status, p.status, u.created_at,
         public.is_premium(u.id), public.has_role(u.id, 'admin'),
         (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = u.id)
  FROM public.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE (_q IS NULL OR u.email ILIKE '%' || _q || '%' OR p.first_name ILIKE '%' || _q || '%')
    AND (_status IS NULL OR u.status::text = _status)
  ORDER BY u.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200) OFFSET greatest(coalesce(_offset, 0), 0);
END;
$$;

CREATE FUNCTION public.admin_moderate_photo(_photo_id uuid, _approve boolean, _reason text DEFAULT NULL::text) RETURNS public.photo_status
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _owner uuid;
  _new public.photo_status := CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.photos SET status = _new WHERE id = _photo_id RETURNING user_id INTO _owner;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT _approve THEN
    INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason, metadata)
    VALUES (auth.uid(), _owner, 'delete_photo', nullif(btrim(coalesce(_reason, '')), ''),
            jsonb_build_object('photo_id', _photo_id));
  END IF;
  RETURN _new;
END;
$$;

CREATE FUNCTION public.admin_reply_support_ticket(_ticket_id uuid, _reply text, _close boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _text text := nullif(btrim(coalesce(_reply, '')), '');
BEGIN
  PERFORM public.assert_admin();
  IF _text IS NULL OR char_length(_text) > 4000 THEN
    RAISE EXCEPTION 'invalid_reply' USING ERRCODE = '22023';
  END IF;
  UPDATE public.support_tickets
     SET admin_reply = _text, answered_at = now(), updated_at = now(),
         status = CASE WHEN _close THEN 'closed' ELSE 'answered' END
   WHERE id = _ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE FUNCTION public.admin_resolve_report(_report_id uuid, _status text, _note text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _target uuid;
BEGIN
  PERFORM public.assert_admin();
  IF _status NOT IN ('reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reports SET status = _status::public.report_status
  WHERE id = _report_id RETURNING reported_user_id INTO _target;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'report_not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason, metadata)
  VALUES (auth.uid(), _target, 'note', nullif(btrim(coalesce(_note, '')), ''),
          jsonb_build_object('report_id', _report_id, 'report_status', _status));
END;
$$;

CREATE FUNCTION public.admin_review_verification(_verification_id uuid, _approve boolean) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _owner uuid;
  _path text;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.profile_verifications
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = _verification_id AND status = 'pending'
  RETURNING user_id, storage_path INTO _owner, _path;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _approve THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _owner AND verified_at IS NULL;
  END IF;
  RETURN _path;
END;
$$;

CREATE FUNCTION public.admin_set_user_status(_user_id uuid, _action text, _reason text DEFAULT NULL::text) RETURNS public.account_status
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _new public.account_status;
  _type public.moderation_action_type;
  _why text := nullif(btrim(coalesce(_reason, '')), '');
BEGIN
  PERFORM public.assert_admin();
  IF _user_id = auth.uid() OR public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'cannot_moderate_admin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  CASE _action
    WHEN 'suspend' THEN _new := 'suspended'; _type := 'suspend';
    WHEN 'reactivate' THEN _new := 'active'; _type := 'unsuspend';
    WHEN 'ban' THEN _new := 'disabled'; _type := 'disable';
    ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END CASE;
  IF _action IN ('suspend', 'ban') AND _why IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET status = _new, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason)
  VALUES (auth.uid(), _user_id, _type, _why);
  RETURN _new;
END;
$$;

CREATE FUNCTION public.admin_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.users),
    'users_active', (SELECT count(*) FROM public.users WHERE status = 'active'),
    'users_suspended', (SELECT count(*) FROM public.users WHERE status = 'suspended'),
    'users_banned', (SELECT count(*) FROM public.users WHERE status = 'disabled'),
    'users_new_7d', (SELECT count(*) FROM public.users WHERE created_at > now() - interval '7 days'),
    'profiles_complete', (SELECT count(*) FROM public.profiles WHERE onboarding_completed_at IS NOT NULL),
    'premium_active', (SELECT count(DISTINCT user_id) FROM public.subscriptions
                       WHERE status = 'active' AND starts_at <= now() AND expires_at > now()),
    'matches_total', (SELECT count(*) FROM public.matches WHERE status = 'active'),
    'messages_7d', (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days'),
    'reports_open', (SELECT count(*) FROM public.reports WHERE status IN ('open', 'reviewing')),
    'photos_pending', (SELECT count(*) FROM public.photos WHERE status = 'pending'),
    'tickets_open', (SELECT count(*) FROM public.support_tickets WHERE status = 'open'),
    'revenue_cents', (SELECT coalesce(sum(amount), 0) FROM public.payments WHERE status = 'succeeded'),
    'revenue_30d_cents', (SELECT coalesce(sum(amount), 0) FROM public.payments
                          WHERE status = 'succeeded' AND created_at > now() - interval '30 days'),
    'unlocks_active', (SELECT count(*) FROM public.conversation_unlocks
                       WHERE status = 'active' AND starts_at <= now() AND expires_at > now())
  );
END;
$$;

CREATE FUNCTION public.admin_user_detail(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'user', (SELECT to_jsonb(u) FROM public.users u WHERE u.id = _user_id),
    'profile', (SELECT to_jsonb(p) - 'latitude' - 'longitude' FROM public.profiles p WHERE p.user_id = _user_id),
    'is_admin', public.has_role(_user_id, 'admin'),
    'premium', public.is_premium(_user_id),
    'last_seen_at', (SELECT a.last_seen_at FROM public.user_activity a WHERE a.user_id = _user_id),
    'counts', jsonb_build_object(
      'matches', (SELECT count(*) FROM public.matches m WHERE _user_id IN (m.user_1_id, m.user_2_id)),
      'messages', (SELECT count(*) FROM public.messages m WHERE m.sender_id = _user_id),
      'likes_sent', (SELECT count(*) FROM public.likes l WHERE l.sender_id = _user_id AND l.kind = 'like'),
      'reports_received', (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = _user_id),
      'reports_sent', (SELECT count(*) FROM public.reports r WHERE r.reporter_id = _user_id),
      'blocked_by', (SELECT count(*) FROM public.blocks b WHERE b.blocked_id = _user_id)
    ),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path,
                        'status', ph.status, 'is_primary', ph.is_primary) ORDER BY ph.position, ph.created_at)
                        FROM public.photos ph WHERE ph.user_id = _user_id), '[]'::jsonb),
    'subscriptions', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC)
                        FROM public.subscriptions s WHERE s.user_id = _user_id), '[]'::jsonb),
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', py.id, 'type', py.type, 'amount', py.amount,
                        'currency', py.currency, 'provider', py.provider, 'status', py.status,
                        'created_at', py.created_at) ORDER BY py.created_at DESC)
                        FROM public.payments py WHERE py.user_id = _user_id), '[]'::jsonb),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason,
                        'description', r.description, 'status', r.status, 'created_at', r.created_at)
                        ORDER BY r.created_at DESC)
                        FROM public.reports r WHERE r.reported_user_id = _user_id), '[]'::jsonb),
    'moderation', coalesce((SELECT jsonb_agg(jsonb_build_object('action', ma.action, 'reason', ma.reason,
                        'admin_email', au.email, 'created_at', ma.created_at) ORDER BY ma.created_at DESC)
                        FROM public.moderation_actions ma
                        LEFT JOIN public.users au ON au.id = ma.admin_id
                        WHERE ma.target_user_id = _user_id), '[]'::jsonb)
  );
END;
$$;

CREATE FUNCTION public.ai_usage_day() RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT (now() AT TIME ZONE 'UTC')::date
$$;

CREATE FUNCTION public.assert_admin() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE FUNCTION public.block_user(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _user_id = _me THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (_me, _user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  UPDATE public.matches m SET status = 'blocked'
  WHERE m.user_1_id = least(_me, _user_id) AND m.user_2_id = greatest(_me, _user_id)
    AND m.status = 'active';
  UPDATE public.conversations c SET status = 'closed'
  WHERE c.user_1_id = least(_me, _user_id) AND c.user_2_id = greatest(_me, _user_id)
    AND c.status <> 'closed';
  UPDATE public.contact_requests r SET status = 'cancelled', responded_at = now()
  WHERE r.status = 'pending'
    AND ((r.sender_id = _me AND r.receiver_id = _user_id)
      OR (r.sender_id = _user_id AND r.receiver_id = _me));
  DELETE FROM public.favorites f
  WHERE (f.user_id = _me AND f.favorite_user_id = _user_id)
     OR (f.user_id = _user_id AND f.favorite_user_id = _me);
  RETURN true;
END;
$$;

CREATE FUNCTION public.can_browse_profiles() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid() AND u.status = 'active' AND p.status IN ('active', 'hidden')
  )
$$;

CREATE FUNCTION public.can_view_profile(_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND _other IS NOT NULL AND _other <> auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(_other)
    AND NOT public.is_blocked_between(auth.uid(), _other)
$$;

CREATE FUNCTION public.cancel_contact_request(_request_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.check_profile_personal_info() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date) THEN
    IF NEW.birth_date < DATE '1900-01-01' OR NEW.birth_date > current_date THEN
      RAISE EXCEPTION 'invalid_birth_date' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.birth_date > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'underage: 18 ans minimum' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.check_profile_visibility() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    RAISE EXCEPTION 'profile_status_forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status = 'active' AND (
    NULLIF(btrim(NEW.first_name), '') IS NULL OR NEW.gender IS NULL OR NEW.birth_date IS NULL
  ) THEN
    RAISE EXCEPTION 'profile_incomplete' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;

CREATE FUNCTION public.clear_my_location() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.profile_locations WHERE user_id = auth.uid();
END;
$$;

CREATE FUNCTION public.clear_profile_coordinates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.latitude := NULL;
  NEW.longitude := NULL;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.compatibility_breakdown(_me uuid, _other uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  p1 public.profiles%ROWTYPE;
  p2 public.profiles%ROWTYPE;
  c1 public.christian_profiles%ROWTYPE;
  c2 public.christian_profiles%ROWTYPE;
  f1 public.preferences%ROWTYPE;
  f2 public.preferences%ROWTYPE;
  _details jsonb := '[]'::jsonb;
  _points numeric := 0;
  _max numeric := 0;
  _common text[];
  _age1 integer;
  _age2 integer;
  _pts numeric;
  _score integer;
BEGIN
  SELECT * INTO p1 FROM public.profiles WHERE user_id = _me;
  SELECT * INTO p2 FROM public.profiles WHERE user_id = _other;
  SELECT * INTO c1 FROM public.christian_profiles WHERE user_id = _me;
  SELECT * INTO c2 FROM public.christian_profiles WHERE user_id = _other;
  SELECT * INTO f1 FROM public.preferences WHERE user_id = _me;
  SELECT * INTO f2 FROM public.preferences WHERE user_id = _other;

  -- Critère « même réponse » : ajoute une ligne de détail et les points.
  -- (répété pour chaque champ texte comparable)
  IF nullif(btrim(c1.denomination), '') IS NOT NULL AND nullif(btrim(c2.denomination), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.denomination)) = lower(btrim(c2.denomination)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'denomination', 'label', 'Dénomination',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même dénomination : ' || c2.denomination
                   ELSE 'Dénominations différentes' END);
  END IF;
  IF nullif(btrim(c1.faith_importance), '') IS NOT NULL AND nullif(btrim(c2.faith_importance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.faith_importance)) = lower(btrim(c2.faith_importance)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'faith_importance', 'label', 'Place de la foi',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'La foi a la même place dans vos vies'
                   ELSE 'La foi n''a pas tout à fait la même place' END);
  END IF;
  IF nullif(btrim(c1.church_attendance), '') IS NOT NULL AND nullif(btrim(c2.church_attendance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.church_attendance)) = lower(btrim(c2.church_attendance)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'church_attendance', 'label', 'Église',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même rythme de fréquentation de l''église'
                   ELSE 'Rythmes de fréquentation de l''église différents' END);
  END IF;
  IF nullif(btrim(c1.prayer_practice), '') IS NOT NULL AND nullif(btrim(c2.prayer_practice), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.prayer_practice)) = lower(btrim(c2.prayer_practice)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'prayer', 'label', 'Prière',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pratique de la prière'
                   ELSE 'Pratiques de la prière différentes' END);
  END IF;

  -- Valeurs chrétiennes et intérêts : points selon le nombre d'éléments en commun (3 = maximum).
  IF cardinality(c1.christian_values) > 0 AND cardinality(c2.christian_values) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(c2.christian_values) v
    WHERE lower(v) IN (SELECT lower(x) FROM unnest(c1.christian_values) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'values', 'label', 'Valeurs chrétiennes',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' valeur(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Aucune valeur en commun indiquée' END);
  END IF;
  IF cardinality(p1.interests) > 0 AND cardinality(p2.interests) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(p2.interests) v
    WHERE public.normalize_place(v) IN (SELECT public.normalize_place(x) FROM unnest(p1.interests) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'interests', 'label', 'Centres d''intérêt',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' intérêt(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Pas d''intérêt en commun' END);
  END IF;

  IF nullif(btrim(f1.relationship_goal), '') IS NOT NULL AND nullif(btrim(f2.relationship_goal), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.relationship_goal)) = lower(btrim(f2.relationship_goal)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'goal', 'label', 'Objectif',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Vous cherchez le même type de relation'
                   ELSE 'Objectifs de relation différents' END);
  END IF;
  IF nullif(btrim(f1.family_project), '') IS NOT NULL AND nullif(btrim(f2.family_project), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.family_project)) = lower(btrim(f2.family_project)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'family', 'label', 'Projet familial',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même projet familial'
                   ELSE 'Projets familiaux différents' END);
  END IF;

  -- Âges : chacun est-il dans la tranche d'âge recherchée par l'autre ?
  IF f1.user_id IS NOT NULL AND f2.user_id IS NOT NULL
     AND p1.birth_date IS NOT NULL AND p2.birth_date IS NOT NULL THEN
    _age1 := extract(year FROM age(p1.birth_date))::integer;
    _age2 := extract(year FROM age(p2.birth_date))::integer;
    _pts := (CASE WHEN _age2 BETWEEN f1.min_age AND f1.max_age THEN 5 ELSE 0 END)
          + (CASE WHEN _age1 BETWEEN f2.min_age AND f2.max_age THEN 5 ELSE 0 END);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'age', 'label', 'Âges recherchés',
      'points', _pts, 'max', 10, 'matched', _pts = 10,
      'note', CASE WHEN _pts = 10 THEN 'Chacun correspond à l''âge recherché par l''autre'
                   WHEN _pts = 5 THEN 'Un seul de vous correspond à l''âge recherché par l''autre'
                   ELSE 'Vos âges ne correspondent pas aux tranches recherchées' END);
  END IF;

  IF nullif(p1.country, '') IS NOT NULL AND nullif(p2.country, '') IS NOT NULL THEN
    _pts := CASE WHEN public.normalize_place(p1.country) = public.normalize_place(p2.country) THEN 5 ELSE 0 END;
    _points := _points + _pts; _max := _max + 5;
    _details := _details || jsonb_build_object('key', 'country', 'label', 'Pays',
      'points', _pts, 'max', 5, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pays : ' || p2.country ELSE 'Pays différents' END);
  END IF;

  IF _max = 0 THEN
    RETURN jsonb_build_object('score', NULL, 'details', '[]'::jsonb);
  END IF;
  _score := round(100 * _points / _max);
  RETURN jsonb_build_object('score', _score, 'details', _details);
END;
$$;

CREATE FUNCTION public.confirm_payment(_payment_id uuid, _provider text, _provider_transaction_id text, _amount integer, _currency text) RETURNS public.payment_status
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.consume_ai_quota(_feature text DEFAULT 'roi_salomon'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := public.ai_usage_day();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF _feature IS NULL OR _feature NOT IN ('roi_salomon', 'ice_breaker') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_feature');
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'account_inactive');
  END IF;
  _premium := public.is_premium(_uid);
  INSERT INTO public.ai_usage (user_id, feature, usage_date, usage_count)
  VALUES (_uid, _feature, _day, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;
  -- Verrou de la ligne du jour : des questions simultanées sont comptées une par une.
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  FOR UPDATE;
  IF NOT _premium AND _used >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'used', _used,
      'limit', 3, 'remaining', 0, 'unlimited', false);
  END IF;
  UPDATE public.ai_usage SET usage_count = usage_count + 1
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  RETURNING usage_count INTO _used;
  RETURN jsonb_build_object('allowed', true, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;

CREATE FUNCTION public.consume_free_message(_conversation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ DECLARE _uid uuid := auth.uid(); _used smallint; _premium boolean; _unlocked boolean; _status public.conversation_status; BEGIN IF _uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated'); END IF; IF NOT public.is_conversation_participant(_conversation_id, _uid) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_participant'); END IF; SELECT status INTO _status FROM public.conversations WHERE id = _conversation_id; IF _status = 'closed' THEN RETURN jsonb_build_object('allowed', false, 'reason', 'conversation_closed'); END IF; _premium := public.is_premium(_uid); _unlocked := public.has_active_conversation_unlock(_conversation_id); IF _premium OR _unlocked THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'premium', _premium, 'unlocked', _unlocked); END IF; INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used) VALUES (_conversation_id, _uid, 0) ON CONFLICT (conversation_id, user_id) DO NOTHING; SELECT free_messages_used INTO _used FROM public.conversation_user_usage WHERE conversation_id = _conversation_id AND user_id = _uid FOR UPDATE; IF _used >= 3 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'free_limit_reached', 'used', _used, 'limit', 3); END IF; UPDATE public.conversation_user_usage SET free_messages_used = free_messages_used + 1 WHERE conversation_id = _conversation_id AND user_id = _uid RETURNING free_messages_used INTO _used; UPDATE public.conversations SET free_messages_used = LEAST(free_messages_used + 1, 32767) WHERE id = _conversation_id; RETURN jsonb_build_object('allowed', true, 'used', _used, 'limit', 3, 'unlimited', false); END; $$;

CREATE FUNCTION public.contains_phone_number(_text text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
DECLARE
  _t text := coalesce(_text, '');
  _prev text;
BEGIN
  -- Variantes du signe plus ramenées à « + » (6.2).
  _t := translate(_t, '＋⁺', '++');
  -- 6.3 — Tous les espaces ramenés à une espace simple.
  _t := translate(
    _t,
    E'              　\t\r\n\v\f',
    '                     '
  );
  -- 6.6 — Caractères invisibles supprimés (sélecteurs d'émoji, touches, largeur nulle).
  _t := regexp_replace(_t, E'[️︎⃣​‌‍⁠﻿]', '', 'g');
  -- 6.6 — Chiffres spéciaux ramenés aux chiffres ordinaires.
  _t := translate(_t, '０１２３４５６７８９', '0123456789');
  _t := translate(_t, '⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉', '01234567890123456789');
  _t := translate(_t, '⓪①②③④⑤⑥⑦⑧⑨⓿❶❷❸❹❺❻❼❽❾', '01234567890123456789');
  _t := translate(_t, '➀➁➂➃➄➅➆➇➈➊➋➌➍➎➏➐➑➒', '123456789123456789');
  _t := translate(_t, '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡', '01234567890123456789');
  _t := translate(_t, '𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿', '012345678901234567890123456789');
  _t := translate(_t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');

  _t := lower(_t);
  -- Accents retirés (pour « zéro » et les mots séparateurs).
  _t := translate(_t, 'àâäáãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn');
  -- 6.4 — Tirets typographiques ramenés au tiret simple.
  _t := translate(_t, '‐‑‒–—−﹣－', '--------');
  -- 6.5 — Parenthèses et crochets (y compris pleine largeur) ramenés à ( et ).
  _t := translate(_t, '（）［］｛｝[]{}', '()()()()()');

  -- 6.6 — Nombres écrits en lettres (français, puis anglais), du plus long au plus court.
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]sept\M', ' 97 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]huit\M', ' 98 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]neuf\M', ' 99 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]onze\M', ' 91 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]douze\M', ' 92 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]treize\M', ' 93 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatorze\M', ' 94 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quinze\M', ' 95 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]seize\M', ' 96 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix\M', ' 90 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ](un|une)\M', ' 81 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]deux\M', ' 82 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]trois\M', ' 83 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatre\M', ' 84 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]cinq\M', ' 85 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]six\M', ' 86 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]sept\M', ' 87 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]huit\M', ' 88 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]neuf\M', ' 89 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?\M', ' 80 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]sept\M', ' 77 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]huit\M', ' 78 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]neuf\M', ' 79 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?onze\M', ' 71 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]douze\M', ' 72 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]treize\M', ' 73 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quatorze\M', ' 74 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quinze\M', ' 75 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]seize\M', ' 76 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix\M', ' 70 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]sept\M', ' 17 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]huit\M', ' 18 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]neuf\M', ' 19 ', 'g');
  -- Dizaines suivies d'une unité (« trente-quatre », « vingt et un »).
  _t := regexp_replace(_t, '\mvingt[- ](et[- ])?', ' 2', 'g');
  _t := regexp_replace(_t, '\mtrente[- ](et[- ])?', ' 3', 'g');
  _t := regexp_replace(_t, '\mquarante[- ](et[- ])?', ' 4', 'g');
  _t := regexp_replace(_t, '\mcinquante[- ](et[- ])?', ' 5', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?', ' 6', 'g');
  _t := regexp_replace(_t, '\m([2-6])(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)\M', '\1\2', 'g');
  _t := regexp_replace(_t, '\mvingt\M', ' 20 ', 'g');
  _t := regexp_replace(_t, '\mtrente\M', ' 30 ', 'g');
  _t := regexp_replace(_t, '\mquarante\M', ' 40 ', 'g');
  _t := regexp_replace(_t, '\mcinquante\M', ' 50 ', 'g');
  _t := regexp_replace(_t, '\msoixante\M', ' 60 ', 'g');
  _t := regexp_replace(_t, '\monze\M', ' 11 ', 'g');
  _t := regexp_replace(_t, '\mdouze\M', ' 12 ', 'g');
  _t := regexp_replace(_t, '\mtreize\M', ' 13 ', 'g');
  _t := regexp_replace(_t, '\mquatorze\M', ' 14 ', 'g');
  _t := regexp_replace(_t, '\mquinze\M', ' 15 ', 'g');
  _t := regexp_replace(_t, '\mseize\M', ' 16 ', 'g');
  _t := regexp_replace(_t, '\mdix\M', ' 10 ', 'g');
  -- Unités (une dizaine déjà convertie peut précéder : « 3quatre » → « 34 »).
  _t := regexp_replace(_t, '(zero|\mzero)\M', ' 0 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)(un|une)\M', '\1 1 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)deux\M', '\1 2 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)trois\M', '\1 3 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)quatre\M', '\1 4 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)cinq\M', '\1 5 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)six\M', '\1 6 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)sept\M', '\1 7 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)huit\M', '\1 8 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)neuf\M', '\1 9 ', 'g');
  _t := regexp_replace(_t, '([2-6]) ([0-9]) ', '\1\2 ', 'g');
  -- Anglais.
  _t := regexp_replace(_t, '\mone\M', ' 1 ', 'g');
  _t := regexp_replace(_t, '\mtwo\M', ' 2 ', 'g');
  _t := regexp_replace(_t, '\mthree\M', ' 3 ', 'g');
  _t := regexp_replace(_t, '\mfour\M', ' 4 ', 'g');
  _t := regexp_replace(_t, '\mfive\M', ' 5 ', 'g');
  _t := regexp_replace(_t, '\mseven\M', ' 7 ', 'g');
  _t := regexp_replace(_t, '\meight\M', ' 8 ', 'g');
  _t := regexp_replace(_t, '\mnine\M', ' 9 ', 'g');
  -- Mots utilisés comme séparateurs.
  _t := regexp_replace(_t, '\m(point|tiret|espace|virgule|slash|dot|dash)\M', ' ', 'g');

  -- 6.6 — Lettres utilisées comme chiffres entre des chiffres : o → 0 ; l, i, | → 1.
  LOOP
    _prev := _t;
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)o(?=[^[:alpha:][:digit:]]*[0-9])', '\10', 'g');
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)[li|](?=[^[:alpha:][:digit:]]*[0-9])', '\11', 'g');
    _t := regexp_replace(_t, '\mo(?=[0-9])', '0', 'g');
    EXIT WHEN _t = _prev;
  END LOOP;

  -- Formes ordinaires écartées : montants avec devise (séparateurs de milliers en
  -- espaces, points, virgules ou apostrophes), dates, heures et plages horaires.
  _t := regexp_replace(
    _t,
    '[0-9]{1,3}([ .,''][0-9]{3})+ ?(f ?cfa|cfa|xaf|xof|francs?|f\M|€|euros?|eur\M|\$|usd|dollars?)',
    ' ', 'g');
  _t := regexp_replace(_t, '(€|\$|usd|eur) ?[0-9]{1,3}([ .,''][0-9]{3})+', ' ', 'g');
  _t := regexp_replace(_t, '\m[0-9]{1,2} ?[ ./-] ?[0-9]{1,2} ?[ ./-] ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?[./-] ?[0-9]{1,2} ?[./-] ?[0-9]{1,2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?- ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9] ?(-|a) ?([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M',
    ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M(?![ ]*[:./-][ ]*[0-9])',
    ' ', 'g');

  -- Séparateurs entre les chiffres (et après un « + ») supprimés : espaces (6.3),
  -- tirets (6.4), parenthèses (6.5) et tout autre signe (6.6).
  _t := regexp_replace(_t, '\(( ?\+? ?[0-9][0-9 -]*) ?\)', ' \1 ', 'g');
  _t := regexp_replace(_t, '\+[^[:alpha:][:digit:]+]+(?=[0-9])', '+', 'g');
  _t := regexp_replace(_t, '([0-9])[^[:alpha:][:digit:]+]+(?=[0-9])', '\1', 'g');

  -- 6.1 — Numéro classique : au moins 8 chiffres à la suite.
  IF _t ~ '[0-9]{8,}' THEN
    RETURN true;
  END IF;

  -- 6.2 — Format international : « + » suivi d'au moins 7 chiffres.
  IF _t ~ '\+[0-9]{7,}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$_$;

CREATE FUNCTION public.create_conversation_for_match() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (match_id, user_1_id, user_2_id)
  VALUES (NEW.id, NEW.user_1_id, NEW.user_2_id)
  ON CONFLICT (match_id) DO UPDATE SET status = 'open'
    WHERE public.conversations.status = 'closed';
  RETURN NEW;
END; $$;

CREATE FUNCTION public.create_match_on_mutual_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _a uuid := least(NEW.sender_id, NEW.receiver_id);
  _b uuid := greatest(NEW.sender_id, NEW.receiver_id);
BEGIN
  IF NEW.kind <> 'like' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.kind = 'like' AND OLD.status = 'active' THEN
    RETURN NEW; -- Like déjà actif : rien de nouveau
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  IF EXISTS (
       SELECT 1 FROM public.likes
       WHERE sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id
         AND kind = 'like' AND status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks
       WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
     )
  THEN
    INSERT INTO public.matches (user_1_id, user_2_id)
    VALUES (_a, _b)
    ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
      WHERE public.matches.status = 'unmatched';
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.create_notification(_user_id uuid, _type text, _actor_id uuid, _data jsonb, _group_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN
    RETURN;
  END IF;
  IF _actor_id IS NOT NULL AND public.is_blocked_between(_user_id, _actor_id) THEN
    RETURN;
  END IF;
  IF NOT public.wants_notification(_user_id, _type) THEN
    RETURN;
  END IF;
  IF _group_key IS NOT NULL THEN
    UPDATE public.notifications n
       SET created_at = now(),
           actor_id = _actor_id,
           data = n.data || _data || jsonb_build_object('count', coalesce((n.data->>'count')::integer, 1) + 1)
     WHERE n.user_id = _user_id AND n.type = _type AND n.read_at IS NULL
       AND n.data->>'group' = _group_key;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;
  INSERT INTO public.notifications (user_id, type, actor_id, data)
  VALUES (_user_id, _type, _actor_id,
          coalesce(_data, '{}'::jsonb) || CASE WHEN _group_key IS NULL THEN '{}'::jsonb
                                               ELSE jsonb_build_object('group', _group_key, 'count', 1) END);
END;
$$;

CREATE FUNCTION public.create_support_ticket(_subject text, _message text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _s text := btrim(coalesce(_subject, ''));
  _m text := btrim(coalesce(_message, ''));
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF char_length(_s) < 3 OR char_length(_s) > 120 THEN
    RAISE EXCEPTION 'support_invalid_subject' USING ERRCODE = '22023';
  END IF;
  IF char_length(_m) < 10 OR char_length(_m) > 4000 THEN
    RAISE EXCEPTION 'support_invalid_message' USING ERRCODE = '22023';
  END IF;
  -- Anti-abus : 5 demandes par jour au plus.
  PERFORM pg_advisory_xact_lock(hashtextextended('support:' || _uid::text, 0));
  IF (SELECT count(*) FROM public.support_tickets t
      WHERE t.user_id = _uid AND t.created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'support_daily_limit' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.support_tickets (user_id, subject, message, priority)
  VALUES (_uid, _s, _m, CASE WHEN public.is_premium(_uid) THEN 'priority' ELSE 'normal' END)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE FUNCTION public.discover_profiles(_limit integer DEFAULT 30) RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, country text, bio text, gender public.gender, interests text[])
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT p.user_id, p.first_name, p.birth_date, p.city, p.country, p.bio, p.gender, p.interests
  FROM public.profiles p
  LEFT JOIN public.preferences pr ON pr.user_id = auth.uid()
  WHERE p.user_id <> auth.uid()
    AND p.status = 'active' AND p.visibility = 'visible'
    AND (pr.preferred_gender IS NULL OR p.gender = pr.preferred_gender)
    AND (
      pr.user_id IS NULL OR (
        p.birth_date <= (current_date - make_interval(years => pr.min_age))::date
        AND p.birth_date > (current_date - make_interval(years => pr.max_age + 1))::date
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.likes l
      WHERE l.sender_id = auth.uid() AND l.receiver_id = p.user_id AND l.status = 'active'
    )
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;

CREATE FUNCTION public.distance_km(_lat1 double precision, _lng1 double precision, _lat2 double precision, _lng2 double precision) RETURNS double precision
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT 2 * 6371 * asin(sqrt(least(1,
    sin(radians(_lat2 - _lat1) / 2) ^ 2
    + cos(radians(_lat1)) * cos(radians(_lat2)) * sin(radians(_lng2 - _lng1) / 2) ^ 2
  )))
$$;

CREATE FUNCTION public.enforce_photo_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer;
  _max integer;
  _premium boolean := public.is_premium(NEW.user_id);
  _size bigint;
BEGIN
  -- Deux ajouts simultanés du même membre sont traités l'un après l'autre.
  PERFORM pg_advisory_xact_lock(hashtextextended('photos:' || NEW.user_id::text, 0));
  SELECT count(*) INTO _count FROM public.photos WHERE user_id = NEW.user_id;
  _max := CASE WHEN _premium THEN 10 ELSE 3 END;
  IF _count >= _max THEN
    RAISE EXCEPTION 'photo_limit_reached: % photos maximum', _max USING ERRCODE = 'check_violation';
  END IF;
  -- Photos HD (fichier lourd) réservées au Premium.
  SELECT (o.metadata->>'size')::bigint INTO _size
  FROM storage.objects o
  WHERE o.bucket_id = 'photos' AND o.name = NEW.storage_path;
  IF NOT _premium AND coalesce(_size, 0) > 2097152 THEN
    RAISE EXCEPTION 'photo_hd_premium' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.expire_conversation_unlocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.conversation_unlocks u
     SET status = 'expired'
   WHERE u.status = 'active' AND u.expires_at IS NOT NULL AND u.expires_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

CREATE FUNCTION public.expire_subscriptions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_ai_quota(_feature text DEFAULT 'roi_salomon'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 3, 'remaining', 0,
      'unlimited', false);
  END IF;
  _premium := public.is_premium(_uid);
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = public.ai_usage_day();
  _used := coalesce(_used, 0);
  RETURN jsonb_build_object('allowed', _premium OR _used < 3, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;

CREATE FUNCTION public.get_compatibility(_other uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _b jsonb;
  _score integer;
  _premium boolean;
  _strong text[];
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_view_profile(_other) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  _b := public.compatibility_breakdown(_me, _other);
  _score := (_b->>'score')::integer;
  _premium := public.is_premium(_me);
  -- Explication courte (pour tous) : les points forts, sans le détail des réponses.
  SELECT coalesce(array_agg(lower(d->>'label')), '{}') INTO _strong
  FROM jsonb_array_elements(_b->'details') d
  WHERE (d->>'matched')::boolean;
  RETURN jsonb_build_object(
    'score', _score,
    'level', CASE WHEN _score IS NULL THEN NULL
                  WHEN _score >= 80 THEN 'excellent'
                  WHEN _score >= 60 THEN 'good'
                  WHEN _score >= 40 THEN 'medium'
                  ELSE 'low' END,
    'summary', CASE
      WHEN _score IS NULL THEN 'Pas encore assez d''informations dans vos profils pour calculer la compatibilité.'
      WHEN cardinality(_strong) = 0 THEN 'Peu de points communs dans vos profils pour le moment.'
      ELSE 'Points forts : ' || array_to_string(_strong[1:3], ', ') || '.'
    END,
    'premium', _premium,
    'details', CASE WHEN _premium THEN _b->'details' ELSE NULL END
  );
END;
$$;

CREATE FUNCTION public.get_compatibility_scores(_user_ids uuid[]) RETURNS TABLE(user_id uuid, score integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT u, (public.compatibility_breakdown(auth.uid(), u)->>'score')::integer
  FROM (SELECT DISTINCT unnest(_user_ids[1:60]) AS u) ids
  WHERE public.can_view_profile(u)
$$;

CREATE FUNCTION public.get_contact_request_quota() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_conversation_quota(_conversation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ DECLARE _uid uuid := auth.uid(); _used smallint := 0; _premium boolean; _unlocked boolean; BEGIN IF _uid IS NULL OR NOT public.is_conversation_participant(_conversation_id, _uid) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_participant'); END IF; _premium := public.is_premium(_uid); _unlocked := public.has_active_conversation_unlock(_conversation_id); SELECT COALESCE(free_messages_used, 0) INTO _used FROM public.conversation_user_usage WHERE conversation_id = _conversation_id AND user_id = _uid; _used := COALESCE(_used, 0); RETURN jsonb_build_object('allowed', _premium OR _unlocked OR _used < 3, 'used', _used, 'limit', CASE WHEN _premium OR _unlocked THEN NULL ELSE 3 END, 'premium', _premium, 'unlocked', _unlocked); END; $$;

CREATE FUNCTION public.get_favorited_by() RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, country text, favorited_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(auth.uid()) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT f.user_id, p.first_name, p.birth_date, p.city, p.country, f.created_at
  FROM public.favorites f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.favorite_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(f.user_id)
    AND NOT public.is_blocked_between(auth.uid(), f.user_id)
  ORDER BY f.created_at DESC;
END;
$$;

CREATE FUNCTION public.get_message_quota(_conversation_id uuid) RETURNS TABLE(used integer, quota_limit integer, remaining integer, exhausted boolean, unlocked boolean, unlocked_by uuid, unlock_expires_at timestamp with time zone, last_unlock_expired_at timestamp with time zone, premium boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
  _unlocked boolean := false;
  _premium boolean;
  _by uuid;
  _end timestamptz;
  _u record;
  _last_end timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND _uid IN (c.user_1_id, c.user_2_id)
  ) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;
  _premium := public.is_premium(_uid);

  SELECT u.free_messages_used INTO _used
  FROM public.conversation_user_usage u
  WHERE u.conversation_id = _conversation_id AND u.user_id = _uid;
  _used := coalesce(_used, 0);

  IF public.has_active_conversation_unlock(_conversation_id) THEN
    _unlocked := true;
    SELECT u.paid_by_user_id INTO _by
    FROM public.conversation_unlocks u
    WHERE u.conversation_id = _conversation_id AND u.status = 'active'
      AND u.starts_at <= now() AND u.expires_at > now()
    ORDER BY u.starts_at DESC
    LIMIT 1;
    _end := now();
    FOR _u IN
      SELECT u.starts_at, u.expires_at FROM public.conversation_unlocks u
      WHERE u.conversation_id = _conversation_id AND u.status = 'active'
        AND u.expires_at > now()
      ORDER BY u.starts_at
    LOOP
      IF _u.starts_at <= _end THEN
        _end := greatest(_end, _u.expires_at);
      END IF;
    END LOOP;
  END IF;

  IF NOT _unlocked THEN
    SELECT max(u.expires_at) INTO _last_end
    FROM public.conversation_unlocks u
    WHERE u.conversation_id = _conversation_id
      AND u.status IN ('active', 'expired')
      AND u.expires_at <= now();
  END IF;

  RETURN QUERY SELECT _used, 3, greatest(3 - _used, 0), (_used >= 3 AND NOT _premium), _unlocked, _by,
    CASE WHEN _unlocked THEN _end END, _last_end, _premium;
END;
$$;

CREATE FUNCTION public.get_my_boost() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _last public.profile_boosts%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO _last FROM public.profile_boosts b WHERE b.user_id = _uid
  ORDER BY b.starts_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'premium', public.is_premium(_uid),
    'active_until', CASE WHEN _last.expires_at > now() THEN _last.expires_at END,
    'next_available_at', CASE WHEN _last.starts_at + interval '7 days' > now()
                              THEN _last.starts_at + interval '7 days' END
  );
END;
$$;

CREATE FUNCTION public.get_my_premium() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_premium_badges(_user_ids uuid[]) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.get_presence(_user_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _seen timestamptz;
  _online boolean;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF _user_id <> _me THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_browse_profiles()
       OR NOT public.is_discoverable_profile(_user_id)
       OR public.is_blocked_between(_me, _user_id)
       OR NOT public.is_activity_visible(_user_id) THEN
      RETURN 'unknown';
    END IF;
  END IF;

  SELECT a.last_seen_at, a.is_online INTO _seen, _online
  FROM public.user_activity a WHERE a.user_id = _user_id;

  RETURN CASE
    WHEN _seen IS NULL THEN 'unknown'
    WHEN _online AND _seen > now() - interval '3 minutes' THEN 'online'
    WHEN _seen > now() - interval '24 hours' THEN 'recent'
    WHEN _seen > now() - interval '7 days' THEN 'this_week'
    ELSE 'inactive'
  END;
END;
$$;

CREATE FUNCTION public.get_profile_visitors() RETURNS TABLE(visitor_id uuid, first_name text, birth_date date, city text, country text, visited_at timestamp with time zone, visit_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(auth.uid()) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.visitor_id, p.first_name, p.birth_date, p.city, p.country,
         max(v.visited_at) AS visited_at, count(*)::integer AS visit_count
  FROM public.profile_visits v
  JOIN public.profiles p ON p.user_id = v.visitor_id
  WHERE v.visited_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(v.visitor_id)
    AND NOT public.is_blocked_between(auth.uid(), v.visitor_id)
  GROUP BY v.visitor_id, p.first_name, p.birth_date, p.city, p.country
  ORDER BY max(v.visited_at) DESC
  LIMIT 100;
END;
$$;

CREATE FUNCTION public.get_unread_counts() RETURNS TABLE(conversation_id uuid, unread integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, count(m.id)::integer
  FROM public.conversations c
  JOIN public.matches ma ON ma.id = c.match_id AND ma.status = 'active'
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END AS other_id
  ) o
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = auth.uid()
  JOIN public.messages m ON m.conversation_id = c.id
    AND m.status = 'delivered'
    AND m.sender_id = o.other_id
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  WHERE auth.uid() IN (c.user_1_id, c.user_2_id)
    AND c.status <> 'closed'
    AND public.is_discoverable_profile(o.other_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = o.other_id)
         OR (b.blocker_id = o.other_id AND b.blocked_id = auth.uid())
    )
  GROUP BY c.id
$$;

CREATE FUNCTION public.get_unread_notification_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*)::integer FROM public.notifications n
  WHERE n.user_id = auth.uid() AND n.read_at IS NULL
    AND (n.actor_id IS NULL OR NOT public.is_blocked_between(auth.uid(), n.actor_id))
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  _first text;
BEGIN
  _first := NULLIF(btrim(_meta ->> 'first_name'), '');
  IF _first IS NULL THEN
    _first := NULLIF(btrim(_meta ->> 'given_name'), '');
  END IF;
  IF _first IS NULL THEN
    _first := NULLIF(split_part(btrim(COALESCE(_meta ->> 'full_name', _meta ->> 'name', '')), ' ', 1), '');
  END IF;
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.profiles (user_id, first_name) VALUES (NEW.id, left(_first, 60));
  INSERT INTO public.christian_profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_activity (user_id, last_login_at, last_seen_at) VALUES (NEW.id, now(), now());
  RETURN NEW;
END; $$;

CREATE FUNCTION public.has_active_conversation_unlock(_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (
      auth.uid() IS NULL
      OR public.is_conversation_participant(_conversation_id, auth.uid())
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_unlocks u
      WHERE u.conversation_id = _conversation_id AND u.status = 'active'
        AND u.starts_at IS NOT NULL AND u.starts_at <= now()
        AND u.expires_at IS NOT NULL AND u.expires_at > now()
    )
$$;

CREATE FUNCTION public.has_mutual_like(_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND _other IS NOT NULL
    AND _other <> auth.uid()
    AND NOT public.is_blocked_between(auth.uid(), _other)
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = auth.uid() AND receiver_id = _other AND kind = 'like' AND status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = _other AND receiver_id = auth.uid() AND kind = 'like' AND status = 'active'
    )
$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (
      auth.uid() IS NULL
      OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION public.init_conversation_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
  VALUES (NEW.id, NEW.user_1_id, 0), (NEW.id, NEW.user_2_id, 0)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.is_active_account(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id AND u.status = 'active')
$$;

CREATE FUNCTION public.is_activity_visible(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce((SELECT s.activity_visible FROM public.user_settings s WHERE s.user_id = _user_id), true)
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE FUNCTION public.is_blocked_between(_a uuid, _b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() IN (_a, _b) OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
    )
$$;

CREATE FUNCTION public.is_boosted(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _user_id AND b.starts_at <= now() AND b.expires_at > now()
  ) AND public.is_premium(_user_id)
$$;

CREATE FUNCTION public.is_conversation_folder_participant(_folder text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = _folder AND auth.uid() IN (c.user_1_id, c.user_2_id)
  )
$$;

CREATE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = _conversation_id AND (_user_id = user_1_id OR _user_id = user_2_id)
    )
$$;

CREATE FUNCTION public.is_discoverable_profile(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = _user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active'
  )
$$;

CREATE FUNCTION public.is_premium(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  )
$$;

CREATE FUNCTION public.list_blocked_users() RETURNS TABLE(user_id uuid, first_name text, blocked_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT b.blocked_id, p.first_name, b.created_at
  FROM public.blocks b
  LEFT JOIN public.profiles p ON p.user_id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC
$$;

CREATE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received'::text) RETURNS TABLE(id uuid, other_user_id uuid, first_name text, birth_date date, city text, country text, message text, status text, created_at timestamp with time zone, responded_at timestamp with time zone, is_flash boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.list_notifications(_limit integer DEFAULT 50) RETURNS TABLE(id uuid, type text, actor_id uuid, actor_first_name text, data jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _premium boolean;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  _premium := public.is_premium(_me);
  RETURN QUERY
  SELECT n.id, n.type,
    CASE WHEN n.type IN ('favorite', 'visit') AND NOT _premium THEN NULL
         WHEN n.actor_id IS NOT NULL AND public.is_blocked_between(_me, n.actor_id) THEN NULL
         ELSE n.actor_id END,
    CASE WHEN n.type IN ('favorite', 'visit') AND NOT _premium THEN NULL
         WHEN n.actor_id IS NOT NULL AND public.is_blocked_between(_me, n.actor_id) THEN NULL
         ELSE p.first_name END,
    n.data - 'group', n.read_at, n.created_at
  FROM public.notifications n
  LEFT JOIN public.profiles p ON p.user_id = n.actor_id
  WHERE n.user_id = _me
    AND (n.actor_id IS NULL OR NOT public.is_blocked_between(_me, n.actor_id))
  ORDER BY n.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 100);
END;
$$;

CREATE FUNCTION public.list_search_cities(_country text DEFAULT NULL::text) RETURNS TABLE(city text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _norm_country text := public.normalize_place(_country);
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _country IS NOT NULL AND char_length(_country) > 100 THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'country';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(p.city), '\s+', ' ', 'g') AS label,
           public.normalize_place(p.city) AS norm
    FROM public.profiles p
    WHERE p.user_id <> _me
      AND public.normalize_place(p.city) IS NOT NULL
      AND (_norm_country IS NULL OR public.normalize_place(p.country) = _norm_country)
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  spellings AS (
    SELECT norm, label, count(*) AS n,
           row_number() OVER (
             PARTITION BY norm
             ORDER BY count(*) DESC,
                      (label <> upper(label) AND label <> lower(label)) DESC,
                      (label <> extensions.unaccent(label)) DESC,
                      label
           ) AS rank
    FROM visible GROUP BY norm, label
  )
  SELECT s.label, (SELECT count(*) FROM visible v WHERE v.norm = s.norm)::integer
  FROM spellings s
  WHERE s.rank = 1
  ORDER BY 2 DESC, 1
  LIMIT 300;
END;
$$;

CREATE FUNCTION public.list_search_countries() RETURNS TABLE(country text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(p.country), '\s+', ' ', 'g') AS label,
           public.normalize_place(p.country) AS norm
    FROM public.profiles p
    WHERE p.user_id <> _me
      AND public.normalize_place(p.country) IS NOT NULL
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  spellings AS (
    SELECT norm, label, count(*) AS n,
           row_number() OVER (
             PARTITION BY norm
             -- Orthographe la plus fréquente ; à égalité, casse normale (ni tout en
             -- majuscules ni tout en minuscules), puis avec accents, puis alphabétique.
             ORDER BY count(*) DESC,
                      (label <> upper(label) AND label <> lower(label)) DESC,
                      (label <> extensions.unaccent(label)) DESC,
                      label
           ) AS rank
    FROM visible GROUP BY norm, label
  )
  SELECT s.label, (SELECT count(*) FROM visible v WHERE v.norm = s.norm)::integer
  FROM spellings s
  WHERE s.rank = 1
  ORDER BY 2 DESC, 1
  LIMIT 300;
END;
$$;

CREATE FUNCTION public.list_search_values(_field text) RETURNS TABLE(value text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _field IS NULL OR _field NOT IN ('denomination', 'faith_commitment', 'interests') THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'field';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(
             CASE _field
               WHEN 'denomination' THEN cp.denomination
               WHEN 'faith_commitment' THEN cp.faith_commitment
             END
           ), '\s+', ' ', 'g') AS label
    FROM public.christian_profiles cp
    WHERE _field IN ('denomination', 'faith_commitment')
      AND cp.user_id <> _me
      AND public.is_discoverable_profile(cp.user_id)
      AND NOT public.is_blocked_between(_me, cp.user_id)
    UNION ALL
    SELECT regexp_replace(btrim(i), '\s+', ' ', 'g')
    FROM public.profiles p, unnest(p.interests) i
    WHERE _field = 'interests'
      AND p.user_id <> _me
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  normalized AS (
    SELECT label, public.normalize_place(label) AS norm FROM visible
    WHERE public.normalize_place(label) IS NOT NULL
  ),
  spellings AS (
    SELECT norm, label,
           row_number() OVER (
             PARTITION BY norm
             ORDER BY count(*) DESC,
                      (label <> upper(label) AND label <> lower(label)) DESC,
                      (label <> extensions.unaccent(label)) DESC,
                      label
           ) AS rank
    FROM normalized GROUP BY norm, label
  )
  SELECT s.label, (SELECT count(*) FROM normalized n WHERE n.norm = s.norm)::integer
  FROM spellings s
  WHERE s.rank = 1
  ORDER BY 2 DESC, 1
  LIMIT 300;
END;
$$;

-- ============================================================================
-- 5. Table utilisée par les fonctions qui suivent
-- ============================================================================

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    user_1_id uuid NOT NULL,
    user_2_id uuid NOT NULL,
    status public.conversation_status DEFAULT 'open'::public.conversation_status NOT NULL,
    free_messages_used smallint DEFAULT 0 NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_ordered_pair CHECK ((user_1_id < user_2_id))
);

-- ============================================================================
-- 6. Fonctions : les règles du site exécutées par la base (suite)
-- ============================================================================

CREATE FUNCTION public.lock_conversation_for_sending(_uid uuid, _conversation_id uuid) RETURNS public.conversations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _conv public.conversations%ROWTYPE;
  _other uuid;
BEGIN
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
  RETURN _conv;
END;
$$;

CREATE FUNCTION public.mark_all_notifications_read() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notifications SET read_at = now()
  WHERE user_id = auth.uid() AND read_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

CREATE FUNCTION public.mark_conversation_read(_conversation_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _at timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND _uid IN (c.user_1_id, c.user_2_id)
  ) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversation_reads AS r (conversation_id, user_id, last_read_at)
  VALUES (_conversation_id, _uid, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = greatest(r.last_read_at, excluded.last_read_at)
  RETURNING r.last_read_at INTO _at;
  RETURN _at;
END;
$$;

CREATE FUNCTION public.mark_notification_read(_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.notifications SET read_at = now()
  WHERE id = _id AND user_id = auth.uid() AND read_at IS NULL;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.mark_offline() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_activity SET is_online = false WHERE user_id = auth.uid();
END;
$$;

CREATE FUNCTION public.messages_block_phone_numbers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.contains_phone_number := public.contains_phone_number(NEW.content);
  IF NEW.contains_phone_number AND NEW.status = 'delivered' THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.normalize_place(_value text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT nullif(
    btrim(regexp_replace(lower(extensions.unaccent(coalesce(_value, ''))), '[\s''’`\-]+', ' ', 'g')),
    ''
  )
$$;

CREATE FUNCTION public.notify_contact_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.receiver_id, 'contact_request', NEW.sender_id,
    jsonb_build_object('request_id', NEW.id, 'is_flash', NEW.is_flash));
  RETURN NEW;
END $$;

CREATE FUNCTION public.notify_favorite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.favorite_user_id, 'favorite', NEW.user_id, '{}'::jsonb,
    'favorite:' || NEW.user_id::text);
  RETURN NEW;
END $$;

CREATE FUNCTION public.notify_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.kind = 'like' AND NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.receiver_id, 'like', NEW.sender_id, '{}'::jsonb,
      'like:' || NEW.sender_id::text);
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.notify_match() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.user_1_id, 'match', NEW.user_2_id,
      jsonb_build_object('match_id', NEW.id));
    PERFORM public.create_notification(NEW.user_2_id, 'match', NEW.user_1_id,
      jsonb_build_object('match_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.notify_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _other uuid;
BEGIN
  IF NEW.status <> 'delivered' THEN
    RETURN NEW;
  END IF;
  SELECT CASE WHEN c.user_1_id = NEW.sender_id THEN c.user_2_id ELSE c.user_1_id END
    INTO _other FROM public.conversations c WHERE c.id = NEW.conversation_id;
  PERFORM public.create_notification(_other, 'message', NEW.sender_id,
    jsonb_build_object('conversation_id', NEW.conversation_id),
    'message:' || NEW.conversation_id::text);
  RETURN NEW;
END $$;

CREATE FUNCTION public.notify_visit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.visited_user_id, 'visit', NEW.visitor_id, '{}'::jsonb,
    'visit:' || NEW.visitor_id::text);
  RETURN NEW;
END $$;

CREATE FUNCTION public.photos_after_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.is_primary THEN
    UPDATE public.photos SET is_primary = true
    WHERE id = (
      SELECT id FROM public.photos WHERE user_id = OLD.user_id ORDER BY position, created_at LIMIT 1
    );
  END IF;
  RETURN NULL;
END; $$;

CREATE FUNCTION public.photos_before_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.is_primary := NOT EXISTS (
    SELECT 1 FROM public.photos WHERE user_id = NEW.user_id AND is_primary
  );
  NEW.position := coalesce(
    (SELECT max(position) + 1 FROM public.photos WHERE user_id = NEW.user_id), 0
  );
  RETURN NEW;
END; $$;

CREATE FUNCTION public.premium_plan_amount(_plan public.subscription_plan) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _plan WHEN 'premium_monthly' THEN 500 WHEN 'premium_yearly' THEN 3500 END
$$;

CREATE FUNCTION public.protect_like_parties() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
    RAISE EXCEPTION 'like_parties_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.protect_photo_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.status := 'pending';
    ELSE NEW.status := OLD.status; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.protect_profile_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL AND OLD.status = 'suspended' THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.protect_server_profile_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Requête d'un membre (auth.uid() renseigné, hors administrateur) : ces champs restent
  -- ceux du serveur.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_virtual := false;
      NEW.verified_at := NULL;
    ELSE
      NEW.is_virtual := OLD.is_virtual;
      NEW.verified_at := OLD.verified_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.protect_terms_accepted_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  ELSIF NEW.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := LEAST(NEW.terms_accepted_at, now());
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.protect_user_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    NEW.status := OLD.status;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.recent_signups() RETURNS TABLE(first_name text, country text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT split_part(p.first_name, ' ', 1), p.country, p.created_at
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.visibility = 'visible'
    AND NOT p.is_virtual
    AND p.onboarding_completed_at IS NOT NULL
    AND p.first_name IS NOT NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 8;
$$;

CREATE FUNCTION public.record_profile_visit(_visited_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _visitor uuid := auth.uid();
BEGIN
  IF _visitor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _visited_user_id IS NULL OR _visited_user_id = _visitor THEN
    RETURN false;
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_visited_user_id)
     OR public.is_blocked_between(_visitor, _visited_user_id) THEN
    RETURN false;
  END IF;

  -- Appels simultanés pour le même couple : traités l'un après l'autre.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('profile_visit:' || _visitor::text || ':' || _visited_user_id::text, 0)
  );

  -- 1. Une visite par heure et par profil visité.
  IF EXISTS (
    SELECT 1 FROM public.profile_visits v
    WHERE v.visitor_id = _visitor
      AND v.visited_user_id = _visited_user_id
      AND v.visited_at > now() - interval '1 hour'
  ) THEN
    RETURN false;
  END IF;

  -- 2. Au plus 100 visites enregistrées par visiteur sur 24 heures.
  IF (
    SELECT count(*) FROM public.profile_visits v
    WHERE v.visitor_id = _visitor AND v.visited_at > now() - interval '24 hours'
  ) >= 100 THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_visits (visitor_id, visited_user_id)
  VALUES (_visitor, _visited_user_id);
  RETURN true;
END;
$$;

CREATE FUNCTION public.refund_ai_quota(_user_id uuid, _feature text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.ai_usage SET usage_count = usage_count - 1
  WHERE user_id = _user_id AND feature = _feature AND usage_date = public.ai_usage_day()
    AND usage_count > 0
$$;

CREATE FUNCTION public.refuse_blocked_interaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _a uuid;
  _b uuid;
BEGIN
  IF TG_TABLE_NAME = 'favorites' THEN
    _a := NEW.user_id; _b := NEW.favorite_user_id;
  ELSIF TG_TABLE_NAME = 'profile_visits' THEN
    _a := NEW.visitor_id; _b := NEW.visited_user_id;
  ELSIF TG_TABLE_NAME = 'likes' THEN
    _a := NEW.sender_id; _b := NEW.receiver_id;
  END IF;
  IF public.is_blocked_between(_a, _b) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.remove_one_virtual_profile(_country text, _gender public.gender) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _key text := lower(btrim(coalesce(_country, '')));
  _origin public.geo_countries%ROWTYPE;
  _target uuid;
BEGIN
  SELECT p.user_id INTO _target
  FROM public.profiles p
  WHERE p.is_virtual AND lower(btrim(p.country)) = _key
  ORDER BY (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _target IS NULL THEN
    SELECT * INTO _origin FROM public.geo_countries g WHERE lower(g.name) = _key LIMIT 1;
    SELECT p.user_id INTO _target
    FROM public.profiles p
    LEFT JOIN public.geo_countries g ON lower(g.name) = lower(btrim(p.country))
    WHERE p.is_virtual
    ORDER BY
      CASE
        WHEN _origin.code IS NULL OR g.code IS NULL THEN 1e12
        ELSE power(g.lat - _origin.lat, 2)
           + power((g.lng - _origin.lng) * cos(radians((g.lat + _origin.lat) / 2)), 2)
      END,
      (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF _target IS NULL THEN
    RETURN NULL;
  END IF;

  -- Double vérification : uniquement un compte virtuel (profil ET compte marqués).
  DELETE FROM auth.users u
  WHERE u.id = _target
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN _target;
END; $$;

CREATE FUNCTION public.replace_virtual_profile_on_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _removed uuid;
BEGIN
  IF NEW.is_virtual OR OLD.onboarding_completed_at IS NOT NULL OR NEW.onboarding_completed_at IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Une seule fois par membre (même s'il recommence son inscription).
    INSERT INTO public.virtual_profile_removals (user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    _removed := public.remove_one_virtual_profile(NEW.country, NEW.gender);
    UPDATE public.virtual_profile_removals SET removed_user_id = _removed
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Jamais d'échec d'inscription à cause des profils virtuels.
    RAISE WARNING 'replace_virtual_profile_on_signup: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;

CREATE FUNCTION public.report_user(_user_id uuid, _reason public.report_reason, _description text DEFAULT NULL::text, _message_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_description, '')), '');
  _conv uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _user_id = _me
     OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;
  IF _reason IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 2000 THEN
    RAISE EXCEPTION 'description_too_long' USING ERRCODE = '22023';
  END IF;
  -- 22.2 : le message doit venir de la personne signalée, dans une conversation du signaleur.
  IF _message_id IS NOT NULL THEN
    SELECT m.conversation_id INTO _conv
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = _message_id AND m.sender_id = _user_id
      AND _me IN (c.user_1_id, c.user_2_id);
    IF _conv IS NULL THEN
      RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('report:' || _me::text, 0));
  SELECT r.id INTO _id FROM public.reports r
  WHERE r.reporter_id = _me AND r.reported_user_id = _user_id
    AND r.message_id IS NOT DISTINCT FROM _message_id
    AND r.status IN ('open', 'reviewing');
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;
  IF (SELECT count(*) FROM public.reports r
      WHERE r.reporter_id = _me AND r.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'report_daily_limit' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reports (reporter_id, reported_user_id, conversation_id, message_id, reason, description)
  VALUES (_me, _user_id, _conv, _message_id, _reason, _text)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE FUNCTION public.respond_contact_request(_request_id uuid, _accept boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.search_profiles(_filters jsonb DEFAULT '{}'::jsonb, _limit integer DEFAULT 30) RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, country text, bio text, gender public.gender, interests text[])
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _me uuid := auth.uid();
  _f jsonb := coalesce(_filters, '{}'::jsonb);
  _key text;
  _min int;
  _max int;
  _gender public.gender;
  _country text;
  _city text;
  _distance int;
  _my_lat double precision;
  _my_lng double precision;
  _marital text[];
  _children boolean;
  _denomination text;
  _commitment text;
  _goal text;
  _family text;
  _interests text[];
  _active_days int;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city', 'max_distance_km', 'marital_status', 'has_children',
                    'denomination', 'faith_commitment', 'relationship_goal', 'family_project',
                    'interests', 'active_within_days') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = _key;
    END IF;
  END LOOP;

  -- Âge
  IF _f ? 'min_age' THEN
    IF jsonb_typeof(_f->'min_age') <> 'number' OR (_f->>'min_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'min_age';
    END IF;
    _min := (_f->>'min_age')::int;
  END IF;
  IF _f ? 'max_age' THEN
    IF jsonb_typeof(_f->'max_age') <> 'number' OR (_f->>'max_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_age';
    END IF;
    _max := (_f->>'max_age')::int;
  END IF;
  IF (_min IS NOT NULL AND (_min < 18 OR _min > 99))
     OR (_max IS NOT NULL AND (_max < 18 OR _max > 99))
     OR (_min IS NOT NULL AND _max IS NOT NULL AND _min > _max) THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'age';
  END IF;

  -- Sexe : « female » ou « male » (texte) ; absent = indifférent.
  IF _f ? 'gender' THEN
    IF jsonb_typeof(_f->'gender') <> 'string' OR (_f->>'gender') NOT IN ('female', 'male') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'gender';
    END IF;
    _gender := (_f->>'gender')::public.gender;
  END IF;

  -- Pays : texte de 1 à 100 caractères ; comparaison exacte sans tenir compte des
  -- majuscules, accents, tirets, apostrophes ni espaces multiples.
  IF _f ? 'country' THEN
    IF jsonb_typeof(_f->'country') <> 'string'
       OR char_length(btrim(_f->>'country')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'country';
    END IF;
    _country := public.normalize_place(_f->>'country');
  END IF;

  -- Ville : texte de 1 à 100 caractères ; la ville du profil doit contenir le texte
  -- cherché, sans tenir compte des majuscules, accents, tirets, apostrophes ni espaces
  -- multiples (« yaounde » trouve « Yaoundé », « Douala 5e » est trouvé par « douala »).
  -- Les caractères spéciaux (%, _) sont du texte ordinaire.
  IF _f ? 'city' THEN
    IF jsonb_typeof(_f->'city') <> 'string'
       OR char_length(btrim(_f->>'city')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'city';
    END IF;
    _city := public.normalize_place(_f->>'city');
  END IF;

  -- Distance : rayon au choix parmi 5, 10, 25, 50, 100, 250 et 500 km, autour de la
  -- position enregistrée de la personne connectée (obligatoire : sinon refus
  -- `location_required`). Les profils sans position ne correspondent jamais.
  IF _f ? 'max_distance_km' THEN
    IF jsonb_typeof(_f->'max_distance_km') <> 'number'
       OR (_f->>'max_distance_km') NOT IN ('5', '10', '25', '50', '100', '250', '500') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_distance_km';
    END IF;
    _distance := (_f->>'max_distance_km')::int;
    SELECT l.latitude, l.longitude INTO _my_lat, _my_lng
    FROM public.profile_locations l WHERE l.user_id = _me;
    IF _my_lat IS NULL THEN
      RAISE EXCEPTION 'location_required' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Situation matrimoniale : liste (1 à 3 valeurs distinctes) parmi « never_married »,
  -- « divorced », « widowed » ; le profil doit avoir l'une d'elles.
  IF _f ? 'marital_status' THEN
    IF jsonb_typeof(_f->'marital_status') <> 'array'
       OR jsonb_array_length(_f->'marital_status') NOT BETWEEN 1 AND 3
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'marital_status') e
         WHERE jsonb_typeof(e) <> 'string' OR e #>> '{}' NOT IN ('never_married', 'divorced', 'widowed')
       )
       OR (SELECT count(DISTINCT e #>> '{}') FROM jsonb_array_elements(_f->'marital_status') e)
          <> jsonb_array_length(_f->'marital_status') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'marital_status';
    END IF;
    SELECT array_agg(e #>> '{}') INTO _marital FROM jsonb_array_elements(_f->'marital_status') e;
  END IF;

  -- Enfants : true (a des enfants) ou false (sans enfant) ; les profils non précisés ne
  -- correspondent jamais.
  IF _f ? 'has_children' THEN
    IF jsonb_typeof(_f->'has_children') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'has_children';
    END IF;
    _children := (_f->>'has_children')::boolean;
  END IF;

  -- Dénomination : texte de 1 à 100 caractères ; la dénomination du profil doit le
  -- contenir (forme normalisée : sans majuscules, accents, tirets ni apostrophes).
  IF _f ? 'denomination' THEN
    IF jsonb_typeof(_f->'denomination') <> 'string'
       OR char_length(btrim(_f->>'denomination')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'denomination';
    END IF;
    _denomination := public.normalize_place(_f->>'denomination');
  END IF;

  -- Engagement chrétien (« Votre pratique chrétienne » du profil) : même règle que la
  -- dénomination (texte de 1 à 100 caractères, contenu, forme normalisée).
  IF _f ? 'faith_commitment' THEN
    IF jsonb_typeof(_f->'faith_commitment') <> 'string'
       OR char_length(btrim(_f->>'faith_commitment')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'faith_commitment';
    END IF;
    _commitment := public.normalize_place(_f->>'faith_commitment');
  END IF;

  -- Objectif relationnel (« Ce que vous recherchez », préférences du membre) : texte de
  -- 1 à 100 caractères ; l'objectif du profil doit le contenir (forme normalisée).
  IF _f ? 'relationship_goal' THEN
    IF jsonb_typeof(_f->'relationship_goal') <> 'string'
       OR char_length(btrim(_f->>'relationship_goal')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'relationship_goal';
    END IF;
    _goal := public.normalize_place(_f->>'relationship_goal');
  END IF;

  -- Projet familial (préférences du membre) : texte de 1 à 200 caractères ; le projet du
  -- profil doit le contenir (forme normalisée).
  IF _f ? 'family_project' THEN
    IF jsonb_typeof(_f->'family_project') <> 'string'
       OR char_length(btrim(_f->>'family_project')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'family_project';
    END IF;
    _family := public.normalize_place(_f->>'family_project');
  END IF;

  -- Centres d'intérêt : liste de 1 à 5 textes (1 à 40 caractères chacun) ; le profil doit
  -- avoir au moins l'un d'eux (comparaison exacte sur la forme normalisée).
  IF _f ? 'interests' THEN
    IF jsonb_typeof(_f->'interests') <> 'array'
       OR jsonb_array_length(_f->'interests') NOT BETWEEN 1 AND 5
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'interests') e
         WHERE jsonb_typeof(e) <> 'string' OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 40
       ) THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'interests';
    END IF;
    SELECT array_agg(DISTINCT public.normalize_place(e #>> '{}')) INTO _interests
    FROM jsonb_array_elements(_f->'interests') e;
  END IF;

  -- Filtre avancé (Premium) « Actif récemment » : dernière activité il y a moins de 1, 7
  -- ou 30 jours.
  IF _f ? 'active_within_days' THEN
    IF jsonb_typeof(_f->'active_within_days') <> 'number'
       OR (_f->>'active_within_days') NOT IN ('1', '7', '30') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'active_within_days';
    END IF;
    _active_days := (_f->>'active_within_days')::int;
  END IF;

  -- Filtres avancés : réservés aux membres Premium (abonnement actif). Le refus arrive
  -- après la validation des valeurs et avant toute lecture de profil.
  IF _active_days IS NOT NULL AND NOT public.is_premium(_me) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501', DETAIL = 'active_within_days';
  END IF;

  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.birth_date, p.city, p.country, p.bio, p.gender, p.interests
  FROM public.profiles p
  WHERE p.user_id <> _me
    AND public.is_discoverable_profile(p.user_id)
    AND NOT public.is_blocked_between(_me, p.user_id)
    AND (_min IS NULL OR p.birth_date <= (current_date - make_interval(years => _min))::date)
    AND (_max IS NULL OR p.birth_date > (current_date - make_interval(years => _max + 1))::date)
    AND (_gender IS NULL OR p.gender = _gender)
    AND (_country IS NULL OR public.normalize_place(p.country) = _country)
    AND (_city IS NULL OR strpos(coalesce(public.normalize_place(p.city), ''), _city) > 0)
    AND (_marital IS NULL OR p.marital_status = ANY (_marital))
    AND (_children IS NULL OR p.has_children = _children)
    AND (_denomination IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.denomination), ''), _denomination) > 0
    ))
    AND (_commitment IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.faith_commitment), ''), _commitment) > 0
    ))
    AND (_goal IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.relationship_goal), ''), _goal) > 0
    ))
    AND (_family IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.family_project), ''), _family) > 0
    ))
    AND (_active_days IS NULL OR EXISTS (
      SELECT 1 FROM public.user_activity a
      WHERE a.user_id = p.user_id
        AND a.last_seen_at > now() - make_interval(days => _active_days)
    ))
    AND (_interests IS NULL OR EXISTS (
      SELECT 1 FROM unnest(p.interests) i WHERE public.normalize_place(i) = ANY (_interests)
    ))
    AND (_distance IS NULL OR EXISTS (
      SELECT 1 FROM public.profile_locations l
      WHERE l.user_id = p.user_id
        AND public.distance_km(_my_lat, _my_lng, l.latitude, l.longitude) <= _distance
    ))
    -- 20.3 : un membre qui masque son activité n'apparaît pas dans le filtre « actif depuis ».
    AND (_active_days IS NULL OR public.is_activity_visible(p.user_id))
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$_$;

CREATE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL::text, _flash boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.send_message(_conversation_id uuid, _content text) RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, content text, status public.message_status, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _uid uuid := auth.uid();
  _text text;
  _conv public.conversations%ROWTYPE;
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

  -- Étape 6.7 : un message contenant un numéro de téléphone est refusé avant toute
  -- écriture : rien n'est enregistré, le quota de messages gratuits n'est pas consommé.
  IF public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = 'P0001';
  END IF;

  -- Participant, conversation ouverte, Match actif, blocage, profils (verrou inclus).
  _conv := public.lock_conversation_for_sending(_uid, _conversation_id);

  -- Étape 7.9 : déblocage en cours = illimité. Étape 15.6 : Premium = illimité.
  -- Dans ces deux cas, le quota gratuit n'est ni vérifié ni consommé.
  IF NOT public.has_active_conversation_unlock(_conv.id) AND NOT public.is_premium(_uid) THEN
    INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
    VALUES (_conv.id, _uid, 0)
    ON CONFLICT ON CONSTRAINT conversation_user_usage_conversation_id_user_id_key DO NOTHING;
    -- Étape 5.5 : au-delà de 3 messages dans cette conversation, l'envoi est refusé.
    UPDATE public.conversation_user_usage u
       SET free_messages_used = u.free_messages_used + 1
     WHERE u.conversation_id = _conv.id AND u.user_id = _uid
       AND u.free_messages_used < 3;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'free_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, status, created_at)
  VALUES (_conv.id, _uid, _text, 'delivered', clock_timestamp())
  RETURNING * INTO _msg;

  UPDATE public.conversations c
     SET last_message_at = greatest(coalesce(c.last_message_at, _msg.created_at), _msg.created_at)
   WHERE c.id = _conv.id;

  RETURN QUERY SELECT _msg.id, _msg.conversation_id, _msg.sender_id, _msg.content, _msg.status, _msg.created_at;
END;
$_$;

CREATE FUNCTION public.send_voice_message(_conversation_id uuid, _audio_path text, _duration_seconds integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv public.conversations%ROWTYPE;
  _id uuid;
  _at timestamptz := clock_timestamp();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  IF _duration_seconds IS NULL OR _duration_seconds < 1 OR _duration_seconds > 120 THEN
    RAISE EXCEPTION 'voice_invalid_duration' USING ERRCODE = '22023';
  END IF;
  -- Le fichier doit être celui de l'expéditeur, dans le dossier de cette conversation.
  IF _audio_path IS NULL
     OR _audio_path NOT LIKE _conversation_id::text || '/' || _uid::text || '/%'
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'voice-messages' AND o.name = _audio_path
     )
     OR EXISTS (SELECT 1 FROM public.messages m WHERE m.audio_path = _audio_path)
  THEN
    RAISE EXCEPTION 'voice_file_invalid' USING ERRCODE = '22023';
  END IF;

  _conv := public.lock_conversation_for_sending(_uid, _conversation_id);

  INSERT INTO public.messages
    (conversation_id, sender_id, content, status, created_at, kind, audio_path, audio_duration_seconds)
  VALUES (_conv.id, _uid, 'Message vocal', 'delivered', _at, 'voice', _audio_path, _duration_seconds)
  RETURNING id INTO _id;

  UPDATE public.conversations c
     SET last_message_at = greatest(coalesce(c.last_message_at, _at), _at)
   WHERE c.id = _conv.id;
  RETURN _id;
END;
$$;

CREATE FUNCTION public.set_favorite_created_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_like_created_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.created_at := CASE WHEN TG_OP = 'INSERT' THEN now() ELSE OLD.created_at END;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.set_my_location(_latitude double precision, _longitude double precision) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _latitude IS NULL OR _longitude IS NULL
     OR _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180
     OR _latitude = 'NaN'::double precision OR _longitude = 'NaN'::double precision THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.profile_locations AS l (user_id, latitude, longitude, updated_at)
  VALUES (auth.uid(), round(_latitude::numeric, 2)::double precision,
          round(_longitude::numeric, 2)::double precision, now())
  ON CONFLICT (user_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now();
END;
$$;

CREATE FUNCTION public.set_primary_photo(_photo_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.photos WHERE id = _photo_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.photos SET is_primary = false WHERE user_id = _uid AND is_primary AND id <> _photo_id;
  UPDATE public.photos SET is_primary = true WHERE id = _photo_id;
END; $$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE FUNCTION public.start_conversation_unlock_payment(_conversation_id uuid, _provider text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.start_premium_payment(_plan public.subscription_plan, _provider text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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

CREATE FUNCTION public.text_items_max_length(_items text[], _max integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(bool_and(char_length(item) BETWEEN 1 AND _max), true) FROM unnest(_items) AS item
$$;

CREATE FUNCTION public.touch_activity() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user uuid := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_account(_user) THEN
    RETURN false;
  END IF;

  -- Déjà à jour : aucune écriture.
  IF EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = _user AND a.is_online AND a.last_seen_at > now() - interval '30 seconds'
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.user_activity AS a (user_id, last_seen_at, is_online)
  VALUES (_user, now(), true)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now(), is_online = true;

  UPDATE public.users SET last_active_at = now() WHERE id = _user;
  RETURN true;
END;
$$;

CREATE FUNCTION public.unblock_user(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = _user_id;
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.utc_day_start() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT date_trunc('day', now(), 'UTC')
$$;

CREATE FUNCTION public.wants_notification(_user_id uuid, _type text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE _type
    WHEN 'message' THEN coalesce(s.notify_messages, true)
    WHEN 'match' THEN coalesce(s.notify_matches, true)
    WHEN 'like' THEN coalesce(s.notify_likes, true)
    ELSE true
  END
  FROM (SELECT 1) one
  LEFT JOIN public.user_settings s ON s.user_id = _user_id
$$;

-- ============================================================================
-- 7. Tables
-- ============================================================================

CREATE TABLE public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature text DEFAULT 'roi_salomon'::text NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_count_positive CHECK ((usage_count >= 0))
);

CREATE TABLE public.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_no_self CHECK ((blocker_id <> blocked_id))
);

CREATE TABLE public.christian_profiles (
    user_id uuid NOT NULL,
    denomination text,
    faith_commitment text,
    church_attendance text,
    prayer_practice text,
    faith_importance text,
    marriage_vision text,
    couple_vision text,
    christian_values text[] DEFAULT '{}'::text[] NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT christian_church_attendance_length CHECK (((church_attendance IS NULL) OR (char_length(church_attendance) <= 100))),
    CONSTRAINT christian_couple_vision_length CHECK (((couple_vision IS NULL) OR (char_length(couple_vision) <= 1000))),
    CONSTRAINT christian_denomination_length CHECK (((denomination IS NULL) OR (char_length(denomination) <= 100))),
    CONSTRAINT christian_faith_commitment_length CHECK (((faith_commitment IS NULL) OR (char_length(faith_commitment) <= 100))),
    CONSTRAINT christian_faith_importance_length CHECK (((faith_importance IS NULL) OR (char_length(faith_importance) <= 100))),
    CONSTRAINT christian_marriage_vision_length CHECK (((marriage_vision IS NULL) OR (char_length(marriage_vision) <= 1000))),
    CONSTRAINT christian_prayer_practice_length CHECK (((prayer_practice IS NULL) OR (char_length(prayer_practice) <= 100))),
    CONSTRAINT christian_values_count CHECK ((cardinality(christian_values) <= 10)),
    CONSTRAINT christian_values_item_length CHECK (public.text_items_max_length(christian_values, 40))
);

CREATE TABLE public.contact_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    is_flash boolean DEFAULT false NOT NULL,
    CONSTRAINT contact_requests_message_length CHECK (((message IS NULL) OR ((char_length(message) >= 1) AND (char_length(message) <= 300)))),
    CONSTRAINT contact_requests_no_self CHECK ((sender_id <> receiver_id)),
    CONSTRAINT contact_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])))
);

CREATE TABLE public.conversation_reads (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.conversation_unlocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    paid_by_user_id uuid NOT NULL,
    amount integer DEFAULT 100 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    status public.unlock_status DEFAULT 'pending'::public.unlock_status NOT NULL,
    payment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unlocks_period CHECK (((expires_at IS NULL) OR (starts_at IS NULL) OR (expires_at > starts_at)))
);

CREATE TABLE public.conversation_user_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    free_messages_used smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_user_usage_range CHECK (((free_messages_used >= 0) AND (free_messages_used <= 3)))
);

CREATE TABLE public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    favorite_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorites_no_self CHECK ((user_id <> favorite_user_id))
);

CREATE TABLE public.geo_countries (
    code text NOT NULL,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL
);

CREATE TABLE public.likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    kind public.like_kind DEFAULT 'like'::public.like_kind NOT NULL,
    status public.like_status DEFAULT 'active'::public.like_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT likes_no_self CHECK ((sender_id <> receiver_id))
);

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_1_id uuid NOT NULL,
    user_2_id uuid NOT NULL,
    status public.match_status DEFAULT 'active'::public.match_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT matches_ordered_pair CHECK ((user_1_id < user_2_id))
);

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    status public.message_status DEFAULT 'delivered'::public.message_status NOT NULL,
    moderation_status public.moderation_status DEFAULT 'clean'::public.moderation_status NOT NULL,
    moderation_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    contains_phone_number boolean DEFAULT false NOT NULL,
    blocked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'text'::text NOT NULL,
    audio_path text,
    audio_duration_seconds integer,
    CONSTRAINT messages_content_length CHECK (((char_length(content) >= 1) AND (char_length(content) <= 4000))),
    CONSTRAINT messages_kind_valid CHECK ((((kind = 'text'::text) AND (audio_path IS NULL) AND (audio_duration_seconds IS NULL)) OR ((kind = 'voice'::text) AND (audio_path IS NOT NULL) AND ((audio_duration_seconds >= 1) AND (audio_duration_seconds <= 120))))),
    CONSTRAINT messages_no_phone_number_delivered CHECK ((NOT ((status = 'delivered'::public.message_status) AND contains_phone_number)))
);

CREATE TABLE public.moderation_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    action public.moderation_action_type NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    actor_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['like'::text, 'match'::text, 'message'::text, 'favorite'::text, 'visit'::text, 'contact_request'::text])))
);

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.payment_type NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    provider text NOT NULL,
    provider_transaction_id text,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_positive CHECK ((amount > 0))
);

CREATE TABLE public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    status public.photo_status DEFAULT 'pending'::public.photo_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photos_path_in_owner_folder CHECK ((split_part(storage_path, '/'::text, 1) = (user_id)::text))
);

CREATE TABLE public.preferences (
    user_id uuid NOT NULL,
    min_age smallint DEFAULT 18 NOT NULL,
    max_age smallint DEFAULT 60 NOT NULL,
    preferred_gender public.gender,
    city text,
    country text,
    max_distance_km integer,
    relationship_goal text,
    family_project text,
    christian_criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT preferences_age_range CHECK (((min_age >= 18) AND (max_age >= min_age) AND (max_age <= 99))),
    CONSTRAINT preferences_family_project_length CHECK (((family_project IS NULL) OR (char_length(family_project) <= 200))),
    CONSTRAINT preferences_relationship_goal_length CHECK (((relationship_goal IS NULL) OR (char_length(relationship_goal) <= 100)))
);

CREATE TABLE public.profile_boosts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_boosts_period CHECK ((expires_at > starts_at))
);

CREATE TABLE public.profile_locations (
    user_id uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_locations_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT profile_locations_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))
);

CREATE TABLE public.profile_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    method text NOT NULL,
    storage_path text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT profile_verifications_method_check CHECK ((method = ANY (ARRAY['selfie'::text, 'id_document'::text]))),
    CONSTRAINT profile_verifications_path_owner CHECK ((split_part(storage_path, '/'::text, 1) = (user_id)::text)),
    CONSTRAINT profile_verifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

CREATE TABLE public.profile_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id uuid NOT NULL,
    visited_user_id uuid NOT NULL,
    visited_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_visits_no_self CHECK ((visitor_id <> visited_user_id))
);

CREATE TABLE public.profiles (
    user_id uuid NOT NULL,
    first_name text,
    birth_date date,
    gender public.gender,
    city text,
    country text,
    latitude double precision,
    longitude double precision,
    profession text,
    education_level text,
    marital_status text,
    has_children boolean,
    children_count smallint,
    bio text,
    personality jsonb DEFAULT '{}'::jsonb NOT NULL,
    interests text[] DEFAULT '{}'::text[] NOT NULL,
    status public.profile_status DEFAULT 'incomplete'::public.profile_status NOT NULL,
    visibility public.profile_visibility DEFAULT 'visible'::public.profile_visibility NOT NULL,
    onboarding_step smallint DEFAULT 0 NOT NULL,
    onboarding_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    region text,
    origin text,
    terms_accepted_at timestamp with time zone,
    is_virtual boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    CONSTRAINT profiles_bio_length CHECK (((bio IS NULL) OR (char_length(bio) <= 2000))),
    CONSTRAINT profiles_children_check CHECK (((children_count IS NULL) OR ((has_children IS TRUE) AND ((children_count >= 1) AND (children_count <= 20))))),
    CONSTRAINT profiles_city_length CHECK (((city IS NULL) OR (char_length(city) <= 100))),
    CONSTRAINT profiles_country_length CHECK (((country IS NULL) OR (char_length(country) <= 100))),
    CONSTRAINT profiles_first_name_length CHECK (((first_name IS NULL) OR ((char_length(first_name) >= 1) AND (char_length(first_name) <= 60)))),
    CONSTRAINT profiles_interests_count CHECK ((cardinality(interests) <= 10)),
    CONSTRAINT profiles_interests_item_length CHECK (public.text_items_max_length(interests, 40)),
    CONSTRAINT profiles_marital_status_check CHECK (((marital_status IS NULL) OR (marital_status = ANY (ARRAY['never_married'::text, 'divorced'::text, 'widowed'::text])))),
    CONSTRAINT profiles_origin_length CHECK (((origin IS NULL) OR (char_length(origin) <= 60))),
    CONSTRAINT profiles_profession_length CHECK (((profession IS NULL) OR (char_length(profession) <= 100))),
    CONSTRAINT profiles_region_length CHECK (((region IS NULL) OR (char_length(region) <= 100)))
);

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    conversation_id uuid,
    message_id uuid,
    reason public.report_reason NOT NULL,
    description text,
    status public.report_status DEFAULT 'open'::public.report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reports_description_length CHECK (((description IS NULL) OR (char_length(description) <= 2000))),
    CONSTRAINT reports_no_self CHECK ((reporter_id <> reported_user_id))
);

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan public.subscription_plan DEFAULT 'premium_monthly'::public.subscription_plan NOT NULL,
    amount integer DEFAULT 500 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status public.subscription_status DEFAULT 'pending'::public.subscription_status NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    payment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_period CHECK (((expires_at IS NULL) OR (starts_at IS NULL) OR (expires_at > starts_at)))
);

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    admin_reply text,
    answered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_tickets_admin_reply_check CHECK (((admin_reply IS NULL) OR (char_length(admin_reply) <= 4000))),
    CONSTRAINT support_tickets_message_check CHECK (((char_length(message) >= 10) AND (char_length(message) <= 4000))),
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'priority'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text]))),
    CONSTRAINT support_tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 120)))
);

CREATE TABLE public.user_activity (
    user_id uuid NOT NULL,
    last_login_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    is_online boolean DEFAULT false NOT NULL,
    login_count integer DEFAULT 0 NOT NULL,
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.user_settings (
    user_id uuid NOT NULL,
    activity_visible boolean DEFAULT true NOT NULL,
    notify_email boolean DEFAULT true NOT NULL,
    notify_messages boolean DEFAULT true NOT NULL,
    notify_matches boolean DEFAULT true NOT NULL,
    notify_likes boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    marketing_emails boolean DEFAULT false NOT NULL
);

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.virtual_profile_removals (
    user_id uuid NOT NULL,
    removed_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================================
-- 8. Clés primaires et valeurs uniques
-- ============================================================================

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_feature_usage_date_key UNIQUE (user_id, feature, usage_date);

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.christian_profiles
    ADD CONSTRAINT christian_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversation_reads
    ADD CONSTRAINT conversation_reads_pkey PRIMARY KEY (conversation_id, user_id);

ALTER TABLE ONLY public.conversation_unlocks
    ADD CONSTRAINT conversation_unlocks_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversation_user_usage
    ADD CONSTRAINT conversation_user_usage_conversation_id_user_id_key UNIQUE (conversation_id, user_id);

ALTER TABLE ONLY public.conversation_user_usage
    ADD CONSTRAINT conversation_user_usage_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_match_id_key UNIQUE (match_id);

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_favorite_user_id_key UNIQUE (user_id, favorite_user_id);

ALTER TABLE ONLY public.geo_countries
    ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (code);

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user_1_id_user_2_id_key UNIQUE (user_1_id, user_2_id);

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.moderation_actions
    ADD CONSTRAINT moderation_actions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_user_id_storage_path_key UNIQUE (user_id, storage_path);

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.profile_boosts
    ADD CONSTRAINT profile_boosts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profile_locations
    ADD CONSTRAINT profile_locations_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.profile_verifications
    ADD CONSTRAINT profile_verifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profile_visits
    ADD CONSTRAINT profile_visits_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.virtual_profile_removals
    ADD CONSTRAINT virtual_profile_removals_pkey PRIMARY KEY (user_id);

-- ============================================================================
-- 9. Index : recherches rapides
-- ============================================================================

CREATE INDEX ai_usage_feature_date_idx ON public.ai_usage USING btree (feature, usage_date);

CREATE INDEX ai_usage_user_idx ON public.ai_usage USING btree (user_id);

CREATE INDEX blocks_blocked_idx ON public.blocks USING btree (blocked_id);

CREATE UNIQUE INDEX contact_requests_one_pending ON public.contact_requests USING btree (sender_id, receiver_id) WHERE (status = 'pending'::text);

CREATE INDEX contact_requests_receiver_idx ON public.contact_requests USING btree (receiver_id, created_at DESC);

CREATE INDEX contact_requests_sender_day_idx ON public.contact_requests USING btree (sender_id, created_at);

CREATE INDEX contact_requests_sender_idx ON public.contact_requests USING btree (sender_id, created_at DESC);

CREATE UNIQUE INDEX conversation_unlocks_payment_unique ON public.conversation_unlocks USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE INDEX conversation_user_usage_conversation_idx ON public.conversation_user_usage USING btree (conversation_id);

CREATE INDEX conversation_user_usage_user_idx ON public.conversation_user_usage USING btree (user_id);

CREATE INDEX conversations_user_1_idx ON public.conversations USING btree (user_1_id, last_message_at DESC);

CREATE INDEX conversations_user_2_idx ON public.conversations USING btree (user_2_id, last_message_at DESC);

CREATE INDEX favorites_favorite_user_idx ON public.favorites USING btree (favorite_user_id);

CREATE INDEX favorites_user_idx ON public.favorites USING btree (user_id);

CREATE INDEX geo_countries_name_idx ON public.geo_countries USING btree (lower(name));

CREATE INDEX likes_receiver_idx ON public.likes USING btree (receiver_id, kind, status);

CREATE INDEX matches_user_2_idx ON public.matches USING btree (user_2_id);

CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);

CREATE INDEX moderation_actions_target_idx ON public.moderation_actions USING btree (target_user_id, created_at DESC);

CREATE INDEX notifications_unread_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL);

CREATE INDEX notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX payments_provider_tx_idx ON public.payments USING btree (provider, provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);

CREATE INDEX payments_user_idx ON public.payments USING btree (user_id, created_at DESC);

CREATE UNIQUE INDEX photos_one_primary_idx ON public.photos USING btree (user_id) WHERE is_primary;

CREATE INDEX photos_user_idx ON public.photos USING btree (user_id, "position");

CREATE INDEX profile_boosts_user_idx ON public.profile_boosts USING btree (user_id, expires_at DESC);

CREATE INDEX profile_verifications_pending_idx ON public.profile_verifications USING btree (created_at) WHERE (status = 'pending'::text);

CREATE INDEX profile_verifications_user_idx ON public.profile_verifications USING btree (user_id, created_at DESC);

CREATE INDEX profile_visits_pair_recent_idx ON public.profile_visits USING btree (visitor_id, visited_user_id, visited_at DESC);

CREATE INDEX profile_visits_visited_at_idx ON public.profile_visits USING btree (visited_at DESC);

CREATE INDEX profile_visits_visited_idx ON public.profile_visits USING btree (visited_user_id);

CREATE INDEX profile_visits_visitor_idx ON public.profile_visits USING btree (visitor_id);

CREATE INDEX profiles_discovery_idx ON public.profiles USING btree (status, visibility, gender, city);

CREATE INDEX profiles_virtual_country_idx ON public.profiles USING btree (lower(btrim(country))) WHERE is_virtual;

CREATE INDEX reports_status_idx ON public.reports USING btree (status, created_at DESC);

CREATE UNIQUE INDEX subscriptions_payment_unique ON public.subscriptions USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE INDEX subscriptions_user_idx ON public.subscriptions USING btree (user_id, status, expires_at DESC);

CREATE INDEX support_tickets_queue_idx ON public.support_tickets USING btree (status, priority DESC, created_at);

CREATE INDEX support_tickets_user_idx ON public.support_tickets USING btree (user_id, created_at DESC);

CREATE INDEX unlocks_conversation_idx ON public.conversation_unlocks USING btree (conversation_id, status, expires_at DESC);

-- ============================================================================
-- 10. Déclencheurs : actions automatiques à chaque ajout ou modification
-- ============================================================================

CREATE TRIGGER ai_usage_updated_at BEFORE UPDATE ON public.ai_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER christian_profiles_updated_at BEFORE UPDATE ON public.christian_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER contact_requests_notify AFTER INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();

CREATE TRIGGER conversation_user_usage_updated_at BEFORE UPDATE ON public.conversation_user_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER conversations_init_usage AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.init_conversation_usage();

CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER favorites_notify AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.notify_favorite();

CREATE TRIGGER favorites_refuse_blocked BEFORE INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

CREATE TRIGGER favorites_set_created_at BEFORE INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.set_favorite_created_at();

CREATE TRIGGER likes_create_match AFTER INSERT OR UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();

CREATE TRIGGER likes_notify AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_like();

CREATE TRIGGER likes_protect_parties BEFORE UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.protect_like_parties();

CREATE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

CREATE TRIGGER likes_set_created_at BEFORE INSERT OR UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.set_like_created_at();

CREATE TRIGGER matches_create_conversation AFTER INSERT OR UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_match();

CREATE TRIGGER matches_notify AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.notify_match();

CREATE TRIGGER messages_block_phone_numbers BEFORE INSERT OR UPDATE OF content, status, contains_phone_number ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_block_phone_numbers();

CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_message();

CREATE TRIGGER payments_activate_conversation_unlock AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.activate_conversation_unlock();

CREATE TRIGGER payments_activate_premium AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.activate_premium_subscription();

CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER photos_enforce_limit BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_limit();

CREATE TRIGGER photos_promote_primary_on_delete AFTER DELETE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.photos_after_delete();

CREATE TRIGGER photos_protect_status BEFORE INSERT OR UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.protect_photo_status();

CREATE TRIGGER photos_set_primary_on_insert BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION public.photos_before_insert();

CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON public.preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profile_visits_notify AFTER INSERT ON public.profile_visits FOR EACH ROW EXECUTE FUNCTION public.notify_visit();

CREATE TRIGGER profile_visits_refuse_blocked BEFORE INSERT ON public.profile_visits FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

CREATE TRIGGER profiles_check_personal_info BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_personal_info();

CREATE TRIGGER profiles_check_visibility BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_visibility();

CREATE TRIGGER profiles_no_coordinates BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.clear_profile_coordinates();

CREATE TRIGGER profiles_protect_server_fields BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_server_profile_fields();

CREATE TRIGGER profiles_protect_status BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();

CREATE TRIGGER profiles_protect_terms BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_terms_accepted_at();

CREATE TRIGGER profiles_replace_virtual AFTER UPDATE OF onboarding_completed_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.replace_virtual_profile_on_signup();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_activity_updated_at BEFORE UPDATE ON public.user_activity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER users_protect_columns BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 11. Liens entre les tables (clés étrangères)
-- ============================================================================

ALTER TABLE ONLY public.ai_usage
    ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.blocks
    ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.christian_profiles
    ADD CONSTRAINT christian_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.contact_requests
    ADD CONSTRAINT contact_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_reads
    ADD CONSTRAINT conversation_reads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_reads
    ADD CONSTRAINT conversation_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_unlocks
    ADD CONSTRAINT conversation_unlocks_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_unlocks
    ADD CONSTRAINT conversation_unlocks_paid_by_user_id_fkey FOREIGN KEY (paid_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_unlocks
    ADD CONSTRAINT conversation_unlocks_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.conversation_user_usage
    ADD CONSTRAINT conversation_user_usage_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversation_user_usage
    ADD CONSTRAINT conversation_user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_1_id_fkey FOREIGN KEY (user_1_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_2_id_fkey FOREIGN KEY (user_2_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_favorite_user_id_fkey FOREIGN KEY (favorite_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.likes
    ADD CONSTRAINT likes_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user_1_id_fkey FOREIGN KEY (user_1_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_user_2_id_fkey FOREIGN KEY (user_2_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.moderation_actions
    ADD CONSTRAINT moderation_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.moderation_actions
    ADD CONSTRAINT moderation_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.photos
    ADD CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.preferences
    ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_boosts
    ADD CONSTRAINT profile_boosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_locations
    ADD CONSTRAINT profile_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_verifications
    ADD CONSTRAINT profile_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profile_verifications
    ADD CONSTRAINT profile_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_visits
    ADD CONSTRAINT profile_visits_visited_user_id_fkey FOREIGN KEY (visited_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profile_visits
    ADD CONSTRAINT profile_visits_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_settings
    ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.virtual_profile_removals
    ADD CONSTRAINT virtual_profile_removals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 12. Sécurité par ligne (RLS) : activée sur toutes les tables
-- ============================================================================

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.christian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_profile_removals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. Règles d'accès : qui peut lire ou modifier quelles lignes
-- ============================================================================

-- ai_usage
CREATE POLICY ai_usage_select_admin ON public.ai_usage FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY ai_usage_select_own ON public.ai_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- blocks
CREATE POLICY blocks_delete_own ON public.blocks FOR DELETE TO authenticated USING ((blocker_id = auth.uid()));

CREATE POLICY blocks_insert_own ON public.blocks FOR INSERT TO authenticated WITH CHECK ((blocker_id = auth.uid()));

CREATE POLICY blocks_select_admin ON public.blocks FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY blocks_select_own ON public.blocks FOR SELECT TO authenticated USING ((blocker_id = auth.uid()));

-- christian_profiles
CREATE POLICY christian_select_admin ON public.christian_profiles FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY christian_select_own ON public.christian_profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY christian_select_visible ON public.christian_profiles FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_discoverable_profile(user_id)));

CREATE POLICY christian_update_own ON public.christian_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- contact_requests
CREATE POLICY contact_requests_select_parties ON public.contact_requests FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (receiver_id = auth.uid())));

-- conversation_reads
CREATE POLICY conversation_reads_select_own ON public.conversation_reads FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- conversation_unlocks
CREATE POLICY unlocks_select_admin ON public.conversation_unlocks FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY unlocks_select_participant ON public.conversation_unlocks FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id, auth.uid()));

-- conversation_user_usage
CREATE POLICY cuu_select_admin ON public.conversation_user_usage FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY cuu_select_own ON public.conversation_user_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- conversations
CREATE POLICY conversations_select_admin ON public.conversations FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT TO authenticated USING (((auth.uid() = user_1_id) OR (auth.uid() = user_2_id)));

-- favorites
CREATE POLICY favorites_delete_own ON public.favorites FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY favorites_insert_own ON public.favorites FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (user_id <> favorite_user_id) AND (NOT public.is_blocked_between(user_id, favorite_user_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(favorite_user_id)));

CREATE POLICY favorites_select_admin ON public.favorites FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY favorites_select_own ON public.favorites FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- likes
CREATE POLICY likes_insert_own ON public.likes FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (sender_id <> receiver_id) AND (NOT public.is_blocked_between(sender_id, receiver_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(receiver_id)));

CREATE POLICY likes_select_admin ON public.likes FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY likes_select_sent ON public.likes FOR SELECT TO authenticated USING ((sender_id = auth.uid()));

CREATE POLICY likes_update_own ON public.likes FOR UPDATE TO authenticated USING ((sender_id = auth.uid())) WITH CHECK (((sender_id = auth.uid()) AND ((status = 'withdrawn'::public.like_status) OR ((NOT public.is_blocked_between(sender_id, receiver_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(receiver_id)))));

-- matches
CREATE POLICY matches_select_admin ON public.matches FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY matches_select_participant ON public.matches FOR SELECT TO authenticated USING (((auth.uid() = user_1_id) OR (auth.uid() = user_2_id)));

-- messages
CREATE POLICY messages_select_admin ON public.messages FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY messages_select_own_blocked ON public.messages FOR SELECT TO authenticated USING ((sender_id = auth.uid()));

CREATE POLICY messages_select_participant ON public.messages FOR SELECT TO authenticated USING (((status = 'delivered'::public.message_status) AND public.is_conversation_participant(conversation_id, auth.uid())));

-- moderation_actions
CREATE POLICY moderation_insert_admin ON public.moderation_actions FOR INSERT TO authenticated WITH CHECK ((public.is_admin() AND (admin_id = auth.uid())));

CREATE POLICY moderation_select_admin ON public.moderation_actions FOR SELECT TO authenticated USING (public.is_admin());

-- notifications
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- payments
CREATE POLICY payments_select_admin ON public.payments FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY payments_select_own ON public.payments FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- photos
CREATE POLICY photos_delete_admin ON public.photos FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY photos_delete_own ON public.photos FOR DELETE TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY photos_insert_own ON public.photos FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY photos_select_admin ON public.photos FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY photos_select_own ON public.photos FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY photos_select_visible ON public.photos FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND (status = 'approved'::public.photo_status) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_discoverable_profile(user_id)));

CREATE POLICY photos_update_admin ON public.photos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY photos_update_own ON public.photos FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- preferences
CREATE POLICY preferences_select_admin ON public.preferences FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY preferences_select_own ON public.preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY preferences_update_own ON public.preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- profile_boosts
CREATE POLICY profile_boosts_select_own ON public.profile_boosts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));

-- profile_locations
CREATE POLICY profile_locations_select_own ON public.profile_locations FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- profile_verifications
CREATE POLICY verifications_insert_own ON public.profile_verifications FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (split_part(storage_path, '/'::text, 1) = (auth.uid())::text)));

CREATE POLICY verifications_select_own ON public.profile_verifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- profile_visits
CREATE POLICY profile_visits_select_admin ON public.profile_visits FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY profile_visits_select_own_visits ON public.profile_visits FOR SELECT TO authenticated USING ((visitor_id = auth.uid()));

-- profiles
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND (status = 'active'::public.profile_status) AND (visibility = 'visible'::public.profile_visibility) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_active_account(user_id)));

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- reports
CREATE POLICY reports_select_admin ON public.reports FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY reports_select_own ON public.reports FOR SELECT TO authenticated USING ((reporter_id = auth.uid()));

CREATE POLICY reports_update_admin ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- subscriptions
CREATE POLICY subscriptions_select_admin ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- support_tickets
CREATE POLICY support_tickets_select_own ON public.support_tickets FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));

-- user_activity
CREATE POLICY activity_select_admin ON public.user_activity FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY activity_select_own ON public.user_activity FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- user_roles
CREATE POLICY user_roles_select_admin ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

-- user_settings
CREATE POLICY user_settings_insert_own ON public.user_settings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

CREATE POLICY user_settings_select_own ON public.user_settings FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY user_settings_update_own ON public.user_settings FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- users
CREATE POLICY users_select_admin ON public.users FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));

CREATE POLICY users_update_admin ON public.users FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY users_update_own ON public.users FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

-- ============================================================================
-- 14. Droits d'accès : écrits un par un (aucun droit automatique)
-- ============================================================================

-- Chaque objet reçoit exactement les droits voulus. Les tables restent en plus
-- filtrées ligne par ligne par les règles d'accès ci-dessus.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 12 tables — membres connectés : lecture · serveur du site : tout
REVOKE ALL ON TABLE
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.user_activity
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.user_activity
TO service_role;
GRANT SELECT ON TABLE
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.user_activity
TO authenticated;

-- 11 tables — membres connectés : lecture, ajout, modification, suppression · serveur du site : tout
REVOKE ALL ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
TO authenticated;

-- 3 tables — visiteurs : lecture, vidage, références, déclencheurs · membres connectés : lecture, vidage, références, déclencheurs · serveur du site : tout
REVOKE ALL ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
TO service_role;
GRANT SELECT, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
TO anon, authenticated;

-- 2 tables — serveur du site : tout
REVOKE ALL ON TABLE
  public.geo_countries,
  public.virtual_profile_removals
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.geo_countries,
  public.virtual_profile_removals
TO service_role;

-- 1 tables — visiteurs : tout · membres connectés : tout · serveur du site : tout
REVOKE ALL ON TABLE
  public.profile_verifications
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.profile_verifications
TO anon, authenticated, service_role;

-- 1 tables — visiteurs : lecture, ajout, modification, vidage, références, déclencheurs · membres connectés : lecture, ajout, modification, vidage, références, déclencheurs · serveur du site : tout
REVOKE ALL ON TABLE
  public.user_settings
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.user_settings
TO service_role;
GRANT SELECT, INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.user_settings
TO anon, authenticated;

-- 1 tables — membres connectés : lecture, ajout, suppression · serveur du site : tout
REVOKE ALL ON TABLE
  public.favorites
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.favorites
TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE
  public.favorites
TO authenticated;

-- 76 fonctions — membres connectés : exécution · serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.activate_profile_boost(),
  public.admin_list_payments(),
  public.admin_list_pending_photos(),
  public.admin_list_pending_verifications(),
  public.admin_list_reports(text),
  public.admin_list_subscriptions(),
  public.admin_list_support_tickets(),
  public.admin_list_unlocks(),
  public.admin_list_users(text,text,integer,integer),
  public.admin_moderate_photo(uuid,boolean,text),
  public.admin_reply_support_ticket(uuid,text,boolean),
  public.admin_resolve_report(uuid,text,text),
  public.admin_review_verification(uuid,boolean),
  public.admin_set_user_status(uuid,text,text),
  public.admin_stats(),
  public.admin_user_detail(uuid),
  public.assert_admin(),
  public.block_user(uuid),
  public.can_browse_profiles(),
  public.can_view_profile(uuid),
  public.cancel_contact_request(uuid),
  public.clear_my_location(),
  public.consume_ai_quota(text),
  public.create_support_ticket(text,text),
  public.discover_profiles(integer),
  public.distance_km(double precision,double precision,double precision,double precision),
  public.get_ai_quota(text),
  public.get_compatibility(uuid),
  public.get_compatibility_scores(uuid[]),
  public.get_contact_request_quota(),
  public.get_conversation_quota(uuid),
  public.get_favorited_by(),
  public.get_message_quota(uuid),
  public.get_my_boost(),
  public.get_my_premium(),
  public.get_premium_badges(uuid[]),
  public.get_presence(uuid),
  public.get_profile_visitors(),
  public.get_unread_counts(),
  public.get_unread_notification_count(),
  public.has_active_conversation_unlock(uuid),
  public.has_mutual_like(uuid),
  public.has_role(uuid,public.app_role),
  public.is_active_account(uuid),
  public.is_activity_visible(uuid),
  public.is_admin(),
  public.is_blocked_between(uuid,uuid),
  public.is_boosted(uuid),
  public.is_conversation_folder_participant(text),
  public.is_conversation_participant(uuid,uuid),
  public.is_discoverable_profile(uuid),
  public.is_premium(uuid),
  public.list_blocked_users(),
  public.list_contact_requests(text),
  public.list_notifications(integer),
  public.list_search_cities(text),
  public.list_search_countries(),
  public.list_search_values(text),
  public.mark_all_notifications_read(),
  public.mark_conversation_read(uuid),
  public.mark_notification_read(uuid),
  public.mark_offline(),
  public.normalize_place(text),
  public.record_profile_visit(uuid),
  public.report_user(uuid,public.report_reason,text,uuid),
  public.respond_contact_request(uuid,boolean),
  public.search_profiles(jsonb,integer),
  public.send_contact_request(uuid,text,boolean),
  public.send_message(uuid,text),
  public.send_voice_message(uuid,text,integer),
  public.set_my_location(double precision,double precision),
  public.set_primary_photo(uuid),
  public.start_conversation_unlock_payment(uuid,text),
  public.start_premium_payment(public.subscription_plan,text),
  public.touch_activity(),
  public.unblock_user(uuid)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.activate_profile_boost(),
  public.admin_list_payments(),
  public.admin_list_pending_photos(),
  public.admin_list_pending_verifications(),
  public.admin_list_reports(text),
  public.admin_list_subscriptions(),
  public.admin_list_support_tickets(),
  public.admin_list_unlocks(),
  public.admin_list_users(text,text,integer,integer),
  public.admin_moderate_photo(uuid,boolean,text),
  public.admin_reply_support_ticket(uuid,text,boolean),
  public.admin_resolve_report(uuid,text,text),
  public.admin_review_verification(uuid,boolean),
  public.admin_set_user_status(uuid,text,text),
  public.admin_stats(),
  public.admin_user_detail(uuid),
  public.assert_admin(),
  public.block_user(uuid),
  public.can_browse_profiles(),
  public.can_view_profile(uuid),
  public.cancel_contact_request(uuid),
  public.clear_my_location(),
  public.consume_ai_quota(text),
  public.create_support_ticket(text,text),
  public.discover_profiles(integer),
  public.distance_km(double precision,double precision,double precision,double precision),
  public.get_ai_quota(text),
  public.get_compatibility(uuid),
  public.get_compatibility_scores(uuid[]),
  public.get_contact_request_quota(),
  public.get_conversation_quota(uuid),
  public.get_favorited_by(),
  public.get_message_quota(uuid),
  public.get_my_boost(),
  public.get_my_premium(),
  public.get_premium_badges(uuid[]),
  public.get_presence(uuid),
  public.get_profile_visitors(),
  public.get_unread_counts(),
  public.get_unread_notification_count(),
  public.has_active_conversation_unlock(uuid),
  public.has_mutual_like(uuid),
  public.has_role(uuid,public.app_role),
  public.is_active_account(uuid),
  public.is_activity_visible(uuid),
  public.is_admin(),
  public.is_blocked_between(uuid,uuid),
  public.is_boosted(uuid),
  public.is_conversation_folder_participant(text),
  public.is_conversation_participant(uuid,uuid),
  public.is_discoverable_profile(uuid),
  public.is_premium(uuid),
  public.list_blocked_users(),
  public.list_contact_requests(text),
  public.list_notifications(integer),
  public.list_search_cities(text),
  public.list_search_countries(),
  public.list_search_values(text),
  public.mark_all_notifications_read(),
  public.mark_conversation_read(uuid),
  public.mark_notification_read(uuid),
  public.mark_offline(),
  public.normalize_place(text),
  public.record_profile_visit(uuid),
  public.report_user(uuid,public.report_reason,text,uuid),
  public.respond_contact_request(uuid,boolean),
  public.search_profiles(jsonb,integer),
  public.send_contact_request(uuid,text,boolean),
  public.send_message(uuid,text),
  public.send_voice_message(uuid,text,integer),
  public.set_my_location(double precision,double precision),
  public.set_primary_photo(uuid),
  public.start_conversation_unlock_payment(uuid,text),
  public.start_premium_payment(public.subscription_plan,text),
  public.touch_activity(),
  public.unblock_user(uuid)
TO authenticated, service_role;

-- 40 fonctions — serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.activate_conversation_unlock(),
  public.activate_premium_subscription(),
  public.check_profile_personal_info(),
  public.check_profile_visibility(),
  public.compatibility_breakdown(uuid,uuid),
  public.confirm_payment(uuid,text,text,integer,text),
  public.consume_free_message(uuid),
  public.contains_phone_number(text),
  public.create_conversation_for_match(),
  public.create_match_on_mutual_like(),
  public.create_notification(uuid,text,uuid,jsonb,text),
  public.enforce_photo_limit(),
  public.expire_conversation_unlocks(),
  public.expire_subscriptions(),
  public.handle_new_user(),
  public.init_conversation_usage(),
  public.lock_conversation_for_sending(uuid,uuid),
  public.messages_block_phone_numbers(),
  public.notify_contact_request(),
  public.notify_favorite(),
  public.notify_like(),
  public.notify_match(),
  public.notify_message(),
  public.notify_visit(),
  public.photos_after_delete(),
  public.photos_before_insert(),
  public.protect_like_parties(),
  public.protect_photo_status(),
  public.protect_profile_status(),
  public.protect_server_profile_fields(),
  public.protect_terms_accepted_at(),
  public.protect_user_columns(),
  public.recent_signups(),
  public.refund_ai_quota(uuid,text),
  public.refuse_blocked_interaction(),
  public.remove_one_virtual_profile(text,public.gender),
  public.replace_virtual_profile_on_signup(),
  public.set_like_created_at(),
  public.set_updated_at(),
  public.wants_notification(uuid,text)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.activate_conversation_unlock(),
  public.activate_premium_subscription(),
  public.check_profile_personal_info(),
  public.check_profile_visibility(),
  public.compatibility_breakdown(uuid,uuid),
  public.confirm_payment(uuid,text,text,integer,text),
  public.consume_free_message(uuid),
  public.contains_phone_number(text),
  public.create_conversation_for_match(),
  public.create_match_on_mutual_like(),
  public.create_notification(uuid,text,uuid,jsonb,text),
  public.enforce_photo_limit(),
  public.expire_conversation_unlocks(),
  public.expire_subscriptions(),
  public.handle_new_user(),
  public.init_conversation_usage(),
  public.lock_conversation_for_sending(uuid,uuid),
  public.messages_block_phone_numbers(),
  public.notify_contact_request(),
  public.notify_favorite(),
  public.notify_like(),
  public.notify_match(),
  public.notify_message(),
  public.notify_visit(),
  public.photos_after_delete(),
  public.photos_before_insert(),
  public.protect_like_parties(),
  public.protect_photo_status(),
  public.protect_profile_status(),
  public.protect_server_profile_fields(),
  public.protect_terms_accepted_at(),
  public.protect_user_columns(),
  public.recent_signups(),
  public.refund_ai_quota(uuid,text),
  public.refuse_blocked_interaction(),
  public.remove_one_virtual_profile(text,public.gender),
  public.replace_virtual_profile_on_signup(),
  public.set_like_created_at(),
  public.set_updated_at(),
  public.wants_notification(uuid,text)
TO service_role;

-- 6 fonctions — tout le monde : exécution · visiteurs : exécution · membres connectés : exécution · serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.ai_usage_day(),
  public.clear_profile_coordinates(),
  public.premium_plan_amount(public.subscription_plan),
  public.set_favorite_created_at(),
  public.text_items_max_length(text[],integer),
  public.utc_day_start()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.ai_usage_day(),
  public.clear_profile_coordinates(),
  public.premium_plan_amount(public.subscription_plan),
  public.set_favorite_created_at(),
  public.text_items_max_length(text[],integer),
  public.utc_day_start()
TO PUBLIC, anon, authenticated, service_role;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;

-- ============================================================================
-- 15. Comptes : chaque nouveau compte (e-mail ou Google) reçoit son profil
-- ============================================================================

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 16. Fichiers : espaces privés (photos, messages vocaux, vérifications) et leurs règles
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('photos', 'photos', false, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('verifications', 'verifications', false, 8388608, '{image/jpeg,image/png,image/webp}'),
  ('voice-messages', 'voice-messages', false, 2097152, '{audio/webm,audio/ogg,audio/mp4,audio/mpeg}')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY photos_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

CREATE POLICY photos_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY photos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin() OR (public.can_browse_profiles() AND (EXISTS ( SELECT 1
   FROM public.photos p
  WHERE ((p.storage_path = objects.name) AND (p.status = 'approved'::public.photo_status) AND (NOT public.is_blocked_between(auth.uid(), p.user_id)) AND public.is_discoverable_profile(p.user_id))))))));

CREATE POLICY verifications_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'verifications'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

CREATE POLICY verifications_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'verifications'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

CREATE POLICY verifications_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'verifications'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

CREATE POLICY voice_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'voice-messages'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));

CREATE POLICY voice_storage_insert_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'voice-messages'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND public.is_conversation_folder_participant((storage.foldername(name))[1]) AND public.is_premium(auth.uid())));

CREATE POLICY voice_storage_select_participant ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'voice-messages'::text) AND (public.is_conversation_folder_participant((storage.foldername(name))[1]) OR public.is_admin())));

-- ============================================================================
-- 17. Temps réel : nouveaux messages affichés sans recharger la page
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ============================================================================
-- 18. Tâches automatiques (pg_cron, si Supabase le permet ; sinon les dates suffisent)
-- ============================================================================

-- Toutes les 5 minutes : fin des déblocages de conversation.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-expirer-deblocages';
    PERFORM cron.schedule(
      'yona-expirer-deblocages',
      '*/5 * * * *',
      'select public.expire_conversation_unlocks()'
    );
  ELSE
    RAISE NOTICE 'pg_cron indisponible : expiration par date seulement (statut mis à jour par appel externe).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : expiration par date seulement.', SQLERRM;
END;
$cron$;

-- Toutes les 5 minutes : fin des abonnements Premium.
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

-- ============================================================================
-- 19. Données de départ : 247 pays (position, pour le pays le plus proche)
-- ============================================================================

INSERT INTO public.geo_countries (code, name, lat, lng) VALUES
  ('AF', 'Afghanistan', 34.64, 67.55),
  ('ZA', 'Afrique du Sud', -28.59, 27.24),
  ('AL', 'Albanie', 41.1, 20.01),
  ('DZ', 'Algérie', 34.84, 3.3),
  ('DE', 'Allemagne', 50.65, 10.18),
  ('AD', 'Andorre', 42.53, 1.55),
  ('AO', 'Angola', -10.9, 15.97),
  ('AI', 'Anguilla', 18.21, -63.06),
  ('AG', 'Antigua-et-Barbuda', 17.14, -61.8),
  ('SA', 'Arabie saoudite', 23.86, 44.13),
  ('AR', 'Argentine', -32.06, -62.61),
  ('AM', 'Arménie', 40.31, 44.57),
  ('AW', 'Aruba', 12.52, -70),
  ('AU', 'Australie', -32.28, 144.13),
  ('AT', 'Autriche', 47.62, 14.38),
  ('AZ', 'Azerbaïdjan', 40.35, 47.71),
  ('BS', 'Bahamas', 24.76, -76.52),
  ('BH', 'Bahreïn', 26.17, 50.55),
  ('BD', 'Bangladesh', 23.69, 90.26),
  ('BB', 'Barbade', 13.18, -59.57),
  ('BE', 'Belgique', 50.74, 4.52),
  ('BZ', 'Belize', 17.49, -88.58),
  ('BJ', 'Bénin', 8.09, 2.23),
  ('BM', 'Bermudes', 32.31, -64.77),
  ('BT', 'Bhoutan', 27.29, 90.27),
  ('BY', 'Biélorussie', 53.57, 27.82),
  ('BO', 'Bolivie', -17.52, -65.46),
  ('BA', 'Bosnie-Herzégovine', 44.36, 17.83),
  ('BW', 'Botswana', -22.93, 25.8),
  ('BR', 'Brésil', -16.49, -46.3),
  ('BN', 'Brunei', 4.85, 114.81),
  ('BG', 'Bulgarie', 42.8, 25.14),
  ('BF', 'Burkina Faso', 12.31, -1.63),
  ('BI', 'Burundi', -3.36, 29.78),
  ('KH', 'Cambodge', 12.18, 104.71),
  ('CM', 'Cameroun', 5.75, 11.54),
  ('CA', 'Canada', 48.24, -91.4),
  ('CV', 'Cap-Vert', 15.7, -23.9),
  ('CF', 'Centrafrique', 5.68, 18.99),
  ('CL', 'Chili', -35.27, -71.82),
  ('CN', 'Chine', 32.44, 110.25),
  ('CY', 'Chypre', 34.98, 33.24),
  ('CO', 'Colombie', 5.69, -74.76),
  ('KM', 'Comores', -11.95, 43.86),
  ('CG', 'Congo-Brazzaville', -1.98, 14.64),
  ('KP', 'Corée du Nord', 40.17, 127.23),
  ('KR', 'Corée du Sud', 36.1, 127.44),
  ('CR', 'Costa Rica', 9.96, -84.23),
  ('CI', 'Côte d''Ivoire', 7.22, -5.64),
  ('HR', 'Croatie', 45.14, 16.41),
  ('CU', 'Cuba', 22.07, -79.92),
  ('CW', 'Curaçao', 12.17, -68.97),
  ('DK', 'Danemark', 55.84, 10.68),
  ('DJ', 'Djibouti', 11.64, 42.78),
  ('DM', 'Dominique', 15.41, -61.36),
  ('EG', 'Égypte', 29.35, 31.43),
  ('AE', 'Émirats arabes unis', 25.1, 55.37),
  ('EC', 'Équateur', -1.48, -79.11),
  ('ER', 'Érythrée', 14.98, 38.87),
  ('ES', 'Espagne', 40.54, -3.23),
  ('EE', 'Estonie', 58.93, 25.4),
  ('SZ', 'Eswatini', -26.5, 31.43),
  ('VA', 'État de la Cité du Vatican', 41.9, 12.45),
  ('US', 'États-Unis', 38.34, -90.5),
  ('ET', 'Éthiopie', 9.17, 38.9),
  ('FJ', 'Fidji', -17.37, 155.86),
  ('FI', 'Finlande', 61.71, 24.77),
  ('FR', 'France', 46.99, 2.49),
  ('GA', 'Gabon', -0.84, 11.68),
  ('GM', 'Gambie', 13.42, -15.7),
  ('GE', 'Géorgie', 42.22, 42.92),
  ('GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', -54.28, -36.51),
  ('GH', 'Ghana', 6.69, -1.01),
  ('GI', 'Gibraltar', 36.13, -5.35),
  ('GR', 'Grèce', 38.82, 23.19),
  ('GD', 'Grenade', 12.18, -61.66),
  ('GL', 'Groenland', 65.86, -49.72),
  ('GP', 'Guadeloupe', 16.18, -61.56),
  ('GU', 'Guam', 13.44, 144.76),
  ('GT', 'Guatemala', 14.92, -90.85),
  ('GG', 'Guernesey', 49.48, -2.55),
  ('GN', 'Guinée', 10.61, -11.28),
  ('GQ', 'Guinée équatoriale', 1.75, 9.86),
  ('GW', 'Guinée-Bissau', 11.95, -15.35),
  ('GY', 'Guyana', 6.39, -58.13),
  ('GF', 'Guyane française', 4.91, -52.93),
  ('HT', 'Haïti', 18.99, -72.73),
  ('HN', 'Honduras', 14.79, -87.52),
  ('HU', 'Hongrie', 47.32, 19.53),
  ('CX', 'Île Christmas', -10.42, 105.68),
  ('IM', 'Île de Man', 54.22, -4.54),
  ('NF', 'Île Norfolk', -29.05, 167.97),
  ('AX', 'Îles Åland', 60.2, 20.18),
  ('KY', 'Îles Caïmans', 19.36, -81.13),
  ('CC', 'Îles Cocos', -12.16, 96.82),
  ('CK', 'Îles Cook', -21.22, -159.75),
  ('FO', 'Îles Féroé', 61.99, -6.82),
  ('FK', 'Îles Malouines', -51.69, -57.86),
  ('MP', 'Îles Mariannes du Nord', 15.15, 145.71),
  ('MH', 'Îles Marshall', 8.25, 168.99),
  ('UM', 'Îles mineures éloignées des États-Unis', 0, 0),
  ('PN', 'Îles Pitcairn', -25.07, -130.1),
  ('SB', 'Îles Salomon', -9.17, 159.79),
  ('TC', 'Îles Turques-et-Caïques', 21.76, -72.06),
  ('VG', 'Îles Vierges britanniques', 18.44, -64.53),
  ('VI', 'Îles Vierges des États-Unis', 18.14, -64.84),
  ('IN', 'Inde', 20.45, 79.18),
  ('ID', 'Indonésie', -3.81, 112.59),
  ('IQ', 'Irak', 34.29, 44.56),
  ('IR', 'Iran', 33.83, 51.72),
  ('IE', 'Irlande', 53.2, -7.38),
  ('IS', 'Islande', 64.61, -20.27),
  ('IL', 'Israël', 32.28, 35.06),
  ('IT', 'Italie', 43.43, 11.58),
  ('JM', 'Jamaïque', 18.15, -77.28),
  ('JP', 'Japon', 35.92, 137.14),
  ('JE', 'Jersey', 49.21, -2.1),
  ('JO', 'Jordanie', 31.87, 35.89),
  ('KZ', 'Kazakhstan', 48.34, 69.24),
  ('KE', 'Kenya', -0.61, 36.73),
  ('KG', 'Kirghizstan', 41.33, 73.35),
  ('KI', 'Kiribati', 1.77, 85.99),
  ('XK', 'Kosovo', 42.55, 20.78),
  ('KW', 'Koweït', 29.26, 48.03),
  ('RE', 'La Réunion', -21.12, 55.5),
  ('LA', 'Laos', 18.32, 103.84),
  ('LS', 'Lesotho', -29.56, 27.95),
  ('LV', 'Lettonie', 56.91, 24.5),
  ('LB', 'Liban', 33.78, 35.71),
  ('LR', 'Liberia', 6.47, -9.26),
  ('LY', 'Libye', 30.87, 16.01),
  ('LI', 'Liechtenstein', 47.17, 9.52),
  ('LT', 'Lituanie', 55.17, 23.84),
  ('LU', 'Luxembourg', 49.68, 6.11),
  ('MK', 'Macédoine du Nord', 41.68, 21.56),
  ('MG', 'Madagascar', -19.25, 47.33),
  ('MY', 'Malaisie', 3.84, 103.4),
  ('MW', 'Malawi', -14, 34.52),
  ('MV', 'Maldives', 3.16, 73.28),
  ('ML', 'Mali', 14.02, -5.45),
  ('MT', 'Malte', 35.92, 14.43),
  ('MA', 'Maroc', 32.85, -6.37),
  ('MQ', 'Martinique', 14.64, -60.99),
  ('MU', 'Maurice', -20.09, 57.71),
  ('MR', 'Mauritanie', 17.35, -12.56),
  ('YT', 'Mayotte', -12.81, 45.15),
  ('MX', 'Mexique', 20.19, -99.25),
  ('FM', 'Micronésie', 6.96, 151.76),
  ('MD', 'Moldavie', 47.09, 28.73),
  ('MC', 'Monaco', 43.74, 7.42),
  ('MN', 'Mongolie', 47.48, 102.55),
  ('ME', 'Monténégro', 42.56, 19.22),
  ('MS', 'Montserrat', 16.76, -62.21),
  ('MZ', 'Mozambique', -18.98, 35.72),
  ('MM', 'Myanmar (Birmanie)', 18.13, 96.22),
  ('NA', 'Namibie', -21.54, 17.09),
  ('NR', 'Nauru', -0.53, 166.93),
  ('NP', 'Népal', 27.85, 84.29),
  ('NI', 'Nicaragua', 12.6, -85.89),
  ('NE', 'Niger', 14.45, 6.31),
  ('NG', 'Nigeria', 8.74, 7.37),
  ('NU', 'Niue', -19.05, -169.92),
  ('NO', 'Norvège', 61.99, 10.26),
  ('NC', 'Nouvelle-Calédonie', -21.77, 166.05),
  ('NZ', 'Nouvelle-Zélande', -40.4, 173.32),
  ('OM', 'Oman', 23.06, 57.18),
  ('UG', 'Ouganda', 0.82, 32.07),
  ('UZ', 'Ouzbékistan', 40.6, 67.22),
  ('PK', 'Pakistan', 30.57, 71.27),
  ('PW', 'Palaos', 7.15, 134.26),
  ('PA', 'Panama', 8.46, -80.7),
  ('PG', 'Papouasie-Nouvelle-Guinée', -6.36, 146.97),
  ('PY', 'Paraguay', -25.26, -56.68),
  ('NL', 'Pays-Bas', 52.07, 5.46),
  ('BQ', 'Pays-Bas caribéens', 14.2, -66.36),
  ('PE', 'Pérou', -11.1, -75.29),
  ('PH', 'Philippines', 11.9, 122.73),
  ('PL', 'Pologne', 51.48, 19.43),
  ('PF', 'Polynésie française', -17.3, -148.48),
  ('PR', 'Porto Rico', 18.23, -66.38),
  ('PT', 'Portugal', 39.58, -9.75),
  ('QA', 'Qatar', 25.39, 51.43),
  ('HK', 'R.A.S. chinoise de Hong Kong', 22.32, 114.17),
  ('MO', 'R.A.S. chinoise de Macao', 22.16, 113.55),
  ('CD', 'RD Congo', -3.38, 23.52),
  ('DO', 'République dominicaine', 18.93, -70.55),
  ('RO', 'Roumanie', 45.8, 25.13),
  ('GB', 'Royaume-Uni', 52.85, -1.84),
  ('RU', 'Russie', 53.5, 57.2),
  ('RW', 'Rwanda', -2.05, 29.63),
  ('EH', 'Sahara occidental', 25.2, -13.8),
  ('BL', 'Saint-Barthélemy', 17.9, -62.85),
  ('KN', 'Saint-Christophe-et-Niévès', 17.29, -62.73),
  ('SM', 'Saint-Marin', 43.94, 12.46),
  ('MF', 'Saint-Martin', 18.07, -63.07),
  ('SX', 'Saint-Martin (partie néerlandaise)', 18.04, -63.05),
  ('PM', 'Saint-Pierre-et-Miquelon', 46.94, -56.28),
  ('VC', 'Saint-Vincent-et-les Grenadines', 13.19, -61.2),
  ('SH', 'Sainte-Hélène', -19.21, -9.54),
  ('LC', 'Sainte-Lucie', 13.92, -60.96),
  ('SV', 'Salvador', 13.69, -88.93),
  ('WS', 'Samoa', -13.81, -171.93),
  ('AS', 'Samoa américaines', -14.11, -170.55),
  ('ST', 'Sao Tomé-et-Principe', 0.35, 6.72),
  ('SN', 'Sénégal', 14.58, -15.51),
  ('RS', 'Serbie', 44.74, 20.41),
  ('SC', 'Seychelles', -4.61, 55.51),
  ('SL', 'Sierra Leone', 8.36, -11.8),
  ('SG', 'Singapour', 1.34, 103.83),
  ('SK', 'Slovaquie', 48.62, 18.7),
  ('SI', 'Slovénie', 46.22, 14.98),
  ('SO', 'Somalie', 6.03, 45.39),
  ('SD', 'Soudan', 14.38, 31.45),
  ('SS', 'Soudan du Sud', 7, 29.54),
  ('LK', 'Sri Lanka', 7.15, 80.46),
  ('SE', 'Suède', 58.97, 15.37),
  ('CH', 'Suisse', 47.06, 8.11),
  ('SR', 'Suriname', 5.73, -55.27),
  ('SJ', 'Svalbard et Jan Mayen', 74.57, 3.46),
  ('SY', 'Syrie', 34.91, 37.07),
  ('TJ', 'Tadjikistan', 38.76, 69.45),
  ('TW', 'Taïwan', 24.15, 120.67),
  ('TZ', 'Tanzanie', -5.81, 35.5),
  ('TD', 'Tchad', 12.03, 17.55),
  ('CZ', 'Tchéquie', 49.75, 15.71),
  ('TF', 'Terres australes françaises', -49.35, 70.22),
  ('IO', 'Territoire britannique de l''océan Indien', -7.26, 72.38),
  ('PS', 'Territoires palestiniens', 31.97, 35.12),
  ('TH', 'Thaïlande', 14.32, 101.19),
  ('TL', 'Timor oriental', -8.8, 125.73),
  ('TG', 'Togo', 8.23, 0.97),
  ('TK', 'Tokelau', -9.04, -171.87),
  ('TO', 'Tonga', -20.64, -174.94),
  ('TT', 'Trinité-et-Tobago', 10.47, -61.4),
  ('TN', 'Tunisie', 35.64, 10.02),
  ('TM', 'Turkménistan', 38.57, 59.47),
  ('TR', 'Turquie', 38.86, 34.4),
  ('TV', 'Tuvalu', -7.69, 178.29),
  ('UA', 'Ukraine', 48.43, 30.97),
  ('UY', 'Uruguay', -33.56, -56.18),
  ('VU', 'Vanuatu', -16.33, 167.83),
  ('VE', 'Venezuela', 9.4, -68.25),
  ('VN', 'Viêt Nam', 16.62, 106.32),
  ('WF', 'Wallis-et-Futuna', -13.96, -177.48),
  ('YE', 'Yémen', 14.9, 45.12),
  ('ZM', 'Zambie', -13.55, 28.12),
  ('ZW', 'Zimbabwe', -18.52, 30.34)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ============================================================================
-- 20. Données de départ : 50 profils virtuels (comptes sans mot de passe)
-- ============================================================================

DO $do$
DECLARE
  _seed jsonb := $seed$[
["virtuel.ga.01@profils-virtuels.yona.invalid","Prisca","Ondo","female","1997-10-29","Gabon","Estuaire","Libreville","Souriante et attentionnée, j'aime la cuisine et la louange. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Louange","Cuisine"],"Adventiste","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",20,38],
["virtuel.ga.02@profils-virtuels.yona.invalid","Steeve","Mintsa","male","2000-04-03","Gabon","Ogooué-Maritime","Port-Gentil","Dynamique et fidèle en amitié, je consacre mon temps libre à la louange. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Louange","Voyages"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Mariage","female",18,35],
["virtuel.ga.03@profils-virtuels.yona.invalid","Rachel","Obiang","female","1986-04-18","Gabon","Haut-Ogooué","Franceville","Calme et joyeuse, je partage mon temps entre mon travail et le cinéma. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique","Cinéma","Mode"],"Catholique","Chaque semaine","Matin et soir","Essentielle","Mariage","male",31,49],
["virtuel.ga.04@profils-virtuels.yona.invalid","Brice","Bivigou","male","1979-03-27","Gabon","Woleu-Ntem","Oyem","Posé mais déterminé, j'aime les voyages, le cinéma et les longues discussions. Je joue dans le groupe de louange de mon église. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Lecture","Voyages","Cinéma"],"Protestante (Église évangélique du Gabon)","Chaque semaine","Plusieurs fois par semaine","Essentielle","Mariage","female",38,56],
["virtuel.ga.05@profils-virtuels.yona.invalid","Murielle","Nzé","female","2000-07-14","Gabon","Haut-Ogooué","Moanda","Je suis une femme simple, passionnée par la mode et la cuisine. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Cuisine","Nature","Mode","Bénévolat"],"Pentecôtiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","male",18,35],
["virtuel.cm.01@profils-virtuels.yona.invalid","Serge","Nana","male","1984-11-07","Cameroun","Centre","Yaoundé","Fils de Dieu avant tout, je trouve ma joie dans le cinéma et le sport. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Nature","Voyages","Sport"],"Pentecôtiste","Plusieurs fois par semaine","Tous les jours","Au centre de ma vie","Mariage","female",33,51],
["virtuel.cm.02@profils-virtuels.yona.invalid","Brenda","Kamga","female","1984-06-04","Cameroun","Littoral","Douala","Douce mais déterminée, j'aime la photographie, les voyages et les longues discussions. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Bénévolat","Voyages","Photographie"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",33,51],
["virtuel.cm.03@profils-virtuels.yona.invalid","Martial","Mbappé","male","1986-12-25","Cameroun","West","Bafoussam","Chaque journée est un cadeau de Dieu : je la remplis de louange et de musique. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Danse","Musique"],"Baptiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",31,49],
["virtuel.cm.04@profils-virtuels.yona.invalid","Nadine","Nkoulou","female","1980-08-14","Cameroun","North-West","Bamenda","Souriante et attentionnée, j'aime la cuisine et la danse. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Bénévolat","Cuisine","Danse","Cinéma"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",37,55],
["virtuel.cm.05@profils-virtuels.yona.invalid","Guy","Onana","male","2001-12-03","Cameroun","North","Garoua","Souriant et attentionné, j'aime la mode et le bénévolat. La prière rythme mes journées. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Louange","Bénévolat"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",18,34],
["virtuel.ci.01@profils-virtuels.yona.invalid","Grâce","Ouattara","female","2003-01-06","Côte d'Ivoire","Abidjan Autonomous District","Abidjan","Je suis une femme simple, passionnée par la musique et le cinéma. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Lecture","Musique","Cinéma"],"Catholique","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",18,32],
["virtuel.ci.02@profils-virtuels.yona.invalid","Cyrille","Ehui","male","1982-10-06","Côte d'Ivoire","Vallée du Bandama District","Bouaké","Dynamique et fidèle en amitié, je consacre mon temps libre à la danse. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Cuisine","Danse","Voyages"],"Catholique","Plusieurs fois par semaine","Matin et soir","Très importante","Mariage","female",35,53],
["virtuel.ci.03@profils-virtuels.yona.invalid","Laetitia","Konan","female","1986-03-31","Côte d'Ivoire","Lacs District","Yamoussoukro","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de danse. Le Psaume 23 m'accompagne depuis toujours. Prête à bâtir une famille fondée sur l'amour et la foi.",["Nature","Louange","Bénévolat","Danse"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",31,49],
["virtuel.ci.04@profils-virtuels.yona.invalid","Didier","Kouamé","male","1977-07-01","Côte d'Ivoire","Sassandra-Marahoue","Daloa","Calme et joyeux, je partage mon temps entre mon travail et les balades dans la nature. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Sport","Nature","Voyages"],"Harriste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","female",40,58],
["virtuel.ci.05@profils-virtuels.yona.invalid","Ange","Gnahoré","female","1991-09-06","Côte d'Ivoire","Bas-Sassandra District","San-Pédro","Dynamique et fidèle en amitié, je consacre mon temps libre à la cuisine. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Sport","Cuisine"],"Méthodiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",26,44],
["virtuel.cg.01@profils-virtuels.yona.invalid","Hardy","Matsiona","male","1990-06-30","Congo-Brazzaville","Brazzaville","Brazzaville","Posé mais déterminé, j'aime la lecture, la cuisine et les longues discussions. Ma foi guide chacune de mes décisions. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Lecture","Cuisine"],"Salutiste (Armée du Salut)","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.cg.02@profils-virtuels.yona.invalid","Grâce","Ibara","female","1988-11-26","Congo-Brazzaville","Pointe-Noire","Pointe-Noire","Calme et joyeuse, je partage mon temps entre mon travail et la lecture. Ma foi guide chacune de mes décisions. Prête à bâtir une famille fondée sur l'amour et la foi.",["Voyages","Lecture"],"Kimbanguiste","Chaque semaine","Matin et soir","Très importante","Mariage","male",29,47],
["virtuel.cg.03@profils-virtuels.yona.invalid","Varel","Miakassissa","male","2000-03-11","Congo-Brazzaville","Niari","Dolisie","Chaque journée est un cadeau de Dieu : je la remplis de musique et de mode. Ma foi guide chacune de mes décisions. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Mode","Musique","Photographie"],"Pentecôtiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Faire connaissance d'abord","female",18,35],
["virtuel.cg.04@profils-virtuels.yona.invalid","Victoire","Moukoko","female","1982-10-05","Congo-Brazzaville","Bouenza","Nkayi","Je suis une femme simple, passionnée par le sport et la musique. Je participe à un groupe de prière chaque semaine. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Louange","Sport","Musique"],"Catholique","Chaque semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",35,53],
["virtuel.cg.05@profils-virtuels.yona.invalid","Ulrich","Kimbembé","male","1983-12-02","Congo-Brazzaville","Cuvette","Owando","Posé mais déterminé, j'aime le cinéma, la musique et les longues discussions. Je participe à un groupe de prière chaque semaine. J'attends une femme de foi, douce et pleine de joie.",["Cinéma","Musique"],"Kimbanguiste","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.tg.01@profils-virtuels.yona.invalid","Dédé","Kudjoh","female","1980-07-30","Togo","Maritime","Lomé","Douce mais déterminée, j'aime la lecture, la danse et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Danse","Lecture"],"Évangélique presbytérienne","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Relation sérieuse","male",37,55],
["virtuel.tg.02@profils-virtuels.yona.invalid","Dodji","Lawson","male","1994-12-24","Togo","Centrale","Sokodé","Calme et joyeux, je partage mon temps entre mon travail et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Bénévolat","Photographie","Danse"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",23,41],
["virtuel.tg.03@profils-virtuels.yona.invalid","Dzifa","Ahadji","female","2002-03-28","Togo","Kara","Kara","Fille de Dieu avant tout, je trouve ma joie dans la lecture et les voyages. Je suis engagée dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Musique","Lecture","Voyages"],"Catholique","Chaque semaine","Tous les jours","Au centre de ma vie","Relation sérieuse","male",18,33],
["virtuel.tg.04@profils-virtuels.yona.invalid","Sénamé","Amegah","male","1984-12-04","Togo","Plateaux","Kpalimé","Chaque journée est un cadeau de Dieu : je la remplis de sport et de lecture. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Musique","Lecture","Mode","Sport"],"Évangélique presbytérienne","Chaque semaine","Matin et soir","Essentielle","Faire connaissance d'abord","female",33,51],
["virtuel.tg.05@profils-virtuels.yona.invalid","Mawuena","Dossou","female","1985-01-06","Togo","Plateaux","Atakpamé","Douce mais déterminée, j'aime la lecture, les balades dans la nature et les longues discussions. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Nature","Lecture","Sport"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","male",32,50],
["virtuel.bj.01@profils-virtuels.yona.invalid","Gildas","Agossou","male","1977-01-03","Bénin","Littoral","Cotonou","Souriant et attentionné, j'aime la mode et la danse. Le Psaume 23 m'accompagne depuis toujours. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Musique","Danse","Mode"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","female",40,58],
["virtuel.bj.02@profils-virtuels.yona.invalid","Léonie","Kpossou","female","1999-11-22","Bénin","Ouémé","Porto-Novo","Je suis une femme simple, passionnée par le bénévolat et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Photographie","Bénévolat"],"Église du christianisme céleste","Deux à trois fois par mois","Tous les jours","Très importante","Relation sérieuse","male",18,36],
["virtuel.bj.03@profils-virtuels.yona.invalid","Arnaud","Hounkpatin","male","1983-01-01","Bénin","Borgou","Parakou","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. La prière rythme mes journées. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Photographie","Danse"],"Méthodiste","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",34,52],
["virtuel.bj.04@profils-virtuels.yona.invalid","Ornella","Akpovo","female","1993-10-21","Bénin","Zou","Abomey","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de voyages. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Nature","Bénévolat","Voyages"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",24,42],
["virtuel.bj.05@profils-virtuels.yona.invalid","Dieudonné","Zinsou","male","1983-02-23","Bénin","Atlantique","Abomey-Calavi","Je suis un homme simple, passionné par la cuisine et la lecture. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Cuisine","Lecture"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.01@profils-virtuels.yona.invalid","Joséphine","Diène","female","1979-12-05","Sénégal","Dakar","Dakar","Je suis une femme simple, passionnée par la mode et le cinéma. Je sers à l'accueil de mon église le dimanche. Je crois au mariage, à la fidélité et au respect.",["Sport","Cinéma","Photographie","Mode"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Essentielle","Faire connaissance d'abord","male",38,56],
["virtuel.sn.02@profils-virtuels.yona.invalid","Charles","Diouf","male","1989-01-17","Sénégal","Thies","Thiès","Je suis un homme simple, passionné par la photographie et la danse. J'aide à l'organisation des sorties de l'église. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Danse","Sport","Photographie"],"Catholique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",28,46],
["virtuel.sn.03@profils-virtuels.yona.invalid","Clémentine","Da Silva","female","1991-09-25","Sénégal","Ziguinchor","Ziguinchor","Souriante et attentionnée, j'aime la mode et le cinéma. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Sport","Mode","Cinéma"],"Adventiste","Chaque semaine","Matin et soir","Au centre de ma vie","Mariage","male",26,44],
["virtuel.sn.04@profils-virtuels.yona.invalid","Antoine","Ndour","male","1983-08-31","Sénégal","Saint-Louis","Saint-Louis","Fils de Dieu avant tout, je trouve ma joie dans la musique et la louange. J'aide à l'organisation des sorties de l'église. Je cherche une relation sérieuse, en vue du mariage.",["Louange","Musique","Cuisine"],"Catholique","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.05@profils-virtuels.yona.invalid","Cécile","Mendy","female","2000-09-23","Sénégal","Thies","Mbour","Souriante et attentionnée, j'aime le bénévolat et la danse. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Danse","Louange","Bénévolat","Cuisine"],"Évangélique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","male",18,35],
["virtuel.ml.01@profils-virtuels.yona.invalid","Bernard","Kéita","male","1987-07-23","Mali","Bamako","Bamako","Posé mais déterminé, j'aime la cuisine, la mode et les longues discussions. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Mode"],"Baptiste","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Mariage","female",30,48],
["virtuel.ml.02@profils-virtuels.yona.invalid","Béatrice","Konaté","female","1991-03-31","Mali","Sikasso","Sikasso","Douce mais déterminée, j'aime la cuisine, la photographie et les longues discussions. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Photographie","Cinéma","Sport"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",26,44],
["virtuel.ml.03@profils-virtuels.yona.invalid","Luc","Traoré","male","1990-08-01","Mali","Ségou","Ségou","Calme et joyeux, je partage mon temps entre mon travail et la musique. Je sers à l'accueil de mon église le dimanche. J'attends une femme de foi, douce et pleine de joie.",["Musique","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.ml.04@profils-virtuels.yona.invalid","Marthe","Dara","female","1992-08-08","Mali","Mopti","Mopti","Dynamique et fidèle en amitié, je consacre mon temps libre aux balades dans la nature. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Musique","Nature","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Essentielle","Mariage","male",25,43],
["virtuel.ml.05@profils-virtuels.yona.invalid","Timothée","Togo","male","1992-09-23","Mali","Sikasso","Koutiala","Dynamique et fidèle en amitié, je consacre mon temps libre au cinéma. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Musique","Cuisine","Cinéma"],"Baptiste","Plusieurs fois par semaine","Matin et soir","Essentielle","Relation sérieuse","female",25,43],
["virtuel.fr.01@profils-virtuels.yona.invalid","Anne","Bernard","female","1995-01-21","France","Île-de-France","Paris","Je suis une femme simple, passionnée par la mode et les voyages. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Mode","Voyages","Lecture"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","male",22,40],
["virtuel.fr.02@profils-virtuels.yona.invalid","Benoît","Lambert","male","2003-01-25","France","Auvergne-Rhône-Alpes","Lyon","Souriant et attentionné, j'aime le bénévolat et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. Je crois au mariage, à la fidélité et au respect.",["Danse","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Très importante","Mariage","female",18,32],
["virtuel.fr.03@profils-virtuels.yona.invalid","Charlotte","Faure","female","1986-09-19","France","Provence-Alpes-Côte d'Azur","Marseille","Calme et joyeuse, je partage mon temps entre mon travail et la photographie. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Photographie","Mode"],"Catholique","Deux à trois fois par mois","Tous les jours","Au centre de ma vie","Relation sérieuse","male",31,49],
["virtuel.fr.04@profils-virtuels.yona.invalid","Antoine","André","male","1980-04-29","France","Occitanie","Toulouse","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Nature","Photographie"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",37,55],
["virtuel.fr.05@profils-virtuels.yona.invalid","Sophie","Lefebvre","female","1993-06-22","France","New Aquitaine","Bordeaux","Fille de Dieu avant tout, je trouve ma joie dans les voyages et la musique. Je chante dans la chorale de mon église. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique"],"Catholique","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",24,42],
["virtuel.fr.06@profils-virtuels.yona.invalid","Julien","Masson","male","2003-02-02","France","Hauts-de-France","Lille","Fils de Dieu avant tout, je trouve ma joie dans la louange et la danse. La prière rythme mes journées. J'attends une femme de foi, douce et pleine de joie.",["Louange","Danse"],"Catholique","Deux à trois fois par mois","Tous les jours","Essentielle","Relation sérieuse","female",18,32],
["virtuel.fr.07@profils-virtuels.yona.invalid","Laure","Laurent","female","2000-04-29","France","Pays de la Loire","Nantes","Je suis une femme simple, passionnée par la photographie et les voyages. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Photographie","Voyages"],"Protestante réformée","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",18,35],
["virtuel.fr.08@profils-virtuels.yona.invalid","David","Martin","male","1990-05-10","France","Grand Est","Strasbourg","Chaque journée est un cadeau de Dieu : je la remplis de danse et de louange. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Photographie","Lecture","Danse"],"Baptiste","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",27,45],
["virtuel.fr.09@profils-virtuels.yona.invalid","Sarah","Fontaine","female","1993-06-08","France","Brittany","Rennes","Douce mais déterminée, j'aime le sport, la lecture et les longues discussions. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Cuisine","Lecture","Sport"],"Évangélique","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",24,42],
["virtuel.fr.10@profils-virtuels.yona.invalid","Nicolas","Rousseau","male","1978-09-29","France","Occitanie","Montpellier","Calme et joyeux, je partage mon temps entre mon travail et le sport. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Mode","Sport","Lecture","Louange"],"Catholique","Deux à trois fois par mois","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",39,57]
]$seed$;
  _col text;
BEGIN

  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    e ->> 0, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', e ->> 1, 'last_name', e ->> 2, 'is_virtual', true),
    now(), now()
  FROM jsonb_array_elements(_seed) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e ->> 0);

  -- Colonnes texte du service d'authentification : jamais NULL (sinon l'écran des
  -- utilisateurs de Supabase peut échouer). Seules les colonnes présentes sont touchées.
  FOREACH _col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
    'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = _col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email LIKE %L',
        _col, _col, '%@profils-virtuels.yona.invalid'
      );
    END IF;
  END LOOP;

  -- 2. Profils complets, actifs et visibles.
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 3)::public.gender,
      birth_date = (e ->> 4)::date,
      country = e ->> 5,
      region = e ->> 6,
      city = e ->> 7,
      bio = e ->> 8,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 9)),
      is_virtual = true,
      terms_accepted_at = now(),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible'
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 10,
      church_attendance = e ->> 11,
      prayer_practice = e ->> 12,
      faith_importance = e ->> 13
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 14,
      preferred_gender = (e ->> 15)::public.gender,
      min_age = (e ->> 16)::smallint,
      max_age = (e ->> 17)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;

-- ============================================================================
-- 21. Bilan
-- ============================================================================

-- Tâches automatiques : comptées à part (pg_cron peut être absent ou non lisible).
DO $$
BEGIN
  PERFORM pg_catalog.set_config('yona.taches',
    (SELECT count(*)::text FROM cron.job WHERE jobname LIKE 'yona-%'), false);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('yona.taches', 'pg_cron non activé', false);
END $$;

RESET client_min_messages;

SELECT b.element AS "Élément", b.trouve AS "Dans la base", b.attendu AS "Attendu",
       CASE WHEN b.trouve = b.attendu THEN '✅'
            WHEN b.facultatif THEN '⚠️ facultatif'
            ELSE '❌' END AS "État"
FROM (VALUES
  (1, 'Tables', (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public')::text, '31', false),
  (2, 'Fonctions', (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace)::text, '122', false),
  (3, 'Règles d''accès des tables', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public')::text, '75', false),
  (4, 'Tables protégées (RLS)', (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity)::text, '31', false),
  (5, 'Profil créé à l''inscription', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created'), 'oui', false),
  (6, 'Espaces de fichiers', (SELECT count(*) FROM storage.buckets WHERE id IN ('photos', 'verifications', 'voice-messages'))::text, '3', false),
  (7, 'Règles d''accès des fichiers', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND policyname IN ('photos_storage_delete_own',
      'photos_storage_insert_own',
      'photos_storage_select',
      'verifications_storage_delete',
      'verifications_storage_insert_own',
      'verifications_storage_select',
      'voice_storage_delete_own',
      'voice_storage_insert_premium',
      'voice_storage_select_participant'))::text, '9', false),
  (8, 'Messages en temps réel', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages'), 'oui', false),
  (9, 'Tâches automatiques', current_setting('yona.taches', true), '2', true),
  (10, 'Pays', (SELECT count(*) FROM public.geo_countries)::text, '247', false),
  (11, 'Profils virtuels', (SELECT count(*) FROM public.profiles WHERE is_virtual)::text, '50', false)
) AS b(n, element, trouve, attendu, facultatif)
ORDER BY b.n;
