-- Phase 20 — Paramètres (/settings).
-- 20.1 — Table `user_settings` (une ligne par membre, créée au premier enregistrement ;
--        sans ligne, les valeurs par défaut s'appliquent). Lecture et écriture par le
--        membre lui-même uniquement.
-- 20.2 — Visibilité du profil : colonne existante `profiles.visibility` (phase 1).
-- 20.3 — Visibilité de l'activité : si elle est masquée, `get_presence` renvoie
--        « inconnu » aux autres et le filtre « actif depuis » de la Recherche l'ignore.
-- 20.4 à 20.7 — Préférences de notifications : e-mail (enregistrée ; l'envoi d'e-mails
--        demande un service d'e-mail non configuré), messages, Match, Like.
--        `wants_notification` les applique aux notifications de la phase 19.
-- 20.8 / 20.9 — Mot de passe et suppression du compte : dans l'application (Supabase Auth
--        et fonction serveur avec le rôle service).

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  activity_visible boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_messages boolean NOT NULL DEFAULT true,
  notify_matches boolean NOT NULL DEFAULT true,
  notify_likes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE DELETE ON public.user_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_activity_visible(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT s.activity_visible FROM public.user_settings s WHERE s.user_id = _user_id), true)
$$;
REVOKE ALL ON FUNCTION public.is_activity_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_activity_visible(uuid) TO authenticated, service_role;

-- 20.5 à 20.7 : préférences appliquées aux notifications (favori, visite et demande de
-- contact restent toujours actives : elles n'ont pas de réglage dans le cahier des charges).
CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _type
    WHEN 'message' THEN coalesce(s.notify_messages, true)
    WHEN 'match' THEN coalesce(s.notify_matches, true)
    WHEN 'like' THEN coalesce(s.notify_likes, true)
    ELSE true
  END
  FROM (SELECT 1) one
  LEFT JOIN public.user_settings s ON s.user_id = _user_id
$$;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- 20.3 : présence masquée si le membre cache son activité.
CREATE OR REPLACE FUNCTION public.get_presence(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _me uuid := auth.uid();
  _seen timestamptz;
  _online boolean;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL THEN
    RETURN 'unknown';
  END IF;
  IF _user_id <> _me THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.can_browse_profiles()
       OR NOT public.is_discoverable_profile(_user_id)
       OR public.is_blocked_between(_me, _user_id)
       OR NOT public.is_activity_visible(_user_id) THEN
      RETURN 'unknown';
    END IF;
  END IF;

  SELECT a.last_seen_at, a.is_online INTO _seen, _online
  FROM public.user_activity a WHERE a.user_id = _user_id;

  RETURN CASE
    WHEN _seen IS NULL THEN 'unknown'
    WHEN _online AND _seen > now() - interval '3 minutes' THEN 'online'
    WHEN _seen > now() - interval '24 hours' THEN 'recent'
    WHEN _seen > now() - interval '7 days' THEN 'this_week'
    ELSE 'inactive'
  END;
END;
$function$;

-- 20.3 : Recherche — même fonction qu'en phase 15, filtre « actif depuis » ajusté.
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
    -- 20.3 : un membre qui masque son activité n'apparaît pas dans le filtre « actif depuis ».
    AND (_active_days IS NULL OR public.is_activity_visible(p.user_id))
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;
