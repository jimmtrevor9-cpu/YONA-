-- ============================================================
-- Découverte et recherche : filtrage strict selon le sexe recherché (côté serveur)
--
-- 1. discover_profiles : ne montre que le sexe recherché par le membre (préférences) ;
--    « les deux » (aucune préférence) = hommes et femmes intercalés dans chaque page, en
--    commençant par le sexe opposé à celui du membre ; s'il manque des profils d'un sexe,
--    la suite est complétée par l'autre. Préférence réciproque : un vrai profil qui ne
--    cherche pas le sexe du membre n'est pas montré (les profils de démonstration
--    s'adaptent). Profils déjà likés / passés / bloqués exclus, comme avant.
--    Renvoie aussi ce qu'affiche la nouvelle carte de découverte : région, profil de
--    démonstration, identité vérifiée, objectif, photo principale validée (ou photo de
--    démonstration) et distance approximative (km entiers).
-- 2. search_profiles : même règle ; un filtre « gender » ne peut que la confirmer.
-- 3. Lecture directe d'un profil : un profil de démonstration sans photo reste caché.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Découverte
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.discover_profiles(integer);
CREATE FUNCTION public.discover_profiles(_limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid, first_name text, birth_date date, city text, region text, country text,
  bio text, gender public.gender, interests text[], is_virtual boolean, is_verified boolean,
  relationship_goal text, photo_path text, demo_photo_path text, distance_km integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  _me uuid := auth.uid();
  _my_gender public.gender;
  _sought public.gender;
  _min smallint;
  _max smallint;
  _lat double precision;
  _lng double precision;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  -- Même règle d'accès qu'avant : profil finalisé, compte actif.
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;
  SELECT p.gender INTO _my_gender FROM public.profiles p WHERE p.user_id = _me;
  SELECT pr.preferred_gender, pr.min_age, pr.max_age INTO _sought, _min, _max
  FROM public.preferences pr WHERE pr.user_id = _me;
  SELECT l.latitude, l.longitude INTO _lat, _lng FROM public.profile_locations l WHERE l.user_id = _me;

  RETURN QUERY
  WITH candidates AS (
    SELECT p.user_id AS uid, p.first_name AS fname, p.birth_date AS bdate, p.city AS pcity,
           p.region AS pregion, p.country AS pcountry, p.bio AS pbio, p.gender AS pgender,
           p.interests AS pinterests, p.is_virtual AS virt, p.verified_at, p.updated_at AS pupdated,
           p.demo_photo_path AS demo_path,
           public.is_boosted(p.user_id) AS boosted, public.is_premium(p.user_id) AS premium
    FROM public.profiles p
    WHERE p.user_id <> _me
      AND p.gender IS NOT NULL
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
      -- Sexe recherché par le membre.
      AND (_sought IS NULL OR p.gender = _sought)
      -- Préférence réciproque (vrais profils seulement).
      AND (p.is_virtual OR _my_gender IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.preferences o
        WHERE o.user_id = p.user_id AND o.preferred_gender IS NOT NULL AND o.preferred_gender <> _my_gender
      ))
      -- Tranche d'âge recherchée.
      AND (_min IS NULL OR (
        p.birth_date <= (current_date - make_interval(years => _min))::date
        AND p.birth_date > (current_date - make_interval(years => _max + 1))::date
      ))
      -- Déjà liké ou passé.
      AND NOT EXISTS (
        SELECT 1 FROM public.likes l
        WHERE l.sender_id = _me AND l.receiver_id = p.user_id AND l.status = 'active'
      )
  ), ranked AS (
    SELECT c.*,
           row_number() OVER (
             PARTITION BY c.pgender ORDER BY c.boosted DESC, c.premium DESC, c.pupdated DESC
           ) AS rn
    FROM candidates c
  )
  SELECT r.uid, r.fname, r.bdate, r.pcity, r.pregion, r.pcountry, r.pbio, r.pgender, r.pinterests,
         r.virt, (NOT r.virt AND r.verified_at IS NOT NULL),
         (SELECT o.relationship_goal FROM public.preferences o WHERE o.user_id = r.uid),
         CASE WHEN r.virt THEN NULL ELSE (
           SELECT ph.storage_path FROM public.photos ph
           WHERE ph.user_id = r.uid AND ph.is_primary AND ph.status = 'approved'
           LIMIT 1
         ) END,
         CASE WHEN r.virt THEN r.demo_path END,
         (SELECT greatest(1, round(public.distance_km(_lat, _lng, l.latitude, l.longitude)))::integer
          FROM public.profile_locations l
          WHERE _lat IS NOT NULL AND l.user_id = r.uid)
  FROM ranked r
  -- Un de chaque sexe à tour de rôle (sexe opposé au membre d'abord) quand les deux sont
  -- recherchés ; sinon l'ordre habituel : boostés, Premium, plus récents.
  ORDER BY r.rn, (r.pgender IS DISTINCT FROM _my_gender) DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;
REVOKE ALL ON FUNCTION public.discover_profiles(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Recherche
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_profiles(_filters jsonb DEFAULT '{}'::jsonb, _limit integer DEFAULT 30) RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, country text, bio text, gender public.gender, interests text[])
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
  _my_gender public.gender;
  _sought public.gender;
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

  -- Sexe recherché par le membre (préférences) : la recherche ne montre que ce sexe ; un
  -- filtre peut seulement le confirmer, jamais le contourner (filtre contraire = aucun
  -- résultat). Sans préférence (« les deux »), le filtre « gender » peut restreindre.
  SELECT p.gender INTO _my_gender FROM public.profiles p WHERE p.user_id = _me;
  SELECT pr.preferred_gender INTO _sought FROM public.preferences pr WHERE pr.user_id = _me;
  IF _sought IS NOT NULL THEN
    IF _gender IS NOT NULL AND _gender <> _sought THEN
      RETURN;
    END IF;
    _gender := _sought;
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
    AND p.gender IS NOT NULL
    -- Préférence réciproque : un vrai profil qui ne cherche pas le sexe du membre n'est
    -- pas montré (les profils de démonstration s'adaptent au membre).
    AND (p.is_virtual OR _my_gender IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.preferences o
      WHERE o.user_id = p.user_id AND o.preferred_gender IS NOT NULL AND o.preferred_gender <> _my_gender
    ))
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
  -- 15.12 : profils boostés, puis Premium, puis les plus récents, rangés séparément pour
  -- chaque sexe ; quand les deux sexes sont recherchés, ils sont intercalés (un de chaque,
  -- en commençant par le sexe opposé à celui du membre), puis le reste du sexe le plus
  -- nombreux si l'autre vient à manquer.
  ORDER BY row_number() OVER (
             PARTITION BY p.gender
             ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
           ),
           (p.gender IS DISTINCT FROM _my_gender) DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$_$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Lecture directe : profil de démonstration sans photo caché
-- ------------------------------------------------------------
DROP POLICY IF EXISTS profiles_select_visible ON public.profiles;
CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND status = 'active'
    AND visibility = 'visible'
    AND (NOT is_virtual OR demo_photo_path IS NOT NULL)
    AND public.can_browse_profiles()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_active_account(user_id)
  );
