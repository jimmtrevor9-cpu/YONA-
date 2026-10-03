-- ============================================================
-- Publicités sponsorisées (tâche D3)
--
-- Règle stricte, appliquée ici, côté base : une publicité n'est JAMAIS envoyée à un
-- membre Premium (abonnement actif), à un administrateur, à un profil de démonstration
-- ni à un compte suspendu. Seuls les membres gratuits la reçoivent ; dès qu'un membre
-- devient Premium, get_ads_for_me ne lui renvoie plus rien.
--
-- 1. ad_settings : une publicité toutes les N cartes (Découvrir) ou N lignes (listes).
-- 2. ads : les publicités (média image ou vidéo, texte, bouton, lien https, emplacements,
--    dates, ciblage pays / sexe / âge, priorité, plafond de vues par membre et par jour).
-- 3. ad_events : vues, clics et « Passer » (pays du membre, jamais de traceur tiers).
-- 4. Espace de fichiers public « ads » (images JPEG/PNG/WebP, vidéos MP4/WebM, 15 Mo max),
--    écriture réservée aux administrateurs ; médias remplacés ou supprimés mis en file
--    de suppression.
-- 5. get_ads_for_me, record_ad_event, admin_ad_stats.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Réglages
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  discover_every integer NOT NULL DEFAULT 5 CHECK (discover_every BETWEEN 2 AND 50),
  list_every integer NOT NULL DEFAULT 6 CHECK (list_every BETWEEN 2 AND 50),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ad_settings IS
  'Publicités : une toutes les N cartes de Découvrir (discover_every), une toutes les N lignes des listes (list_every).';
