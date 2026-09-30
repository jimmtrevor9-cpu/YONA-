-- Phase 23 — Administration (/admin).
-- Rôles USER / ADMIN : table `user_roles` et `is_admin()` existants (phase 0).
-- Toutes les fonctions ci-dessous vérifient `is_admin()` côté serveur : la page /admin
-- n'est qu'un affichage. Chaque action de modération est tracée dans
-- `moderation_actions` (qui, quoi, quand, pourquoi).
-- 23.3 / 23.4 — `admin_stats()` : chiffres du tableau de bord.
-- 23.5 / 23.6 — `admin_list_users(...)`, `admin_user_detail(_user_id)`.
-- 23.7 à 23.9 — `admin_set_user_status(_user_id, _action, _reason)` : suspendre,
--        réactiver, bannir (le blocage de la connexion est ajouté par la fonction
--        serveur avec le rôle service). Impossible sur soi-même ou un autre admin.
-- 23.10 / 23.11 — `admin_list_reports(_status)`, `admin_resolve_report(...)`.
-- Modération des photos : `admin_list_pending_photos()`, `admin_moderate_photo(...)`.
-- 23.12 à 23.14 — `admin_list_payments()`, `admin_list_subscriptions()`,
--        `admin_list_unlocks()`.
-- Support (phase 15.16) : `admin_list_support_tickets()`, `admin_reply_support_ticket(...)`.

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO authenticated, service_role;

-- 23.3 / 23.4 — Tableau de bord.
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated, service_role;

-- 23.5 — Utilisateurs (recherche par e-mail ou prénom, filtre par statut).
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, email text, first_name text, status public.account_status,
  profile_status public.profile_status, created_at timestamptz, premium boolean,
  is_admin boolean, reports_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated, service_role;

-- 23.6 — Détail d'un utilisateur.
CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated, service_role;

-- 23.7 à 23.9 — Suspendre, réactiver, bannir.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS public.account_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text, text) TO authenticated, service_role;

-- 23.10 — Signalements.
CREATE OR REPLACE FUNCTION public.admin_list_reports(_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid, reason public.report_reason, description text, status public.report_status,
  created_at timestamptz, reporter_id uuid, reporter_name text, reported_user_id uuid,
  reported_name text, reported_status public.account_status, message_id uuid, message_content text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated, service_role;

-- 23.11 — Traiter un signalement (résolu ou rejeté), avec une note.
CREATE OR REPLACE FUNCTION public.admin_resolve_report(_report_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated, service_role;

-- Modération des photos (« en attente » depuis la phase 1).
CREATE OR REPLACE FUNCTION public.admin_list_pending_photos()
RETURNS TABLE (id uuid, user_id uuid, first_name text, storage_path text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_pending_photos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_photos() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_moderate_photo(_photo_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS public.photo_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_moderate_photo(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_photo(uuid, boolean, text) TO authenticated, service_role;

-- 23.12 — Paiements.
CREATE OR REPLACE FUNCTION public.admin_list_payments()
RETURNS TABLE (
  id uuid, user_id uuid, email text, type public.payment_type, amount integer, currency text,
  provider text, status public.payment_status, provider_transaction_id text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_payments() TO authenticated, service_role;

-- 23.13 — Abonnements.
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  id uuid, user_id uuid, email text, plan public.subscription_plan,
  status public.subscription_status, starts_at timestamptz, expires_at timestamptz, active_now boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated, service_role;

-- 23.14 — Déblocages de conversation.
CREATE OR REPLACE FUNCTION public.admin_list_unlocks()
RETURNS TABLE (
  id uuid, conversation_id uuid, paid_by uuid, email text, status public.unlock_status,
  starts_at timestamptz, expires_at timestamptz, active_now boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_unlocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_unlocks() TO authenticated, service_role;

-- Support : demandes (prioritaires d'abord) et réponse.
CREATE OR REPLACE FUNCTION public.admin_list_support_tickets()
RETURNS TABLE (
  id uuid, user_id uuid, email text, first_name text, subject text, message text,
  priority text, status text, admin_reply text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_list_support_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_support_tickets() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(_ticket_id uuid, _reply text, _close boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.admin_reply_support_ticket(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_ticket(uuid, text, boolean) TO authenticated, service_role;
