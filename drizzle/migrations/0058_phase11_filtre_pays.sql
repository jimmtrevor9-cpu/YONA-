-- Phase 11 / Étape 11.3 — Filtre pays.
-- - `normalize_place(text)` : forme de comparaison d'un lieu (minuscules, sans accents,
--   tirets / apostrophes / espaces multiples ramenés à un espace). « Côte d'Ivoire »,
--   « cote-d’ivoire » et « COTE D IVOIRE » sont ainsi le même pays.
-- - `search_profiles` : filtre `country` (texte de 1 à 100 caractères, sinon
--   `invalid_filter`), comparaison exacte sur la forme normalisée.
-- - `list_search_countries()` : pays réellement renseignés par les profils que la
--   personne connectée peut voir (visibles, actifs, sans blocage), pour l'aide à la
--   saisie ; orthographe la plus fréquente pour chaque pays (à égalité : casse normale,
--   puis avec accents), classés par nombre de profils puis par nom.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.normalize_place(_value text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT nullif(
    btrim(regexp_replace(lower(extensions.unaccent(coalesce(_value, ''))), '[\s''’`\-]+', ' ', 'g')),
    ''
  )
$$;

REVOKE ALL ON FUNCTION public.normalize_place(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_place(text) TO authenticated, service_role;

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
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city') THEN
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

  -- Filtre existant de la page Recherche (renforcé à l'étape 11.4).
  _city := nullif(btrim(_f->>'city'), '');

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
    AND (_city IS NULL OR p.city ILIKE '%' || _city || '%')
  ORDER BY p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_search_countries()
RETURNS TABLE (country text, profiles integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(p.country), '\s+', ' ', 'g') AS label,
           public.normalize_place(p.country) AS norm
    FROM public.profiles p
    WHERE p.user_id <> _me
      AND public.normalize_place(p.country) IS NOT NULL
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  spellings AS (
    SELECT norm, label, count(*) AS n,
           row_number() OVER (
             PARTITION BY norm
             -- Orthographe la plus fréquente ; à égalité, casse normale (ni tout en
             -- majuscules ni tout en minuscules), puis avec accents, puis alphabétique.
             ORDER BY count(*) DESC,
                      (label <> upper(label) AND label <> lower(label)) DESC,
                      (label <> extensions.unaccent(label)) DESC,
                      label
           ) AS rank
    FROM visible GROUP BY norm, label
  )
  SELECT s.label, (SELECT count(*) FROM visible v WHERE v.norm = s.norm)::integer
  FROM spellings s
  WHERE s.rank = 1
  ORDER BY 2 DESC, 1
  LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.list_search_countries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_search_countries() TO authenticated, service_role;
