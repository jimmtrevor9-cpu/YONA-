-- ============================================================
-- Tableau de bord de l'administration (tâche D2)
--
-- 1. admin_dashboard(_from, _to, _bucket, _tz) : indicateurs d'une période (jour, semaine,
--    mois, année ou plage libre) comparés à la période précédente de même durée ;
--    courbes par jour / semaine / mois / année ; entonnoir d'inscription (membres
--    inscrits pendant la période) ; DAU / WAU / MAU ; gratuits / Premium ; revenus par
--    produit ; répartition par pays, ville, sexe et âge ; profils de démonstration
--    restants. Les profils de démonstration ne comptent jamais comme vrais membres.
-- 2. admin_members(...) : tableau des membres (recherche, filtre, tri, pages).
-- 3. admin_user_history(_user_id) : historique complet d'un membre.
-- 4. admin_stats : ne compte plus les profils de démonstration.
-- 5. Nombre de connexions et dernière connexion de chaque membre, tenus à jour.
-- Toutes revérifient le rôle administrateur (assert_admin). Rejouable.
-- ============================================================

-- Vrai membre : compte qui n'est pas un profil de démonstration.
CREATE OR REPLACE FUNCTION public.is_real_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.is_virtual)
$$;
REVOKE ALL ON FUNCTION public.is_real_member(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_real_member(uuid) TO service_role;

-- Nombre de connexions et dernière connexion de chaque membre (colonnes jusqu'ici jamais
-- remplies) : mis à jour à chaque connexion inscrite au journal, puis rattrapage du passé.
CREATE OR REPLACE FUNCTION public.count_member_login()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_activity AS a (user_id, last_login_at, login_count)
  SELECT NEW.user_id, NEW.created_at, 1
  WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET login_count = a.login_count + 1,
        last_login_at = greatest(a.last_login_at, EXCLUDED.last_login_at);
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.count_member_login() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS auth_events_count_login ON public.auth_events;
CREATE TRIGGER auth_events_count_login
AFTER INSERT ON public.auth_events
FOR EACH ROW WHEN (NEW.event = 'login' AND NEW.user_id IS NOT NULL)
EXECUTE FUNCTION public.count_member_login();

UPDATE public.user_activity a
SET login_count = greatest(a.login_count, x.n),
    last_login_at = greatest(a.last_login_at, x.last_at)
FROM (SELECT user_id, count(*)::integer AS n, max(created_at) AS last_at
      FROM public.auth_events WHERE event = 'login' AND user_id IS NOT NULL GROUP BY user_id) x
WHERE a.user_id = x.user_id
  AND (a.login_count < x.n OR a.last_login_at IS DISTINCT FROM greatest(a.last_login_at, x.last_at));

-- Indicateurs d'une période [_from, _to[ (fonction interne).
CREATE OR REPLACE FUNCTION public.admin_period_kpis(_from timestamptz, _to timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.admin_period_kpis(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_period_kpis(timestamptz, timestamptz) TO service_role;

-- _bucket : hour, day, week, month ou year (taille d'un point des courbes).
-- _tz : fuseau horaire de l'administrateur (ex. Africa/Libreville) pour découper les jours.
DROP FUNCTION IF EXISTS public.admin_dashboard(timestamptz, timestamptz, text);
CREATE OR REPLACE FUNCTION public.admin_dashboard(_from timestamptz, _to timestamptz,
                                                  _bucket text DEFAULT 'day', _tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.admin_dashboard(timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard(timestamptz, timestamptz, text, text) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Tableau des membres (vrais membres ; profils de démonstration à part)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_members(
  _search text DEFAULT NULL, _status text DEFAULT NULL, _kind text DEFAULT 'real',
  _sort text DEFAULT 'created_at', _desc boolean DEFAULT true,
  _limit integer DEFAULT 25, _offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid, email text, first_name text, gender public.gender, birth_date date,
  country text, city text, status public.account_status, verified boolean, premium boolean,
  is_virtual boolean, created_at timestamptz, last_login_at timestamptz, login_count integer,
  reports_received bigint, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
$$;
REVOKE ALL ON FUNCTION public.admin_members(text, text, text, text, boolean, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_members(text, text, text, text, boolean, integer, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Historique complet d'un membre
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_history(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.admin_user_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_history(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Chiffres clés : sans les profils de démonstration
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated, service_role;
