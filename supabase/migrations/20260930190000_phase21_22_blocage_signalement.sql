-- Phases 21 et 22 — Blocage et signalement.
--
-- Déjà en place : table `blocks` et `is_blocked_between`, appliqués à Découvrir, la
-- Recherche, les profils, les photos, les demandes de contact et l'envoi de messages.
-- 21.1 / 21.2 — `block_user(_user_id)` enregistre le blocage (idempotent) et, en même
--        temps : Match et conversation fermés (« bloqué »), demandes en attente annulées,
--        favoris retirés dans les deux sens.
-- 21.3 — Masquer : les listes (Matches, messages, favoris, visiteurs, notifications)
--        ignorent les membres bloqués ; `list_blocked_users` pour les Paramètres.
-- 21.4 / 21.5 — Interactions et messagerie : Like, favori, visite, demande et message
--        refusés entre membres bloqués (contrôles serveur ci-dessous et existants).
--        `unblock_user` retire le blocage (le Match fermé n'est pas rouvert).
-- 22.1 à 22.5 — `report_user(_user_id, _reason, _description, _message_id)` : profil ou
--        message, motif obligatoire (liste fermée), description facultative (2 000
--        caractères), enregistré « ouvert » pour la modération. Le message signalé doit
--        venir de la personne signalée, dans une conversation du signaleur. 10
--        signalements par jour au plus ; un signalement identique encore ouvert n'est
--        pas dupliqué. L'écriture directe dans `reports` est retirée.

-- ============================================================
-- Phase 21 — Blocage
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = _user_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated, service_role;

-- Les membres que j'ai bloqués (prénom seulement), pour les débloquer.
CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (user_id uuid, first_name text, blocked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_id, p.first_name, b.created_at
  FROM public.blocks b
  LEFT JOIN public.profiles p ON p.user_id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_blocked_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_blocked_users() TO authenticated, service_role;

-- 21.4 : favoris et visites refusés entre membres bloqués (défense en profondeur :
-- les profils bloqués ne sont déjà plus visibles).
CREATE OR REPLACE FUNCTION public.refuse_blocked_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.refuse_blocked_interaction() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS favorites_refuse_blocked ON public.favorites;
CREATE TRIGGER favorites_refuse_blocked BEFORE INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
DROP TRIGGER IF EXISTS profile_visits_refuse_blocked ON public.profile_visits;
CREATE TRIGGER profile_visits_refuse_blocked BEFORE INSERT ON public.profile_visits
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
DROP TRIGGER IF EXISTS likes_refuse_blocked ON public.likes;
CREATE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

-- ============================================================
-- Phase 22 — Signalement
-- ============================================================
DROP POLICY IF EXISTS reports_insert_own ON public.reports;
REVOKE INSERT, UPDATE, DELETE ON public.reports FROM anon, authenticated;
GRANT SELECT ON public.reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_user(
  _user_id uuid,
  _reason public.report_reason,
  _description text DEFAULT NULL,
  _message_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.report_user(uuid, public.report_reason, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, public.report_reason, text, uuid) TO authenticated, service_role;
