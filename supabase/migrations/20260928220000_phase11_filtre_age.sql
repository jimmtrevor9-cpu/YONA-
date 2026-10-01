-- Phase 11 / Étape 11.1 — Filtre âge.
-- Nouvelle recherche côté serveur : `search_profiles(_filters, _limit)`.
-- - Membre connecté (sinon refus `not_authenticated`) pouvant consulter les profils
--   (sinon aucun résultat).
-- - Profils visibles et actifs (`is_discoverable_profile`), jamais soi-même, aucun
--   blocage dans un sens ou dans l'autre.
-- - Filtres (objet JSON) validés par le serveur ; clé inconnue ou valeur invalide :
--   refus `invalid_filter`.
--     min_age, max_age : entiers de 18 à 99, min_age <= max_age (âge calculé depuis la
--                        date de naissance ; profils sans date de naissance exclus
--                        dès qu'un filtre d'âge est utilisé) ;
--     gender, city     : filtres déjà proposés par la page Recherche, repris ici
--                        (renforcés aux étapes 11.2 et 11.4).
-- - 50 résultats au plus, les profils mis à jour le plus récemment d'abord.

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
  _city text;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'city') THEN
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

  -- Filtres existants de la page Recherche
  IF _f ? 'gender' THEN
    BEGIN
      _gender := (_f->>'gender')::public.gender;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'gender';
    END;
  END IF;
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
    AND (_city IS NULL OR p.city ILIKE '%' || _city || '%')
  ORDER BY p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;
