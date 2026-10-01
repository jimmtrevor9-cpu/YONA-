-- Phase 11 / Étape 11.5 — Filtre distance.
-- Position des membres, pour la recherche par distance, protégée :
-- - table dédiée `profile_locations` (une ligne par membre), lisible uniquement par son
--   propriétaire ; jamais lisible par les autres membres ; aucune écriture directe ;
-- - `set_my_location(latitude, longitude)` : enregistre la position de la personne
--   connectée, arrondie à 0,01° (environ 1 km) ; coordonnées hors limites ou non finies :
--   refus `invalid_location` ; `clear_my_location()` : la retire ;
-- - les colonnes `profiles.latitude` / `profiles.longitude` (lisibles par les autres
--   membres avec le reste du profil) restent toujours vides (déclencheur) : la position
--   n'est jamais stockée là ;
-- - `distance_km` : distance à vol d'oiseau (formule de haversine) ;
-- - `search_profiles`, filtre `max_distance_km` : 5, 10, 25, 50, 100, 250 ou 500 km
--   seulement (rayons fixes : impossible d'affiner pour localiser précisément quelqu'un),
--   autour de la position de la personne connectée (sinon refus `location_required`).

CREATE TABLE IF NOT EXISTS public.profile_locations (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_locations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profile_locations TO authenticated;
GRANT ALL ON public.profile_locations TO service_role;

DROP POLICY IF EXISTS profile_locations_select_own ON public.profile_locations;
CREATE POLICY profile_locations_select_own ON public.profile_locations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_my_location(_latitude double precision, _longitude double precision)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.clear_my_location()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.profile_locations WHERE user_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_location(double precision, double precision) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_my_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_location(double precision, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_my_location() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.distance_km(
  _lat1 double precision, _lng1 double precision, _lat2 double precision, _lng2 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 2 * 6371 * asin(sqrt(least(1,
    sin(radians(_lat2 - _lat1) / 2) ^ 2
    + cos(radians(_lat1)) * cos(radians(_lat2)) * sin(radians(_lng2 - _lng1) / 2) ^ 2
  )))
$$;

REVOKE ALL ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision) TO authenticated, service_role;

-- La position n'est jamais stockée dans le profil (lisible par les autres membres).
CREATE OR REPLACE FUNCTION public.clear_profile_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.latitude := NULL;
  NEW.longitude := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_no_coordinates ON public.profiles;
CREATE TRIGGER profiles_no_coordinates
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.clear_profile_coordinates();

UPDATE public.profiles SET latitude = NULL, longitude = NULL
WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

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
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city', 'max_distance_km') THEN
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