INSERT INTO public.ad_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Publicités
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 90),
  body text CHECK (body IS NULL OR char_length(body) <= 300),
  advertiser text CHECK (advertiser IS NULL OR char_length(advertiser) <= 40),
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  -- Fichiers dans l'espace « ads », rangés dans le dossier de la publicité : <id>/<nom>.
  media_path text NOT NULL CHECK (media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  poster_path text CHECK (poster_path IS NULL OR poster_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'),
  cta_label text NOT NULL DEFAULT 'En savoir plus' CHECK (char_length(btrim(cta_label)) BETWEEN 1 AND 24),
  -- Lien de destination : https uniquement (jamais javascript:, data:…).
  cta_url text NOT NULL CHECK (cta_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'
                               AND char_length(cta_url) <= 500),
  cta_icon text NOT NULL DEFAULT 'external' CHECK (cta_icon IN ('external', 'message', 'phone')),
  placements text[] NOT NULL DEFAULT ARRAY['discover']::text[]
    CHECK (cardinality(placements) >= 1 AND placements <@ ARRAY['discover', 'matches', 'messages']::text[]),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  target_countries text[] NOT NULL DEFAULT '{}'::text[],
  target_gender public.gender,
  min_age integer CHECK (min_age IS NULL OR min_age BETWEEN 18 AND 99),
  max_age integer CHECK (max_age IS NULL OR max_age BETWEEN 18 AND 99),
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
  daily_cap integer NOT NULL DEFAULT 3 CHECK (daily_cap BETWEEN 1 AND 50),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ads_dates_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT ads_ages_check CHECK (min_age IS NULL OR max_age IS NULL OR min_age <= max_age),
  CONSTRAINT ads_media_folder_check CHECK (
    split_part(media_path, '/', 1) = id::text
    AND (poster_path IS NULL OR split_part(poster_path, '/', 1) = id::text))
);
COMMENT ON TABLE public.ads IS
  'Publicités sponsorisées, montrées uniquement aux membres gratuits (get_ads_for_me).';
CREATE INDEX IF NOT EXISTS ads_live_idx ON public.ads (status, starts_at) WHERE status = 'active';

DROP TRIGGER IF EXISTS ads_set_updated_at ON public.ads;
CREATE TRIGGER ads_set_updated_at BEFORE UPDATE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS ad_settings_set_updated_at ON public.ad_settings;
CREATE TRIGGER ad_settings_set_updated_at BEFORE UPDATE ON public.ad_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 3. Vues, clics, « Passer »
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ad_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ad_id uuid NOT NULL REFERENCES public.ads (id) ON DELETE CASCADE,
  -- Compte supprimé : la statistique reste, le lien avec la personne disparaît.
  user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  event text NOT NULL CHECK (event IN ('view', 'click', 'skip')),
  placement text NOT NULL CHECK (placement IN ('discover', 'matches', 'messages')),
  country text CHECK (country IS NULL OR char_length(country) <= 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.ad_events IS 'Journal des publicités : vues, clics et « Passer ».';
CREATE INDEX IF NOT EXISTS ad_events_ad_idx ON public.ad_events (ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_user_idx ON public.ad_events (user_id, ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_created_idx ON public.ad_events (created_at DESC);

-- ------------------------------------------------------------
-- Règles d'accès : tout est réservé aux administrateurs ; les membres passent par les
-- fonctions ci-dessous, qui appliquent la règle « gratuits seulement ».
-- ------------------------------------------------------------
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_settings_admin_select ON public.ad_settings;
CREATE POLICY ad_settings_admin_select ON public.ad_settings FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS ad_settings_admin_update ON public.ad_settings;
CREATE POLICY ad_settings_admin_update ON public.ad_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS ads_admin_select ON public.ads;
CREATE POLICY ads_admin_select ON public.ads FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS ads_admin_insert ON public.ads;
CREATE POLICY ads_admin_insert ON public.ads FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS ads_admin_update ON public.ads;
CREATE POLICY ads_admin_update ON public.ads FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS ads_admin_delete ON public.ads;
CREATE POLICY ads_admin_delete ON public.ads FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS ad_events_admin_select ON public.ad_events;
CREATE POLICY ad_events_admin_select ON public.ad_events FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON public.ad_settings, public.ads, public.ad_events FROM anon;
GRANT SELECT, UPDATE ON public.ad_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ads TO authenticated;
GRANT SELECT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_settings, public.ads, public.ad_events TO service_role;
REVOKE ALL ON SEQUENCE public.ad_events_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ad_events_id_seq TO service_role;

-- Modifications faites par un administrateur : journal d'audit (tâche D1).
DROP TRIGGER IF EXISTS ads_audit_admin ON public.ads;
CREATE TRIGGER ads_audit_admin AFTER INSERT OR UPDATE OR DELETE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
DROP TRIGGER IF EXISTS ad_settings_audit_admin ON public.ad_settings;
CREATE TRIGGER ad_settings_audit_admin AFTER UPDATE ON public.ad_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

-- ------------------------------------------------------------
-- 4. Fichiers des publicités
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ads', 'ads', true, 15728640,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS ads_storage_select_admin ON storage.objects;
CREATE POLICY ads_storage_select_admin ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'ads' AND public.is_admin());
DROP POLICY IF EXISTS ads_storage_insert_admin ON storage.objects;
CREATE POLICY ads_storage_insert_admin ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ads' AND public.is_admin());
DROP POLICY IF EXISTS ads_storage_update_admin ON storage.objects;
CREATE POLICY ads_storage_update_admin ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ads' AND public.is_admin())
  WITH CHECK (bucket_id = 'ads' AND public.is_admin());
DROP POLICY IF EXISTS ads_storage_delete_admin ON storage.objects;
CREATE POLICY ads_storage_delete_admin ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ads' AND public.is_admin());

-- Média remplacé ou publicité supprimée : l'ancien fichier part dans la file de suppression.
CREATE OR REPLACE FUNCTION public.queue_ad_media_cleanup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
    SELECT 'ads', p, 'publicité supprimée'
    FROM unnest(ARRAY[OLD.media_path, OLD.poster_path]) AS p WHERE p IS NOT NULL;
    RETURN OLD;
  END IF;
  INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
  SELECT 'ads', p, 'média de publicité remplacé'
  FROM unnest(ARRAY[
         CASE WHEN OLD.media_path IS DISTINCT FROM NEW.media_path THEN OLD.media_path END,
         CASE WHEN OLD.poster_path IS DISTINCT FROM NEW.poster_path THEN OLD.poster_path END]) AS p
  WHERE p IS NOT NULL;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.queue_ad_media_cleanup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS ads_queue_media_cleanup ON public.ads;
CREATE TRIGGER ads_queue_media_cleanup AFTER UPDATE OF media_path, poster_path OR DELETE ON public.ads
FOR EACH ROW EXECUTE FUNCTION public.queue_ad_media_cleanup();

-- ------------------------------------------------------------
-- 5. Fonctions
-- ------------------------------------------------------------

-- Publicités à montrer au membre connecté pour un emplacement. Vide pour un membre
-- Premium, un administrateur, un profil de démonstration ou un compte inactif.
CREATE OR REPLACE FUNCTION public.get_ads_for_me(_placement text DEFAULT 'discover', _limit integer DEFAULT 3)
RETURNS TABLE (
  id uuid, title text, body text, advertiser text, media_type text, media_path text,
  poster_path text, cta_label text, cta_url text, cta_icon text, every_n integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  _me uuid := auth.uid();
  _gender public.gender;
  _birth date;
  _virtual boolean;
  _age integer;
  _country text;
  _every integer;
BEGIN
  IF _me IS NULL OR _placement IS NULL OR _placement NOT IN ('discover', 'matches', 'messages') THEN
    RETURN;
  END IF;
  IF public.is_premium(_me) OR public.has_role(_me, 'admin') OR NOT public.is_active_account(_me) THEN
    RETURN;
  END IF;
  SELECT p.gender, p.birth_date, p.is_virtual INTO _gender, _birth, _virtual
  FROM public.profiles p WHERE p.user_id = _me;
  IF NOT FOUND OR _virtual THEN
    RETURN;
  END IF;
  _age := CASE WHEN _birth IS NULL THEN NULL ELSE extract(year FROM age(_birth))::integer END;
  _country := public.member_country(_me);
  SELECT CASE WHEN _placement = 'discover' THEN s.discover_every ELSE s.list_every END
  INTO _every FROM public.ad_settings s WHERE s.id;

  RETURN QUERY
  SELECT a.id, a.title, a.body, a.advertiser, a.media_type, a.media_path, a.poster_path,
         a.cta_label, a.cta_url, a.cta_icon, coalesce(_every, 5)
  FROM public.ads a
  CROSS JOIN LATERAL (
    SELECT count(*) AS n FROM public.ad_events e
    WHERE e.user_id = _me AND e.ad_id = a.id AND e.event = 'view'
      AND e.created_at > now() - interval '24 hours'
  ) v
  WHERE a.status = 'active' AND a.starts_at <= now() AND (a.ends_at IS NULL OR a.ends_at > now())
    AND _placement = ANY (a.placements)
    AND (cardinality(a.target_countries) = 0 OR _country = ANY (a.target_countries))
    AND (a.target_gender IS NULL OR a.target_gender = _gender)
    AND (a.min_age IS NULL OR _age >= a.min_age)
    AND (a.max_age IS NULL OR _age <= a.max_age)
    AND v.n < a.daily_cap
  ORDER BY a.priority DESC, v.n, random()
  LIMIT least(greatest(coalesce(_limit, 3), 1), 10);
END;
$$;
REVOKE ALL ON FUNCTION public.get_ads_for_me(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ads_for_me(text, integer) TO authenticated, service_role;

-- Vue, clic ou « Passer » du membre connecté. Une même action ne compte qu'une fois par
-- membre et par publicité toutes les 5 minutes (statistiques non gonflées).
CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _event text, _placement text DEFAULT 'discover')
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _country text;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _event IS NULL OR _event NOT IN ('view', 'click', 'skip')
     OR _placement IS NULL OR _placement NOT IN ('discover', 'matches', 'messages') THEN
    RAISE EXCEPTION 'invalid_event' USING ERRCODE = '22023';
  END IF;
  -- Un membre Premium ou un administrateur ne reçoit pas de publicité : rien à compter.
  IF public.is_premium(_me) OR public.has_role(_me, 'admin') THEN
    RETURN false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ads a WHERE a.id = _ad_id AND a.status = 'active') THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ad_events e
             WHERE e.user_id = _me AND e.ad_id = _ad_id AND e.event = _event
               AND e.created_at > now() - interval '5 minutes') THEN
    RETURN false;
  END IF;
  _country := coalesce(
    public.member_country(_me),
    (SELECT g.name FROM public.geo_countries g WHERE g.code = upper(public.request_context() ->> 'country')));
  INSERT INTO public.ad_events (ad_id, user_id, event, placement, country)
  VALUES (_ad_id, _me, _event, _placement, left(_country, 80));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_ad_event(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ad_event(uuid, text, text) TO authenticated, service_role;

-- Statistiques des publicités (administration) : par publicité, par tranche de temps et
-- par pays, sur une période. _ad_id NULL = toutes les publicités.
CREATE OR REPLACE FUNCTION public.admin_ad_stats(_ad_id uuid, _from timestamptz, _to timestamptz,
                                                 _bucket text DEFAULT 'day', _tz text DEFAULT 'UTC')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
REVOKE ALL ON FUNCTION public.admin_ad_stats(uuid, timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ad_stats(uuid, timestamptz, timestamptz, text, text) TO authenticated, service_role;
