-- Phase 11 / Étape 11.6 — Filtre situation matrimoniale.
-- - `profiles.marital_status` : valeurs autorisées « never_married » (célibataire, jamais
--   marié·e), « divorced » (divorcé·e), « widowed » (veuf / veuve) ou vide (non précisé).
--   Contrainte côté base ; le membre la renseigne sur sa page Profil.
-- - `search_profiles`, filtre `marital_status` : liste de 1 à 3 valeurs distinctes parmi
--   celles-ci (sinon `invalid_filter`) ; les profils non précisés ne correspondent jamais.

UPDATE public.profiles SET marital_status = NULL
WHERE marital_status IS NOT NULL AND marital_status NOT IN ('never_married', 'divorced', 'widowed');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_marital_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_marital_status_check
  CHECK (marital_status IS NULL OR marital_status IN ('never_married', 'divorced', 'widowed'));

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
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city', 'max_distance_km', 'marital_status') THEN
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
    AND (_distance IS NULL OR EXISTS (
      SELECT 1 FROM public.profile_locations l
      WHERE l.user_id = p.user_id
        AND public.distance_km(_my_lat, _my_lng, l.latitude, l.longitude) <= _distance
    ))
  ORDER BY p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;
