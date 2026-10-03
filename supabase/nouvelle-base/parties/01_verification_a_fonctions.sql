-- YONA — base de données complète, partie 1 sur 5
-- Contenu :
--   1. Vérification : base neuve, ou YONA déjà installé par ce même fichier
--   2. Extensions
--   3. Types : listes de valeurs fixes (rôles, statuts, motifs…)
--   4. Fonctions : les règles du site exécutées par la base
-- À exécuter dans l'ordre (01, 02, …), chaque partie en entier :
-- Supabase → SQL Editor → New query → coller la partie → Run.
-- Chaque partie peut être relancée sans danger (par exemple après une erreur).
-- Fichier généré par scripts/generate-base-complete.py. Ne pas modifier à la main.

SET client_min_messages = warning;

-- ============================================================================
-- YONA — BASE DE DONNÉES COMPLÈTE (projet Supabase neuf et vide)
--
-- Ce fichier installe en une seule fois tout ce dont le site a besoin :
--   44 tables, 169 fonctions, 107 règles d'accès, les droits de chaque rôle,
--   la création automatique du profil à l'inscription (e-mail ou Google), 5 espaces de
--   fichiers (privés : photos, messages vocaux, vérifications ; publics : images des profils
--   de démonstration, publicités), les messages en temps réel, les tâches automatiques,
--   les réglages par défaut (publicités, vérification d'identité), les 247 pays et
--   les 40 profils de démonstration.
--
-- Mode d'emploi : Supabase → SQL Editor → New query → coller TOUT le fichier → Run.
-- Si Supabase affiche un avertissement (« destructive operation »), choisir
-- « Run this query » : rien n'est supprimé, ce sont des mots présents dans les fonctions
-- (et les « DROP POLICY IF EXISTS » qui remplacent une règle par elle-même).
-- Le tableau affiché à la fin doit indiquer ✅ sur chaque ligne.
-- Si l'éditeur refuse un fichier aussi long : utiliser les parties numérotées de
-- supabase/nouvelle-base/parties/ (même contenu), à exécuter dans l'ordre.
--
-- Tout ou rien : en cas d'erreur, rien n'est enregistré.
-- Rejouable : relancer ce fichier ne casse rien et ne crée aucun doublon (IF NOT EXISTS,
-- OR REPLACE, contrôle avant chaque contrainte ; profils de démonstration ajoutés une
-- seule fois). Après l'installation, ajoutez le premier administrateur (avant-dernière
-- section).
--
-- Les comptes, mots de passe, connexions et e-mails « mot de passe oublié » sont gérés par
-- Supabase Auth (schéma auth, mots de passe chiffrés) : aucune table à créer pour eux.
-- Le déclencheur de la section « Comptes » relie chaque nouveau compte à son profil.
--
-- Fichier généré par scripts/generate-base-complete.py à partir de supabase/migrations/
-- (96 migrations). Ne pas modifier à la main.
-- ============================================================================

-- ============================================================================
-- 1. Vérification : base neuve, ou YONA déjà installé par ce même fichier
-- ============================================================================

