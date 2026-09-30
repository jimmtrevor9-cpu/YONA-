-- Phase 19 — Notifications.
-- 19.1 — Table `notifications` (destinataire, type, auteur, données), lecture limitée au
--        destinataire, aucune écriture directe. `create_notification` (interne) crée ou
--        regroupe une notification ; elle ignore les membres bloqués entre eux.
-- 19.2 à 19.7 — Déclencheurs : Like reçu, Match (les deux membres), nouveau message
--        (regroupé par conversation tant qu'il n'est pas lu), ajout en favori, visite du
--        profil, demande de contact (Flash compris).
-- 19.8 — `get_unread_notification_count()`.
-- 19.9 — `mark_notification_read(_id)` et `mark_all_notifications_read()`.
-- Confidentialité : pour « favori » et « visite », l'auteur n'est révélé qu'aux membres
-- Premium (même règle que les pages Favoris et Visiteurs) — `list_notifications`.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'match', 'message', 'favorite', 'visit', 'contact_request')),
  actor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;

-- Préférence de notification (remplacée en phase 20 par les réglages du membre).
CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- Crée une notification ; `_group_key` : une notification non lue de même type et même
-- clé est rafraîchie (compteur + date) au lieu d'en créer une nouvelle.
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _type text, _actor_id uuid, _data jsonb, _group_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- 19.2 — Like reçu (pas les « Pass »).
CREATE OR REPLACE FUNCTION public.notify_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'like' AND NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.receiver_id, 'like', NEW.sender_id, '{}'::jsonb,
      'like:' || NEW.sender_id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS likes_notify ON public.likes;
CREATE TRIGGER likes_notify AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_like();

-- 19.3 — Match : les deux membres sont prévenus.
CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.user_1_id, 'match', NEW.user_2_id,
      jsonb_build_object('match_id', NEW.id));
    PERFORM public.create_notification(NEW.user_2_id, 'match', NEW.user_1_id,
      jsonb_build_object('match_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS matches_notify ON public.matches;
CREATE TRIGGER matches_notify AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_match();

-- 19.4 — Nouveau message livré (regroupé par conversation).
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
DROP TRIGGER IF EXISTS messages_notify ON public.messages;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- 19.5 — Ajout en favori.
CREATE OR REPLACE FUNCTION public.notify_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.favorite_user_id, 'favorite', NEW.user_id, '{}'::jsonb,
    'favorite:' || NEW.user_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS favorites_notify ON public.favorites;
CREATE TRIGGER favorites_notify AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.notify_favorite();

-- 19.6 — Visite du profil (les visites sont déjà limitées contre le spam).
CREATE OR REPLACE FUNCTION public.notify_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.visited_user_id, 'visit', NEW.visitor_id, '{}'::jsonb,
    'visit:' || NEW.visitor_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_visits_notify ON public.profile_visits;
CREATE TRIGGER profile_visits_notify AFTER INSERT ON public.profile_visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_visit();

-- 19.7 — Demande de contact (et Message Flash).
CREATE OR REPLACE FUNCTION public.notify_contact_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.receiver_id, 'contact_request', NEW.sender_id,
    jsonb_build_object('request_id', NEW.id, 'is_flash', NEW.is_flash));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_requests_notify ON public.contact_requests;
CREATE TRIGGER contact_requests_notify AFTER INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();

REVOKE ALL ON FUNCTION public.notify_like(), public.notify_match(), public.notify_message(),
  public.notify_favorite(), public.notify_visit(), public.notify_contact_request()
  FROM PUBLIC, anon, authenticated;

-- Liste des notifications de la personne connectée (auteur masqué si nécessaire).
CREATE OR REPLACE FUNCTION public.list_notifications(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  type text,
  actor_id uuid,
  actor_first_name text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.list_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_notifications(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.notifications n
  WHERE n.user_id = auth.uid() AND n.read_at IS NULL
    AND (n.actor_id IS NULL OR NOT public.is_blocked_between(auth.uid(), n.actor_id))
$$;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;
