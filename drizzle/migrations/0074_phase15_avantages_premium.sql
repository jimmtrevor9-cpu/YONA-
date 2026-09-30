-- Phase 15 — Avantages Premium.
--
-- Déjà en place (vérifié, rien à refaire) :
--   15.1 demandes illimitées (phase 12), 15.2 Roi Salomon illimité (phase 13),
--   15.3 favoris entrants (phase 8), 15.4 visiteurs (phase 9), 15.8 présence (phase 10),
--   15.13 filtres avancés (phase 11), 15.15 badge (phase 14).
--   15.9, 15.10 et 15.11 sont réalisées dans les phases 16, 17 et 18.
-- Cette migration ajoute :
--   15.5  10 photos + HD : verrou contre les ajouts simultanés ; en gratuit, photo de
--         2 Mo au plus (l'application la réduit à 1 280 px) ; en Premium, jusqu'à 5 Mo.
--   15.6  Messagerie illimitée : `send_message` ne décompte plus rien pour un Premium ;
--         `get_message_quota` renvoie `premium`.
--   15.7  Messages vocaux : colonnes `kind`, `audio_path`, `audio_duration_seconds`,
--         stockage privé « voice-messages », `send_voice_message` (Premium uniquement).
--   15.12 Meilleur classement : profils boostés, puis Premium, en tête de Découvrir et
--         de la Recherche.
--   15.14 Boosts : table `profile_boosts`, `activate_profile_boost` (1 heure, une fois
--         tous les 7 jours, Premium), `get_my_boost`.
--   15.16 Support prioritaire : table `support_tickets`, `create_support_ticket`
--         (priorité « prioritaire » pour les Premium).

-- Correction : la détection de numéro reste réservée au serveur (règle de la phase 6).
-- Les fonctions serveur de l'IA l'appellent avec le rôle service.
REVOKE EXECUTE ON FUNCTION public.contains_phone_number(text) FROM authenticated;

-- ============================================================
-- 15.5 — Photos : limite 3 / 10 et HD
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Un fichier déjà enregistré ne peut plus être remplacé (l'application ne le fait
-- jamais) : sinon une photo validée pourrait être échangée contre une autre.
DROP POLICY IF EXISTS photos_storage_update_own ON storage.objects;

-- ============================================================
-- 15.14 — Boosts de profil
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_boosts_period CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS profile_boosts_user_idx ON public.profile_boosts (user_id, expires_at DESC);
ALTER TABLE public.profile_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_boosts_select_own ON public.profile_boosts;
CREATE POLICY profile_boosts_select_own ON public.profile_boosts
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.profile_boosts FROM anon, authenticated;
GRANT SELECT ON public.profile_boosts TO authenticated;

CREATE OR REPLACE FUNCTION public.is_boosted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _user_id AND b.starts_at <= now() AND b.expires_at > now()
  ) AND public.is_premium(_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_boosted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_boosted(uuid) TO authenticated, service_role;

-- État du boost de la personne connectée : actif jusqu'à, prochain boost possible le.
CREATE OR REPLACE FUNCTION public.get_my_boost()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.get_my_boost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_boost() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_profile_boost()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.activate_profile_boost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_profile_boost() TO authenticated, service_role;

-- ============================================================
-- 15.12 — Meilleur classement (Découvrir)
-- ============================================================
CREATE OR REPLACE FUNCTION public.discover_profiles(_limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  bio text,
  gender public.gender,
  interests text[]
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.discover_profiles(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer) TO authenticated, service_role;

-- 15.12 — Meilleur classement (Recherche) : même fonction qu'en phase 11, seul l'ordre change.
CREATE OR REPLACE FUNCTION public.search_profiles(_filters jsonb DEFAULT '{}'::jsonb, _limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  bio text,
  gender public.gender,
  interests text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;

-- ============================================================
-- 15.6 / 15.7 — Messagerie illimitée et messages vocaux
-- ============================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds integer;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_valid;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_valid CHECK (
  (kind = 'text' AND audio_path IS NULL AND audio_duration_seconds IS NULL)
  OR (kind = 'voice' AND audio_path IS NOT NULL
      AND audio_duration_seconds BETWEEN 1 AND 120)
);

-- Stockage privé des messages vocaux : dossier « conversation / expéditeur / fichier ».
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-messages', 'voice-messages', false, 2097152,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

-- Participant d'une conversation désignée par le texte de son identifiant (dossier).
CREATE OR REPLACE FUNCTION public.is_conversation_folder_participant(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = _folder AND auth.uid() IN (c.user_1_id, c.user_2_id)
  )
$$;
REVOKE ALL ON FUNCTION public.is_conversation_folder_participant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_folder_participant(text) TO authenticated, service_role;

DROP POLICY IF EXISTS voice_storage_insert_premium ON storage.objects;
CREATE POLICY voice_storage_insert_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_conversation_folder_participant((storage.foldername(name))[1])
    AND public.is_premium(auth.uid())
  );
DROP POLICY IF EXISTS voice_storage_select_participant ON storage.objects;
CREATE POLICY voice_storage_select_participant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (public.is_conversation_folder_participant((storage.foldername(name))[1]) OR public.is_admin())
  );
DROP POLICY IF EXISTS voice_storage_delete_own ON storage.objects;
CREATE POLICY voice_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-messages' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Contrôles communs à l'envoi d'un message (texte ou vocal). Verrouille la conversation.
CREATE OR REPLACE FUNCTION public.lock_conversation_for_sending(_uid uuid, _conversation_id uuid)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.lock_conversation_for_sending(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _content text)
 RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, content text, status message_status, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 15.7 : message vocal (Premium). Le fichier est d'abord déposé dans le stockage privé
-- (règles ci-dessus), puis enregistré ici comme message de la conversation.
CREATE OR REPLACE FUNCTION public.send_voice_message(
  _conversation_id uuid,
  _audio_path text,
  _duration_seconds integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.send_voice_message(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_voice_message(uuid, text, integer) TO authenticated, service_role;

-- 15.6 : le quota indique si la personne est Premium (messages illimités).
DROP FUNCTION IF EXISTS public.get_message_quota(uuid);

CREATE FUNCTION public.get_message_quota(_conversation_id uuid)
 RETURNS TABLE(used integer, quota_limit integer, remaining integer, exhausted boolean, unlocked boolean, unlocked_by uuid, unlock_expires_at timestamp with time zone, last_unlock_expired_at timestamp with time zone, premium boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_message_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(uuid) TO authenticated, service_role;

-- ============================================================
-- 15.16 — Support prioritaire
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'priority')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  admin_reply text CHECK (admin_reply IS NULL OR char_length(admin_reply) <= 4000),
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx
  ON public.support_tickets (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;

CREATE OR REPLACE FUNCTION public.create_support_ticket(_subject text, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.create_support_ticket(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text) TO authenticated, service_role;