-- Le fichier accepte :
--   - une base neuve et vide (cas normal) ;
--   - une base où ce même fichier a déjà été exécuté (il est alors rejoué sans rien
--     supprimer ni dupliquer).
-- Il refuse, sans rien modifier :
--   - une base qui contient des tables étrangères à YONA ;
--   - une base YONA d'une version plus ancienne (colonnes manquantes) : pour la mettre à
--     jour, appliquer les migrations de supabase/migrations/ dans l'ordre.
DO $garde$
DECLARE
  -- Tables de YONA et leurs colonnes (état final des migrations).
  _attendu jsonb := $json${"activity_events":["id","user_id","event","target_user_id","ref_id","ip","country","user_agent","created_at"],"ad_events":["id","ad_id","user_id","event","placement","country","created_at"],"ad_settings":["id","discover_every","list_every","updated_at"],"admin_audit_log":["id","admin_id","action","target_table","target_id","changes","ip","user_agent","created_at"],"ads":["id","title","body","advertiser","media_type","media_path","poster_path","cta_label","cta_url","cta_icon","placements","status","starts_at","ends_at","target_countries","target_gender","min_age","max_age","priority","daily_cap","created_by","created_at","updated_at"],"ai_usage":["id","user_id","feature","usage_date","usage_count","created_at","updated_at"],"auth_events":["id","user_id","email","event","method","ip","country","city","user_agent","timezone","created_at"],"blocks":["id","blocker_id","blocked_id","created_at"],"christian_profiles":["user_id","denomination","faith_commitment","church_attendance","prayer_practice","faith_importance","marriage_vision","couple_vision","christian_values","extra","created_at","updated_at"],"contact_requests":["id","sender_id","receiver_id","message","status","created_at","responded_at","is_flash"],"conversation_reads":["conversation_id","user_id","last_read_at"],"conversation_unlocks":["id","conversation_id","paid_by_user_id","amount","currency","starts_at","expires_at","status","payment_id","created_at"],"conversation_user_usage":["id","conversation_id","user_id","free_messages_used","created_at","updated_at"],"conversations":["id","match_id","user_1_id","user_2_id","status","free_messages_used","last_message_at","created_at","updated_at"],"favorites":["id","user_id","favorite_user_id","created_at"],"geo_countries":["code","name","lat","lng"],"geo_timezones":["tz","country_codes"],"likes":["id","sender_id","receiver_id","kind","status","created_at"],"location_history":["id","user_id","source","retained_source","country_code","country","city","ip_country","timezone","inconsistent","inconsistency","created_at"],"matches":["id","user_1_id","user_2_id","status","created_at"],"messages":["id","conversation_id","sender_id","content","status","moderation_status","moderation_flags","contains_phone_number","blocked_reason","created_at","kind","audio_path","audio_duration_seconds"],"moderation_actions":["id","admin_id","target_user_id","action","reason","metadata","created_at"],"notifications":["id","user_id","type","actor_id","data","read_at","created_at"],"payment_events":["id","payment_id","user_id","event","product","amount","currency","provider","provider_ref","reason","ip","country","user_agent","created_at"],"payments":["id","user_id","type","amount","currency","provider","provider_transaction_id","status","metadata","created_at","updated_at"],"photos":["id","user_id","storage_path","is_primary","position","status","created_at"],"preferences":["user_id","min_age","max_age","preferred_gender","city","country","max_distance_km","relationship_goal","family_project","christian_criteria","extra","created_at","updated_at"],"profile_boosts":["id","user_id","starts_at","expires_at","created_at"],"profile_locations":["user_id","latitude","longitude","updated_at","source","country_code","country","region","city","accuracy_m","ip_country","ip_city","timezone","language","inconsistent","inconsistency","checked_at"],"profile_verifications":["id","user_id","method","storage_path","status","created_at","reviewed_at","reviewed_by","document_type","challenge","challenge_path","document_path","consent_at","automatic","engine","reason","profile_similarity","document_similarity","liveness_similarity","liveness_shift","details","decided_at","files_deleted_at"],"profile_visits":["id","visitor_id","visited_user_id","visited_at"],"profiles":["user_id","first_name","birth_date","gender","city","country","latitude","longitude","profession","education_level","marital_status","has_children","children_count","bio","personality","interests","status","visibility","onboarding_step","onboarding_completed_at","created_at","updated_at","region","origin","terms_accepted_at","is_virtual","verified_at","demo_photo_path","demo_photo_source"],"reports":["id","reporter_id","reported_user_id","conversation_id","message_id","reason","description","status","created_at"],"server_errors":["id","source","message","user_id","path","details","created_at"],"signup_events":["id","user_id","step","method","country","created_at"],"storage_cleanup_queue":["id","bucket_id","path","reason","created_at","done_at"],"subscriptions":["id","user_id","plan","amount","currency","status","starts_at","expires_at","payment_id","created_at","updated_at"],"support_tickets":["id","user_id","subject","message","priority","status","admin_reply","answered_at","created_at","updated_at"],"user_activity":["user_id","last_login_at","last_seen_at","is_online","login_count","events","updated_at"],"user_roles":["id","user_id","role","created_at"],"user_settings":["user_id","activity_visible","notify_email","notify_messages","notify_matches","notify_likes","created_at","updated_at","marketing_emails"],"users":["id","email","status","last_active_at","created_at","updated_at"],"verification_settings":["id","accept_similarity","reject_similarity","aws_accept_similarity","aws_reject_similarity","liveness_min_shift","min_sharpness","max_attempts_per_day","file_retention_hours","updated_at"],"virtual_profile_removals":["user_id","removed_user_id","created_at","reason"]}$json$;
  _etrangeres text;
  _manquantes text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO _etrangeres
  FROM pg_catalog.pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND NOT _attendu ? c.relname;
  IF _etrangeres IS NOT NULL THEN
    RAISE EXCEPTION 'Cette base contient des tables qui ne viennent pas de YONA (%) : rien n''a été modifié.', _etrangeres
      USING HINT = 'Ce fichier est prévu pour un projet Supabase neuf et vide.';
  END IF;

  SELECT string_agg(t.key || '.' || col, ', ' ORDER BY t.key, col) INTO _manquantes
  FROM jsonb_each(_attendu) t
  CROSS JOIN LATERAL jsonb_array_elements_text(t.value) col
  WHERE pg_catalog.to_regclass('public.' || quote_ident(t.key)) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_attribute a
      WHERE a.attrelid = pg_catalog.to_regclass('public.' || quote_ident(t.key))
        AND a.attname = col AND a.attnum > 0 AND NOT a.attisdropped);
  IF _manquantes IS NOT NULL THEN
    RAISE EXCEPTION 'Une version plus ancienne de YONA est installée ici (colonnes absentes : %) : rien n''a été modifié.',
      left(_manquantes, 500)
      USING HINT = 'Pour mettre à jour une base existante, appliquer les migrations de supabase/migrations/ dans l''ordre.';
  END IF;

  IF pg_catalog.to_regclass('public.profiles') IS NOT NULL THEN
    RAISE NOTICE 'YONA est déjà installé dans cette base : le fichier est rejoué sans rien supprimer.';
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

DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.account_status') IS NULL THEN
    CREATE TYPE public.account_status AS ENUM (
    'active',
    'suspended',
    'disabled',
    'deleted'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.app_role') IS NULL THEN
    CREATE TYPE public.app_role AS ENUM (
    'user',
    'admin'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.conversation_status') IS NULL THEN
    CREATE TYPE public.conversation_status AS ENUM (
    'open',
    'locked',
    'closed'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.gender') IS NULL THEN
    CREATE TYPE public.gender AS ENUM (
    'male',
    'female'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.like_kind') IS NULL THEN
    CREATE TYPE public.like_kind AS ENUM (
    'like',
    'pass'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.like_status') IS NULL THEN
    CREATE TYPE public.like_status AS ENUM (
    'active',
    'withdrawn'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.match_status') IS NULL THEN
    CREATE TYPE public.match_status AS ENUM (
    'active',
    'unmatched',
    'blocked'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.message_status') IS NULL THEN
    CREATE TYPE public.message_status AS ENUM (
    'delivered',
    'blocked',
    'deleted'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.moderation_action_type') IS NULL THEN
    CREATE TYPE public.moderation_action_type AS ENUM (
    'warn',
    'suspend',
    'unsuspend',
    'disable',
    'delete_photo',
    'hide_profile',
    'note'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.moderation_status') IS NULL THEN
    CREATE TYPE public.moderation_status AS ENUM (
    'clean',
    'flagged',
    'rejected'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.payment_status') IS NULL THEN
    CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'cancelled',
    'refunded'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.payment_type') IS NULL THEN
    CREATE TYPE public.payment_type AS ENUM (
    'conversation_unlock',
    'subscription'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.photo_status') IS NULL THEN
    CREATE TYPE public.photo_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.profile_status') IS NULL THEN
    CREATE TYPE public.profile_status AS ENUM (
    'incomplete',
    'active',
    'hidden',
    'suspended'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.profile_visibility') IS NULL THEN
    CREATE TYPE public.profile_visibility AS ENUM (
    'visible',
    'hidden'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.report_reason') IS NULL THEN
    CREATE TYPE public.report_reason AS ENUM (
    'fake_profile',
    'harassment',
    'inappropriate_content',
    'scam',
    'suspicious_behavior',
    'other'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.report_status') IS NULL THEN
    CREATE TYPE public.report_status AS ENUM (
    'open',
    'reviewing',
    'resolved',
    'dismissed'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.subscription_plan') IS NULL THEN
    CREATE TYPE public.subscription_plan AS ENUM (
    'premium_monthly',
    'premium_yearly'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.subscription_status') IS NULL THEN
    CREATE TYPE public.subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);
  END IF;
END
$type$;
DO $type$
BEGIN
  IF pg_catalog.to_regtype('public.unlock_status') IS NULL THEN
    CREATE TYPE public.unlock_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);
  END IF;
END
$type$;

-- ============================================================================
-- 4. Fonctions : les règles du site exécutées par la base
-- ============================================================================

CREATE OR REPLACE FUNCTION public.activate_conversation_unlock() RETURNS trigger
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
CREATE OR REPLACE FUNCTION public.activate_premium_subscription() RETURNS trigger
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
CREATE OR REPLACE FUNCTION public.activate_profile_boost() RETURNS timestamp with time zone
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
CREATE OR REPLACE FUNCTION public.admin_ad_stats(_ad_id uuid, _from timestamp with time zone, _to timestamp with time zone, _bucket text DEFAULT 'day'::text, _tz text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _unit text := CASE WHEN _bucket IN ('hour', 'day', 'week', 'month', 'year') THEN _bucket ELSE 'day' END;
BEGIN
  PERFORM public.assert_admin();
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22023';
  END IF;
  IF _to - _from > interval '5 years' THEN
    RAISE EXCEPTION 'period_too_long' USING ERRCODE = '22023';
  END IF;
  IF _unit = 'hour' AND _to - _from > interval '31 days' THEN _unit := 'day'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = _tz) THEN
    _tz := 'UTC';
  END IF;

  RETURN (
    WITH ev AS (
      SELECT e.ad_id, e.user_id, e.event, e.country, e.created_at FROM public.ad_events e
      WHERE e.created_at >= _from AND e.created_at < _to AND (_ad_id IS NULL OR e.ad_id = _ad_id)
    )
    SELECT jsonb_build_object(
      'period', jsonb_build_object('from', _from, 'to', _to, 'bucket', _unit, 'timezone', _tz),
      'ads', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'status', a.status,
          'views', coalesce(s.views, 0), 'clicks', coalesce(s.clicks, 0), 'skips', coalesce(s.skips, 0),
          'viewers', coalesce(s.viewers, 0),
          'ctr', CASE WHEN coalesce(s.views, 0) = 0 THEN 0
                      ELSE round(100.0 * s.clicks / s.views, 2) END
        ) ORDER BY coalesce(s.views, 0) DESC, a.created_at DESC), '[]'::jsonb)
        FROM public.ads a
        LEFT JOIN (
          SELECT ad_id, count(*) FILTER (WHERE event = 'view') AS views,
                 count(*) FILTER (WHERE event = 'click') AS clicks,
                 count(*) FILTER (WHERE event = 'skip') AS skips,
                 count(DISTINCT user_id) FILTER (WHERE event = 'view') AS viewers
          FROM ev GROUP BY ad_id
        ) s ON s.ad_id = a.id
        WHERE _ad_id IS NULL OR a.id = _ad_id
      ),
      'series', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'start', b.start, 'views', coalesce(x.views, 0), 'clicks', coalesce(x.clicks, 0)
        ) ORDER BY b.start), '[]'::jsonb)
        FROM generate_series(date_trunc(_unit, _from AT TIME ZONE _tz),
                             (_to AT TIME ZONE _tz) - interval '1 microsecond',
                             ('1 ' || _unit)::interval) AS b(start)
        LEFT JOIN (
          SELECT date_trunc(_unit, created_at AT TIME ZONE _tz) AS start,
                 count(*) FILTER (WHERE event = 'view') AS views,
                 count(*) FILTER (WHERE event = 'click') AS clicks
          FROM ev GROUP BY 1
        ) x ON x.start = b.start
      ),
      'by_country', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'views', views, 'clicks', clicks,
          'ctr', CASE WHEN views = 0 THEN 0 ELSE round(100.0 * clicks / views, 2) END
        ) ORDER BY views DESC, name), '[]'::jsonb)
        FROM (SELECT coalesce(country, 'Inconnu') AS name,
                     count(*) FILTER (WHERE event = 'view') AS views,
                     count(*) FILTER (WHERE event = 'click') AS clicks
              FROM ev GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20) c
      )
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_dashboard(_from timestamp with time zone, _to timestamp with time zone, _bucket text DEFAULT 'day'::text, _tz text DEFAULT 'UTC'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _unit text := CASE WHEN _bucket IN ('hour', 'day', 'week', 'month', 'year') THEN _bucket ELSE 'day' END;
  _len interval;
  _pfrom timestamptz;
BEGIN
  PERFORM public.assert_admin();
  IF _from IS NULL OR _to IS NULL OR _to <= _from THEN
    RAISE EXCEPTION 'invalid_period' USING ERRCODE = '22023';
  END IF;
  IF _to - _from > interval '5 years' THEN
    RAISE EXCEPTION 'period_too_long' USING ERRCODE = '22023';
  END IF;
  _len := _to - _from;
  _pfrom := _from - _len;
  -- Pas plus de ~750 points par courbe.
  IF _unit = 'hour' AND _len > interval '31 days' THEN _unit := 'day'; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = _tz) THEN
    _tz := 'UTC';
  END IF;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', _from, 'to', _to, 'previous_from', _pfrom,
                                 'previous_to', _from, 'bucket', _unit, 'timezone', _tz),
    'current', public.admin_period_kpis(_from, _to),
    'previous', public.admin_period_kpis(_pfrom, _from),

    -- État au moment présent (vrais membres seulement).
    'snapshot', (
      WITH real AS (
        SELECT u.id, u.status, p.gender, p.birth_date, p.country, p.city, p.verified_at,
               p.onboarding_completed_at
        FROM public.users u JOIN public.profiles p ON p.user_id = u.id
        WHERE NOT p.is_virtual
      ), act AS (
        -- Dernière activité de chaque membre dans les 30 jours avant la fin de la période.
        SELECT user_id, max(created_at) AS created_at FROM (
          SELECT user_id, created_at FROM public.auth_events
          WHERE event = 'login' AND user_id IS NOT NULL
            AND created_at > _to - interval '30 days' AND created_at <= _to
          UNION ALL
          SELECT user_id, created_at FROM public.activity_events
          WHERE user_id IS NOT NULL AND created_at > _to - interval '30 days' AND created_at <= _to
          UNION ALL
          SELECT user_id, last_seen_at FROM public.user_activity
          WHERE last_seen_at > _to - interval '30 days' AND last_seen_at <= _to
        ) x GROUP BY user_id
      )
      SELECT jsonb_build_object(
        'members', (SELECT count(*) FROM real),
        'members_active', (SELECT count(*) FROM real WHERE status = 'active'),
        'members_suspended', (SELECT count(*) FROM real WHERE status = 'suspended'),
        'members_banned', (SELECT count(*) FROM real WHERE status = 'disabled'),
        'profiles_complete', (SELECT count(*) FROM real WHERE onboarding_completed_at IS NOT NULL),
        'verified', (SELECT count(*) FROM real WHERE verified_at IS NOT NULL),
        'verifications_pending', (SELECT count(*) FROM public.profile_verifications v WHERE v.status = 'pending'),
        'premium', (SELECT count(*) FROM real WHERE public.is_premium(real.id)),
        'free', (SELECT count(*) FROM real WHERE NOT public.is_premium(real.id)),
        'dau', (SELECT count(*) FROM act JOIN real ON real.id = act.user_id
                WHERE act.created_at > _to - interval '1 day'),
        'wau', (SELECT count(*) FROM act JOIN real ON real.id = act.user_id
                WHERE act.created_at > _to - interval '7 days'),
        'mau', (SELECT count(*) FROM act JOIN real ON real.id = act.user_id),
        'demo_visible', (SELECT count(*) FROM public.profiles p WHERE p.is_virtual AND p.demo_photo_path IS NOT NULL),
        'demo_total', (SELECT count(*) FROM public.profiles p WHERE p.is_virtual),
        'demo_initial', 40,
        'reports_open', (SELECT count(*) FROM public.reports r WHERE r.status IN ('open', 'reviewing')),
        'by_gender', (SELECT coalesce(jsonb_object_agg(coalesce(gender::text, 'unknown'), n), '{}'::jsonb)
                      FROM (SELECT gender, count(*) AS n FROM real GROUP BY gender) g),
        'by_age', (SELECT coalesce(jsonb_agg(jsonb_build_object('band', band, 'n', n) ORDER BY band), '[]'::jsonb)
                   FROM (SELECT CASE
                                  WHEN birth_date IS NULL THEN '?'
                                  WHEN age(birth_date) < interval '25 years' THEN '18-24'
                                  WHEN age(birth_date) < interval '35 years' THEN '25-34'
                                  WHEN age(birth_date) < interval '45 years' THEN '35-44'
                                  WHEN age(birth_date) < interval '55 years' THEN '45-54'
                                  ELSE '55+' END AS band, count(*) AS n
                         FROM real GROUP BY 1) x),
        'by_country', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) ORDER BY n DESC, name), '[]'::jsonb)
                       FROM (SELECT coalesce(country, 'Non précisé') AS name, count(*) AS n FROM real
                             GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 12) x),
        'by_city', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) ORDER BY n DESC, name), '[]'::jsonb)
                    FROM (SELECT coalesce(city, 'Non précisée') AS name, count(*) AS n FROM real
                          GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 12) x)
      )
    ),

    -- Courbes : une valeur par jour / semaine / mois / année de la période
    -- (un seul passage par table, regroupé par tranche).
    'series', (
      WITH b AS (
        SELECT g AS start
        FROM generate_series(date_trunc(_unit, _from AT TIME ZONE _tz),
                             (_to AT TIME ZONE _tz) - interval '1 microsecond', ('1 ' || _unit)::interval) AS g
      ), au AS (
        SELECT date_trunc(_unit, created_at AT TIME ZONE _tz) AS start,
               count(*) FILTER (WHERE event = 'login') AS logins,
               count(*) FILTER (WHERE event = 'signup') AS signups
        FROM public.auth_events
        WHERE event IN ('login', 'signup') AND created_at >= _from AND created_at < _to
        GROUP BY 1
      ), pay AS (
        SELECT date_trunc(_unit, created_at AT TIME ZONE _tz) AS start,
               coalesce(sum(amount) FILTER (WHERE event = 'succeeded'), 0) AS revenue_cents,
               count(*) FILTER (WHERE event = 'created') AS payment_attempts,
               count(*) FILTER (WHERE event = 'succeeded') AS payments_succeeded
        FROM public.payment_events
        WHERE event IN ('created', 'succeeded') AND created_at >= _from AND created_at < _to
        GROUP BY 1
      ), act AS (
        SELECT date_trunc(_unit, e.created_at AT TIME ZONE _tz) AS start,
               count(*) FILTER (WHERE e.event = 'match') AS matches,
               count(*) FILTER (WHERE e.event IN ('message', 'voice_message')) AS messages,
               count(*) FILTER (WHERE e.event = 'report') AS reports
        FROM public.activity_events e
        WHERE e.event IN ('match', 'message', 'voice_message', 'report')
          AND e.created_at >= _from AND e.created_at < _to
          AND NOT EXISTS (SELECT 1 FROM public.profiles v WHERE v.user_id = e.user_id AND v.is_virtual)
        GROUP BY 1
      ), usr AS (
        SELECT start, count(DISTINCT user_id) AS active_users FROM (
          SELECT date_trunc(_unit, created_at AT TIME ZONE _tz) AS start, user_id FROM public.auth_events
          WHERE event = 'login' AND user_id IS NOT NULL AND created_at >= _from AND created_at < _to
          UNION ALL
          SELECT date_trunc(_unit, created_at AT TIME ZONE _tz), user_id FROM public.activity_events
          WHERE user_id IS NOT NULL AND created_at >= _from AND created_at < _to
        ) x
        WHERE NOT EXISTS (SELECT 1 FROM public.profiles v WHERE v.user_id = x.user_id AND v.is_virtual)
        GROUP BY 1
      )
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'start', b.start,
        'logins', coalesce(au.logins, 0),
        'signups', coalesce(au.signups, 0),
        'active_users', coalesce(usr.active_users, 0),
        'revenue_cents', coalesce(pay.revenue_cents, 0),
        'payment_attempts', coalesce(pay.payment_attempts, 0),
        'payments_succeeded', coalesce(pay.payments_succeeded, 0),
        'matches', coalesce(act.matches, 0),
        'messages', coalesce(act.messages, 0),
        'reports', coalesce(act.reports, 0)
      ) ORDER BY b.start), '[]'::jsonb)
      FROM b
      LEFT JOIN au ON au.start = b.start
      LEFT JOIN pay ON pay.start = b.start
      LEFT JOIN act ON act.start = b.start
      LEFT JOIN usr ON usr.start = b.start
    ),

    -- Entonnoir : membres inscrits pendant la période, et jusqu'où ils sont allés.
    'funnel', (
      WITH cohort AS (
        SELECT user_id FROM public.signup_events
        WHERE step = 'account_created' AND created_at >= _from AND created_at < _to
      )
      SELECT jsonb_agg(jsonb_build_object('step', st.step, 'n',
               (SELECT count(*) FROM public.signup_events s JOIN cohort c ON c.user_id = s.user_id WHERE s.step = st.step))
             ORDER BY st.ord)
      FROM (VALUES (1, 'account_created'), (2, 'step_1'), (3, 'step_2'), (4, 'step_3'), (5, 'step_4'),
                   (6, 'profile_completed'), (7, 'verification_requested'), (8, 'verification_approved'))
           AS st(ord, step)
    ),
    -- Inscriptions abandonnées : compte créé il y a plus de 24 h, profil jamais terminé.
    'abandoned_signups', (
      SELECT count(*) FROM public.signup_events s
      WHERE s.step = 'account_created' AND s.created_at >= _from AND s.created_at < _to
        AND s.created_at < now() - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM public.signup_events c WHERE c.user_id = s.user_id AND c.step = 'profile_completed')
    ),
    'revenue_by_product', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('product', product, 'cents', cents, 'n', n) ORDER BY cents DESC), '[]'::jsonb)
      FROM (SELECT coalesce(product, '?') AS product, sum(amount) AS cents, count(*) AS n
            FROM public.payment_events
            WHERE event = 'succeeded' AND created_at >= _from AND created_at < _to
            GROUP BY 1) x
    ),
    'logins_by_country', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n) ORDER BY n DESC, name), '[]'::jsonb)
      FROM (SELECT coalesce(country, '?') AS name, count(*) AS n FROM public.auth_events
            WHERE event = 'login' AND created_at >= _from AND created_at < _to
            GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 12) x
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_list_demo_profiles() RETURNS TABLE(user_id uuid, first_name text, gender public.gender, birth_date date, city text, country text, demo_photo_path text, demo_photo_source text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT p.user_id, p.first_name, p.gender, p.birth_date, p.city, p.country,
         p.demo_photo_path, p.demo_photo_source, p.created_at
  FROM public.profiles p
  WHERE p.is_virtual
  ORDER BY p.gender DESC, p.country, p.first_name;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_list_payments() RETURNS TABLE(id uuid, user_id uuid, email text, type public.payment_type, amount integer, currency text, provider text, status public.payment_status, provider_transaction_id text, created_at timestamp with time zone)
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
CREATE OR REPLACE FUNCTION public.admin_list_pending_photos() RETURNS TABLE(id uuid, user_id uuid, first_name text, storage_path text, created_at timestamp with time zone)
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
CREATE OR REPLACE FUNCTION public.admin_list_pending_verifications() RETURNS TABLE(id uuid, user_id uuid, first_name text, method text, storage_path text, created_at timestamp with time zone)
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
CREATE OR REPLACE FUNCTION public.admin_list_reports(_status text DEFAULT NULL::text) RETURNS TABLE(id uuid, reason public.report_reason, description text, status public.report_status, created_at timestamp with time zone, reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text, reported_status public.account_status, message_id uuid, message_content text)
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
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions() RETURNS TABLE(id uuid, user_id uuid, email text, plan public.subscription_plan, status public.subscription_status, starts_at timestamp with time zone, expires_at timestamp with time zone, active_now boolean)
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
CREATE OR REPLACE FUNCTION public.admin_list_support_tickets() RETURNS TABLE(id uuid, user_id uuid, email text, first_name text, subject text, message text, priority text, status text, admin_reply text, created_at timestamp with time zone)
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
CREATE OR REPLACE FUNCTION public.admin_list_unlocks() RETURNS TABLE(id uuid, conversation_id uuid, paid_by uuid, email text, status public.unlock_status, starts_at timestamp with time zone, expires_at timestamp with time zone, active_now boolean)
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
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _limit integer DEFAULT 50, _offset integer DEFAULT 0) RETURNS TABLE(id uuid, email text, first_name text, status public.account_status, profile_status public.profile_status, created_at timestamp with time zone, premium boolean, is_admin boolean, reports_count bigint)
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
CREATE OR REPLACE FUNCTION public.admin_location_flags(_limit integer DEFAULT 100) RETURNS TABLE(user_id uuid, email text, first_name text, source text, country text, region text, city text, declared_country text, declared_city text, ip_country text, ip_city text, timezone text, language text, inconsistency text[], checked_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT l.user_id, u.email, p.first_name, l.source, l.country, l.region, l.city, p.country, p.city,
         l.ip_country, l.ip_city, l.timezone, l.language, l.inconsistency, l.checked_at
  FROM public.profile_locations l
  JOIN public.users u ON u.id = l.user_id
  LEFT JOIN public.profiles p ON p.user_id = l.user_id
  WHERE l.inconsistent
  ORDER BY l.checked_at DESC NULLS LAST
  LIMIT least(greatest(coalesce(_limit, 100), 1), 1000);
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_log_action(_action text, _target_table text, _target_id text, _details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  PERFORM public.assert_admin();
  INSERT INTO public.admin_audit_log (admin_id, action, target_table, target_id, changes, ip, user_agent)
  VALUES (auth.uid(), left(_action, 100), _target_table, _target_id, coalesce(_details, '{}'::jsonb),
          _ctx ->> 'ip', _ctx ->> 'user_agent');
END; $$;
CREATE OR REPLACE FUNCTION public.admin_members(_search text DEFAULT NULL::text, _status text DEFAULT NULL::text, _kind text DEFAULT 'real'::text, _sort text DEFAULT 'created_at'::text, _desc boolean DEFAULT true, _limit integer DEFAULT 25, _offset integer DEFAULT 0) RETURNS TABLE(user_id uuid, email text, first_name text, gender public.gender, birth_date date, country text, city text, status public.account_status, verified boolean, premium boolean, is_virtual boolean, created_at timestamp with time zone, last_login_at timestamp with time zone, login_count integer, reports_received bigint, total_count bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
#variable_conflict use_column
DECLARE
  _q text := nullif(btrim(coalesce(_search, '')), '');
  _col text := CASE WHEN _sort IN ('created_at', 'last_login_at', 'first_name', 'email', 'country', 'city',
                                   'birth_date', 'login_count', 'reports_received') THEN _sort ELSE 'created_at' END;
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY EXECUTE format($q$
    SELECT * FROM (
      SELECT u.id AS user_id, u.email, p.first_name, p.gender, p.birth_date, p.country, p.city, u.status,
             (p.verified_at IS NOT NULL) AS verified, public.is_premium(u.id) AS premium,
             coalesce(p.is_virtual, false) AS is_virtual, u.created_at,
             a.last_login_at, coalesce(a.login_count, 0) AS login_count,
             (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = u.id) AS reports_received,
             count(*) OVER () AS total_count
      FROM public.users u
      LEFT JOIN public.profiles p ON p.user_id = u.id
      LEFT JOIN public.user_activity a ON a.user_id = u.id
      WHERE ($1 IS NULL OR u.email ILIKE '%%' || $1 || '%%' OR p.first_name ILIKE '%%' || $1 || '%%'
             OR p.city ILIKE '%%' || $1 || '%%' OR p.country ILIKE '%%' || $1 || '%%')
        AND ($2 IS NULL OR u.status::text = $2)
        AND (CASE $3 WHEN 'demo' THEN coalesce(p.is_virtual, false)
                     WHEN 'all' THEN true
                     ELSE NOT coalesce(p.is_virtual, false) END)
    ) t
    ORDER BY %I %s NULLS LAST, user_id
    LIMIT $4 OFFSET $5 $q$, _col, CASE WHEN _desc THEN 'DESC' ELSE 'ASC' END)
  USING _q, nullif(_status, ''), coalesce(_kind, 'real'),
        least(greatest(coalesce(_limit, 25), 1), 5000), greatest(coalesce(_offset, 0), 0);
END;
$_$;
CREATE OR REPLACE FUNCTION public.admin_moderate_photo(_photo_id uuid, _approve boolean, _reason text DEFAULT NULL::text) RETURNS public.photo_status
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
CREATE OR REPLACE FUNCTION public.admin_period_kpis(_from timestamp with time zone, _to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH a AS (
    SELECT event, count(*) AS n FROM public.auth_events
    WHERE created_at >= _from AND created_at < _to GROUP BY event
  ), s AS (
    SELECT step, count(*) AS n FROM public.signup_events
    WHERE created_at >= _from AND created_at < _to GROUP BY step
  ), p AS (
    SELECT event, count(*) AS n, coalesce(sum(amount), 0) AS amount FROM public.payment_events
    WHERE created_at >= _from AND created_at < _to GROUP BY event
  ), act AS (
    -- Actions des vrais membres (un profil de démonstration n'agit jamais, mais par sécurité).
    SELECT e.event, count(*) AS n FROM public.activity_events e
    WHERE e.created_at >= _from AND e.created_at < _to
      AND NOT EXISTS (SELECT 1 FROM public.profiles v WHERE v.user_id = e.user_id AND v.is_virtual)
    GROUP BY e.event
  ), active AS (
    SELECT DISTINCT user_id FROM public.auth_events
    WHERE event = 'login' AND user_id IS NOT NULL AND created_at >= _from AND created_at < _to
    UNION
    SELECT DISTINCT user_id FROM public.activity_events
    WHERE user_id IS NOT NULL AND created_at >= _from AND created_at < _to
  )
  SELECT jsonb_build_object(
    'logins', coalesce((SELECT n FROM a WHERE event = 'login'), 0),
    'failed_logins', coalesce((SELECT n FROM a WHERE event = 'login_failed'), 0),
    'signups', coalesce((SELECT n FROM a WHERE event = 'signup'), 0),
    'active_users', (SELECT count(*) FROM active
                     WHERE NOT EXISTS (SELECT 1 FROM public.profiles v WHERE v.user_id = active.user_id AND v.is_virtual)),
    'profiles_completed', coalesce((SELECT n FROM s WHERE step = 'profile_completed'), 0),
    'verifications_requested', coalesce((SELECT n FROM s WHERE step = 'verification_requested'), 0),
    'verifications_approved', coalesce((SELECT n FROM s WHERE step = 'verification_approved'), 0),
    'verifications_rejected', coalesce((SELECT n FROM s WHERE step = 'verification_rejected'), 0),
    'payment_attempts', coalesce((SELECT n FROM p WHERE event = 'created'), 0),
    'payments_succeeded', coalesce((SELECT n FROM p WHERE event = 'succeeded'), 0),
    'payments_failed', coalesce((SELECT n FROM p WHERE event = 'failed'), 0),
    'payments_cancelled', coalesce((SELECT n FROM p WHERE event = 'cancelled'), 0),
    'revenue_cents', coalesce((SELECT amount FROM p WHERE event = 'succeeded'), 0),
    'likes', coalesce((SELECT n FROM act WHERE event = 'like'), 0),
    'matches', coalesce((SELECT n FROM act WHERE event = 'match'), 0),
    'messages', coalesce((SELECT sum(n) FROM act WHERE event IN ('message', 'voice_message')), 0),
    'contact_requests', coalesce((SELECT sum(n) FROM act WHERE event IN ('contact_request', 'flash_message')), 0),
    'reports', coalesce((SELECT n FROM act WHERE event = 'report'), 0),
    'blocks', coalesce((SELECT n FROM act WHERE event = 'block'), 0),
    'accounts_deleted', coalesce((SELECT n FROM act WHERE event = 'account_deleted'), 0)
  )
$$;
CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(_ticket_id uuid, _reply text, _close boolean DEFAULT false) RETURNS void
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
CREATE OR REPLACE FUNCTION public.admin_resolve_report(_report_id uuid, _status text, _note text DEFAULT NULL::text) RETURNS void
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
CREATE OR REPLACE FUNCTION public.admin_review_verification(_verification_id uuid, _approve boolean) RETURNS text
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
      reviewed_by = auth.uid(),
      decided_at = now(),
      reason = CASE WHEN automatic THEN 'manual' ELSE reason END
  WHERE id = _verification_id AND status = 'pending'
  RETURNING user_id, storage_path INTO _owner, _path;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _approve THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _owner AND verified_at IS NULL;
  END IF;
  PERFORM public.queue_verification_files(_verification_id, 'décision de l''administration');
  RETURN _path;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_set_demo_photo(_user_id uuid, _path text, _source text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _old text;
BEGIN
  PERFORM public.assert_admin();
  SELECT p.demo_photo_path INTO _old FROM public.profiles p
  WHERE p.user_id = _user_id AND p.is_virtual FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demo_profile_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _path IS NOT NULL THEN
    IF _source IS NULL OR _source NOT IN ('generated', 'licensed', 'consent') THEN
      RAISE EXCEPTION 'attestation_required' USING ERRCODE = '22023';
    END IF;
    IF split_part(_path, '/', 1) <> _user_id::text OR char_length(_path) > 300 THEN
      RAISE EXCEPTION 'invalid_path' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.profiles
  SET demo_photo_path = _path,
      demo_photo_source = CASE WHEN _path IS NULL THEN NULL ELSE _source END
  WHERE user_id = _user_id;
  RETURN CASE WHEN _old IS DISTINCT FROM _path THEN _old END;
END; $$;
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _action text, _reason text DEFAULT NULL::text) RETURNS public.account_status
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
CREATE OR REPLACE FUNCTION public.admin_stats() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN (
    WITH real AS (
      SELECT u.* FROM public.users u
      WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual)
    )
    SELECT jsonb_build_object(
      'users_total', (SELECT count(*) FROM real),
      'users_active', (SELECT count(*) FROM real WHERE status = 'active'),
      'users_suspended', (SELECT count(*) FROM real WHERE status = 'suspended'),
      'users_banned', (SELECT count(*) FROM real WHERE status = 'disabled'),
      'users_new_7d', (SELECT count(*) FROM real WHERE created_at > now() - interval '7 days'),
      'profiles_complete', (SELECT count(*) FROM public.profiles
                            WHERE onboarding_completed_at IS NOT NULL AND NOT is_virtual),
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
    )
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid) RETURNS jsonb
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
CREATE OR REPLACE FUNCTION public.admin_user_history(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'connections', (SELECT coalesce(jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.auth_events WHERE user_id = _user_id
                          ORDER BY created_at DESC LIMIT 100) e),
    'signup', (SELECT coalesce(jsonb_agg(jsonb_build_object('step', step, 'at', created_at) ORDER BY created_at), '[]'::jsonb)
               FROM public.signup_events WHERE user_id = _user_id),
    'payments', (SELECT coalesce(jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at DESC), '[]'::jsonb)
                 FROM (SELECT * FROM public.payment_events WHERE user_id = _user_id
                       ORDER BY created_at DESC LIMIT 100) e),
    'activity_counts', (SELECT coalesce(jsonb_object_agg(event, n), '{}'::jsonb)
                        FROM (SELECT event, count(*) AS n FROM public.activity_events
                              WHERE user_id = _user_id GROUP BY event) x),
    'activity', (SELECT coalesce(jsonb_agg(to_jsonb(e) - 'user_id' ORDER BY e.created_at DESC), '[]'::jsonb)
                 FROM (SELECT * FROM public.activity_events WHERE user_id = _user_id
                       ORDER BY created_at DESC LIMIT 50) e),
    'verifications', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                         'id', v.id, 'method', v.method, 'status', v.status, 'created_at', v.created_at,
                         'reviewed_at', v.reviewed_at, 'storage_path', v.storage_path) ORDER BY v.created_at DESC), '[]'::jsonb)
                      FROM public.profile_verifications v WHERE v.user_id = _user_id),
    'audit', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                 'action', l.action, 'table', l.target_table, 'changes', l.changes, 'at', l.created_at,
                 'admin', (SELECT u.email FROM public.users u WHERE u.id = l.admin_id)) ORDER BY l.created_at DESC), '[]'::jsonb)
              FROM (SELECT * FROM public.admin_audit_log WHERE target_id = _user_id::text
                    ORDER BY created_at DESC LIMIT 50) l)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_user_location(_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'current', (SELECT to_jsonb(l) - 'user_id' FROM public.profile_locations l WHERE l.user_id = _user_id),
    'declared', (SELECT jsonb_build_object('country', p.country, 'region', p.region, 'city', p.city)
                 FROM public.profiles p WHERE p.user_id = _user_id),
    'history', (SELECT coalesce(jsonb_agg(to_jsonb(h) - 'user_id' ORDER BY h.created_at DESC), '[]'::jsonb)
                FROM (SELECT * FROM public.location_history WHERE user_id = _user_id
                      ORDER BY created_at DESC LIMIT 30) h)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_verification_queue() RETURNS TABLE(id uuid, user_id uuid, first_name text, method text, document_type text, reason text, engine text, profile_similarity numeric, document_similarity numeric, liveness_similarity numeric, liveness_shift numeric, challenge text, storage_path text, challenge_path text, document_path text, details jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, v.user_id, p.first_name, v.method, v.document_type, v.reason, v.engine,
         v.profile_similarity, v.document_similarity, v.liveness_similarity, v.liveness_shift,
         v.challenge, v.storage_path, v.challenge_path, v.document_path, v.details, v.created_at
  FROM public.profile_verifications v LEFT JOIN public.profiles p ON p.user_id = v.user_id
  WHERE v.status = 'pending'
  ORDER BY v.created_at
  LIMIT 200;
END;
$$;
CREATE OR REPLACE FUNCTION public.ai_usage_day() RETURNS date
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT (now() AT TIME ZONE 'UTC')::date
$$;
CREATE OR REPLACE FUNCTION public.assert_admin() RETURNS void
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.audit_admin_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
CREATE OR REPLACE FUNCTION public.auth_method(_provider text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE lower(coalesce(_provider, '')) WHEN 'email' THEN 'email' WHEN 'google' THEN 'google'
              ELSE 'other' END
$$;
CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid) RETURNS boolean
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
CREATE OR REPLACE FUNCTION public.can_browse_profiles() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid() AND u.status = 'active' AND p.status IN ('active', 'hidden')
      AND p.verified_at IS NOT NULL
  )
$$;
CREATE OR REPLACE FUNCTION public.can_view_profile(_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL AND _other IS NOT NULL AND _other <> auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(_other)
    AND NOT public.is_blocked_between(auth.uid(), _other)
$$;
CREATE OR REPLACE FUNCTION public.cancel_contact_request(_request_id uuid) RETURNS jsonb
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
CREATE OR REPLACE FUNCTION public.check_profile_personal_info() RETURNS trigger
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
CREATE OR REPLACE FUNCTION public.check_profile_visibility() RETURNS trigger
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
CREATE OR REPLACE FUNCTION public.clear_my_location() RETURNS void
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
CREATE OR REPLACE FUNCTION public.clear_profile_coordinates() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.latitude := NULL;
  NEW.longitude := NULL;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.compatibility_breakdown(_me uuid, _other uuid) RETURNS jsonb
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
CREATE OR REPLACE FUNCTION public.confirm_payment(_payment_id uuid, _provider text, _provider_transaction_id text, _amount integer, _currency text) RETURNS public.payment_status
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
CREATE OR REPLACE FUNCTION public.consume_ai_quota(_feature text DEFAULT 'roi_salomon'::text) RETURNS jsonb
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
CREATE OR REPLACE FUNCTION public.consume_free_message(_conversation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ DECLARE _uid uuid := auth.uid(); _used smallint; _premium boolean; _unlocked boolean; _status public.conversation_status; BEGIN IF _uid IS NULL THEN RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated'); END IF; IF NOT public.is_conversation_participant(_conversation_id, _uid) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_participant'); END IF; SELECT status INTO _status FROM public.conversations WHERE id = _conversation_id; IF _status = 'closed' THEN RETURN jsonb_build_object('allowed', false, 'reason', 'conversation_closed'); END IF; _premium := public.is_premium(_uid); _unlocked := public.has_active_conversation_unlock(_conversation_id); IF _premium OR _unlocked THEN RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'premium', _premium, 'unlocked', _unlocked); END IF; INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used) VALUES (_conversation_id, _uid, 0) ON CONFLICT (conversation_id, user_id) DO NOTHING; SELECT free_messages_used INTO _used FROM public.conversation_user_usage WHERE conversation_id = _conversation_id AND user_id = _uid FOR UPDATE; IF _used >= 3 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'free_limit_reached', 'used', _used, 'limit', 3); END IF; UPDATE public.conversation_user_usage SET free_messages_used = free_messages_used + 1 WHERE conversation_id = _conversation_id AND user_id = _uid RETURNING free_messages_used INTO _used; UPDATE public.conversations SET free_messages_used = LEAST(free_messages_used + 1, 32767) WHERE id = _conversation_id; RETURN jsonb_build_object('allowed', true, 'used', _used, 'limit', 3, 'unlimited', false); END; $$;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;
