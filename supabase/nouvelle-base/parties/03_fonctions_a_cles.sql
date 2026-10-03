-- YONA — base de données complète, partie 3 sur 5
-- Contenu :
--   6. Fonctions : les règles du site exécutées par la base (suite) (suite)
--   7. Tables
--   8. Clés primaires et valeurs uniques
-- À exécuter dans l'ordre (01, 02, …), chaque partie en entier :
-- Supabase → SQL Editor → New query → coller la partie → Run.
-- Chaque partie peut être relancée sans danger (par exemple après une erreur).
-- Fichier généré par scripts/generate-base-complete.py. Ne pas modifier à la main.

SET client_min_messages = warning;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;
CREATE OR REPLACE FUNCTION public.replace_virtual_profile_on_signup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _removed uuid;
  _sought public.gender;
BEGIN
  -- Seulement quand l'identité d'un vrai membre vient d'être vérifiée.
  IF NEW.is_virtual OR OLD.verified_at IS NOT NULL OR NEW.verified_at IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Une seule fois par membre.
    INSERT INTO public.virtual_profile_removals (user_id, reason)
    VALUES (NEW.user_id, 'identité vérifiée')
    ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    SELECT pr.preferred_gender INTO _sought FROM public.preferences pr WHERE pr.user_id = NEW.user_id;
    _removed := public.remove_one_virtual_profile(public.member_country(NEW.user_id), _sought);
    UPDATE public.virtual_profile_removals SET removed_user_id = _removed
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Jamais d'échec de vérification à cause des profils de démonstration.
    RAISE WARNING 'replace_virtual_profile_on_signup: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.report_user(_user_id uuid, _reason public.report_reason, _description text DEFAULT NULL::text, _message_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.request_context() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'ip', nullif(btrim(split_part(coalesce(
      h ->> 'x-yona-ip', h ->> 'cf-connecting-ip', h ->> 'x-real-ip', h ->> 'x-forwarded-for', ''
    ), ',', 1)), ''),
    'country', upper(nullif(btrim(coalesce(h ->> 'x-yona-country', h ->> 'cf-ipcountry', '')), '')),
    'city', left(nullif(btrim(coalesce(public.url_decode(h ->> 'x-yona-city'), '')), ''), 100),
    'user_agent', left(nullif(coalesce(h ->> 'x-yona-ua', h ->> 'user-agent', ''), ''), 400)
  )
  FROM (SELECT coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb AS h) x
$$;
CREATE OR REPLACE FUNCTION public.require_verified_sender() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sender_id IS NOT NULL AND NOT public.is_identity_verified(NEW.sender_id) THEN
    RAISE EXCEPTION 'identity_not_verified' USING ERRCODE = '42501',
      HINT = 'Vérifiez votre identité pour envoyer des messages.';
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.respond_contact_request(_request_id uuid, _accept boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _r public.contact_requests%ROWTYPE;
  _a uuid;
  _b uuid;
  _match uuid;
  _conversation uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _accept IS NULL THEN
    RAISE EXCEPTION 'invalid_response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _r FROM public.contact_requests r WHERE r.id = _request_id FOR UPDATE;
  IF NOT FOUND OR _r.receiver_id <> _me THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _r.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF NOT _accept THEN
    UPDATE public.contact_requests SET status = 'declined', responded_at = now()
    WHERE id = _r.id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_r.sender_id)
     OR public.is_blocked_between(_me, _r.sender_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;

  _a := least(_me, _r.sender_id);
  _b := greatest(_me, _r.sender_id);
  -- Même verrou que la création d'un Match par Like réciproque (pas de doublon).
  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  INSERT INTO public.matches (user_1_id, user_2_id)
  VALUES (_a, _b)
  ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
    WHERE public.matches.status = 'unmatched';

  SELECT m.id INTO _match FROM public.matches m
  WHERE m.user_1_id = _a AND m.user_2_id = _b AND m.status = 'active';
  IF _match IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT c.id INTO _conversation FROM public.conversations c WHERE c.match_id = _match;

  -- Les demandes en attente entre les deux membres (dans les deux sens) sont acceptées.
  UPDATE public.contact_requests r SET status = 'accepted', responded_at = now()
  WHERE r.status = 'pending'
    AND ((r.sender_id = _r.sender_id AND r.receiver_id = _me)
      OR (r.sender_id = _me AND r.receiver_id = _r.sender_id));

  RETURN jsonb_build_object('status', 'accepted', 'match_id', _match,
    'conversation_id', _conversation);
END;
$$;
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
  -- Vrais membres d'abord, puis (15.12) profils boostés, Premium, plus récents, rangés séparément pour
  -- chaque sexe ; quand les deux sexes sont recherchés, ils sont intercalés (un de chaque,
  -- en commençant par le sexe opposé à celui du membre), puis le reste du sexe le plus
  -- nombreux si l'autre vient à manquer.
  ORDER BY row_number() OVER (
             PARTITION BY p.gender
             ORDER BY p.is_virtual, public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC,
                      p.updated_at DESC
           ),
           (p.gender IS DISTINCT FROM _my_gender) DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$_$;
CREATE OR REPLACE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL::text, _flash boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_message, '')), '');
  _existing uuid;
  _id uuid;
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _receiver_id IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _receiver_id = _me THEN
    RAISE EXCEPTION 'self_request' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_receiver_id)
     OR public.is_blocked_between(_me, _receiver_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.status = 'active'
      AND m.user_1_id = least(_me, _receiver_id)
      AND m.user_2_id = greatest(_me, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_matched' USING ERRCODE = '22023';
  END IF;
  -- 17.3 : Message Flash réservé au Premium, avec un message obligatoire.
  IF coalesce(_flash, false) THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'flash_premium_required' USING ERRCODE = '42501';
    END IF;
    IF _text IS NULL THEN
      RAISE EXCEPTION 'flash_message_required' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 300 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = '22023';
  END IF;

  -- 12.6 : un seul envoi à la fois par membre (le comptage ci-dessous reste exact même
  -- avec des envois simultanés).
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_request:' || _me::text, 0));

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
  END IF;

  -- Respect d'un refus récent : pas de relance pendant 30 jours.
  IF EXISTS (
    SELECT 1 FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'declined'
      AND r.responded_at > now() - interval '30 days'
  ) THEN
    RAISE EXCEPTION 'recently_declined' USING ERRCODE = 'P0001';
  END IF;

  -- 12.3 / 12.5 : 5 demandes par jour en gratuit, illimité en Premium.
  _premium := public.is_premium(_me);
  IF NOT _premium THEN
    SELECT count(*)::integer INTO _used FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
    IF _used >= 5 THEN
      RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.contact_requests (sender_id, receiver_id, message, is_flash)
  VALUES (_me, _receiver_id, _text, coalesce(_flash, false))
  ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT r.id INTO _id FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
    RETURN jsonb_build_object('id', _id, 'status', 'already_pending');
  END IF;
  RETURN jsonb_build_object('id', _id, 'status', 'sent');
END;
$$;
CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _content text) RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, content text, status public.message_status, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;
CREATE OR REPLACE FUNCTION public.send_voice_message(_conversation_id uuid, _audio_path text, _duration_seconds integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.set_favorite_created_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_like_created_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.created_at := CASE WHEN TG_OP = 'INSERT' THEN now() ELSE OLD.created_at END;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.set_member_location(_user_id uuid, _source text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision, _country_code text DEFAULT NULL::text, _region text DEFAULT NULL::text, _city text DEFAULT NULL::text, _accuracy_m integer DEFAULT NULL::integer, _timezone text DEFAULT NULL::text, _language text DEFAULT NULL::text, _ip_country text DEFAULT NULL::text, _ip_city text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  _cur public.profile_locations%ROWTYPE;
  _found boolean;
  _code text := upper(nullif(btrim(coalesce(_country_code, '')), ''));
  _ipc text := upper(nullif(btrim(coalesce(_ip_country, public.request_context() ->> 'country', '')), ''));
  _ipcity text := left(nullif(btrim(coalesce(_ip_city, public.request_context() ->> 'city', '')), ''), 120);
  _tz text := left(nullif(btrim(coalesce(_timezone, '')), ''), 64);
  _replace boolean;
  _reasons text[] := '{}';
  _row public.profile_locations%ROWTYPE;
BEGIN
  IF _user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _source IS NULL OR _source NOT IN ('device', 'declared', 'ip') THEN
    RAISE EXCEPTION 'invalid_source' USING ERRCODE = '22023';
  END IF;
  IF (_latitude IS NULL) <> (_longitude IS NULL)
     OR (_latitude IS NOT NULL AND (_latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180
                                    OR _latitude = 'NaN'::double precision OR _longitude = 'NaN'::double precision)) THEN
    RAISE EXCEPTION 'invalid_location' USING ERRCODE = '22023';
  END IF;
  IF _code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.geo_countries g WHERE g.code = _code) THEN
    _code := NULL;
  END IF;
  IF _ipc !~ '^[A-Z]{2}$' OR _ipc = 'XX' THEN
    _ipc := NULL;
  END IF;

  SELECT * INTO _cur FROM public.profile_locations l WHERE l.user_id = _user_id FOR UPDATE;
  _found := FOUND;
  -- La plus haute priorité disponible l'emporte (appareil > déclarée > IP) ; une position
  -- de plus de 6 mois peut être remplacée par n'importe quelle source.
  _replace := _latitude IS NOT NULL AND (
    NOT _found
    OR public.location_priority(_source) >= public.location_priority(_cur.source)
    OR _cur.updated_at < now() - interval '6 months'
    -- Ancienne position sans pays connu : une position avec pays la remplace.
    OR (_cur.country_code IS NULL AND _code IS NOT NULL));

  IF _replace THEN
    INSERT INTO public.profile_locations AS l (
      user_id, latitude, longitude, updated_at, source, country_code, country, region, city, accuracy_m)
    VALUES (_user_id, round(_latitude::numeric, 2)::double precision, round(_longitude::numeric, 2)::double precision,
            now(), _source, _code, (SELECT g.name FROM public.geo_countries g WHERE g.code = _code),
            left(nullif(btrim(_region), ''), 120), left(nullif(btrim(_city), ''), 120),
            CASE WHEN _accuracy_m > 0 THEN least(_accuracy_m, 1000000) END)
    ON CONFLICT (user_id) DO UPDATE SET
      latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now(),
      source = EXCLUDED.source, country_code = EXCLUDED.country_code, country = EXCLUDED.country,
      region = EXCLUDED.region, city = EXCLUDED.city, accuracy_m = EXCLUDED.accuracy_m;
  ELSIF NOT _found THEN
    -- Aucune position connue et rien à retenir : seulement l'historique.
    INSERT INTO public.location_history (user_id, source, retained_source, ip_country, timezone)
    VALUES (_user_id, _source, _source, _ipc, _tz);
    RETURN jsonb_build_object('retained', NULL);
  END IF;

  SELECT * INTO _row FROM public.profile_locations l WHERE l.user_id = _user_id;
  -- Indices : pays de l'IP (sauf si la position retenue vient justement de l'IP) et fuseau.
  IF _row.country_code IS NOT NULL THEN
    IF _ipc IS NOT NULL AND _row.source <> 'ip' AND _ipc <> _row.country_code THEN
      _reasons := _reasons || ('ip_country:' || _ipc);
    END IF;
    IF _tz IS NOT NULL AND EXISTS (SELECT 1 FROM public.geo_timezones t WHERE t.tz = _tz)
       AND NOT EXISTS (SELECT 1 FROM public.geo_timezones t WHERE t.tz = _tz AND _row.country_code = ANY (t.country_codes)) THEN
      _reasons := _reasons || ('timezone:' || _tz);
    END IF;
    -- Position de l'appareil dans un autre pays que celui affiché sur le profil.
    IF _row.source = 'device' AND _row.country IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.country IS NOT NULL
           AND lower(p.country) <> lower(_row.country)) THEN
      _reasons := _reasons || ('declared_country:' || (SELECT p.country FROM public.profiles p WHERE p.user_id = _user_id));
    END IF;
  END IF;
  UPDATE public.profile_locations l SET
    ip_country = coalesce(_ipc, l.ip_country),
    ip_city = CASE WHEN _ipc IS NOT NULL THEN _ipcity ELSE l.ip_city END,
    timezone = coalesce(_tz, l.timezone),
    language = coalesce(left(nullif(btrim(_language), ''), 35), l.language),
    inconsistent = cardinality(_reasons) > 0,
    inconsistency = _reasons,
    checked_at = now()
  WHERE l.user_id = _user_id
  RETURNING * INTO _row;
  INSERT INTO public.location_history (user_id, source, retained_source, country_code, country, city,
                                       ip_country, timezone, inconsistent, inconsistency)
  VALUES (_user_id, _source, _row.source, _row.country_code, _row.country, _row.city,
          _row.ip_country, _row.timezone, _row.inconsistent, _row.inconsistency);
  RETURN jsonb_build_object(
    'retained', _row.source, 'replaced', _replace, 'country', _row.country, 'region', _row.region,
    'city', _row.city, 'inconsistent', _row.inconsistent, 'inconsistency', to_jsonb(_row.inconsistency));
END;
$_$;
CREATE OR REPLACE FUNCTION public.set_my_location(_latitude double precision, _longitude double precision) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  INSERT INTO public.profile_locations AS l (user_id, latitude, longitude, updated_at, source)
  VALUES (auth.uid(), round(_latitude::numeric, 2)::double precision,
          round(_longitude::numeric, 2)::double precision, now(), 'device')
  ON CONFLICT (user_id) DO UPDATE
    SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, updated_at = now(),
        source = 'device', country_code = NULL, country = NULL, region = NULL, city = NULL,
        accuracy_m = NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.set_primary_photo(_photo_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.photos WHERE id = _photo_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.photos SET is_primary = false WHERE user_id = _uid AND is_primary AND id <> _photo_id;
  UPDATE public.photos SET is_primary = true WHERE id = _photo_id;
END; $$;
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.start_conversation_unlock_payment(_conversation_id uuid, _provider text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv public.conversations%ROWTYPE;
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _conv FROM public.conversations c WHERE c.id = _conversation_id FOR UPDATE;
  IF NOT FOUND OR _uid NOT IN (_conv.user_1_id, _conv.user_2_id)
     OR _conv.status <> 'open'
     OR NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = _conv.match_id AND m.status = 'active')
  THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  IF public.has_active_conversation_unlock(_conv.id) THEN
    RAISE EXCEPTION 'unlock_already_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid
    AND p.type = 'conversation_unlock'
    AND p.status = 'pending'
    AND p.provider = _provider
    AND p.metadata->>'conversation_id' = _conv.id::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (
      _uid, 'conversation_unlock', 100, 'USD', _provider, 'pending',
      jsonb_build_object('conversation_id', _conv.id, 'duration_days', 3)
    )
    RETURNING id INTO _payment;
  END IF;

  RETURN _payment;
END;
$$;
CREATE OR REPLACE FUNCTION public.start_identity_verification(_user_id uuid, _with_selfie boolean, _document_type text DEFAULT NULL::text, _consent boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _s public.verification_settings%ROWTYPE;
  _used integer;
  _id uuid := gen_random_uuid();
  _challenge text;
  _main text;
  _challenge_path text;
  _document_path text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND NOT p.is_virtual) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_active_account(_user_id) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'already_verified' USING ERRCODE = '22023';
  END IF;
  IF _consent IS NOT TRUE THEN
    RAISE EXCEPTION 'consent_required' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(_with_selfie, false) AND _document_type IS NULL THEN
    RAISE EXCEPTION 'nothing_to_check' USING ERRCODE = '22023';
  END IF;
  IF _document_type IS NOT NULL AND _document_type NOT IN ('id_card', 'passport', 'student_card', 'school_card') THEN
    RAISE EXCEPTION 'invalid_document_type' USING ERRCODE = '22023';
  END IF;
  PERFORM public.expire_verification_attempts(_user_id);
  IF EXISTS (SELECT 1 FROM public.profile_verifications v
             WHERE v.user_id = _user_id AND v.status IN ('processing', 'pending')) THEN
    RAISE EXCEPTION 'verification_in_progress' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _s FROM public.verification_settings WHERE id;
  SELECT count(*) INTO _used FROM public.profile_verifications v
  WHERE v.user_id = _user_id AND v.automatic AND v.created_at > now() - interval '24 hours'
    AND v.reason IS DISTINCT FROM 'engine_unavailable';
  IF _used >= coalesce(_s.max_attempts_per_day, 5) THEN
    RAISE EXCEPTION 'too_many_attempts' USING ERRCODE = '22023';
  END IF;

  IF _with_selfie THEN
    _challenge := CASE WHEN random() < 0.5 THEN 'turn_left' ELSE 'turn_right' END;
    _main := _user_id || '/' || _id || '/selfie.jpg';
    _challenge_path := _user_id || '/' || _id || '/consigne.jpg';
  END IF;
  IF _document_type IS NOT NULL THEN
    _document_path := _user_id || '/' || _id || '/piece.jpg';
  END IF;
  -- clock_timestamp : deux tentatives gardent leur ordre, même dans une seule transaction.
  INSERT INTO public.profile_verifications (id, user_id, method, storage_path, status, document_type,
                                            challenge, challenge_path, document_path, consent_at, automatic,
                                            created_at)
  VALUES (_id, _user_id, CASE WHEN _with_selfie THEN 'selfie' ELSE 'id_document' END,
          coalesce(_main, _document_path), 'processing', _document_type, _challenge, _challenge_path,
          CASE WHEN _with_selfie THEN _document_path END, now(), true, clock_timestamp());
  RETURN jsonb_build_object(
    'id', _id, 'challenge', _challenge,
    'selfie_path', _main, 'challenge_path', _challenge_path, 'document_path', _document_path,
    'attempts_left', greatest(coalesce(_s.max_attempts_per_day, 5) - _used - 1, 0));
END;
$$;
CREATE OR REPLACE FUNCTION public.start_premium_payment(_plan public.subscription_plan, _provider text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;

  -- Un paiement en attente récent pour la même formule est réutilisé (double clic).
  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid AND p.type = 'subscription' AND p.status = 'pending'
    AND p.provider = _provider AND p.metadata->>'plan' = _plan::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (_uid, 'subscription', public.premium_plan_amount(_plan), 'USD', _provider, 'pending',
      jsonb_build_object('plan', _plan))
    RETURNING id INTO _payment;
  END IF;
  RETURN _payment;
END;
$$;
CREATE OR REPLACE FUNCTION public.text_items_max_length(_items text[], _max integer) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(bool_and(char_length(item) BETWEEN 1 AND _max), true) FROM unnest(_items) AS item
$$;
CREATE OR REPLACE FUNCTION public.touch_activity() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user uuid := auth.uid();
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_account(_user) THEN
    RETURN false;
  END IF;

  -- Déjà à jour : aucune écriture.
  IF EXISTS (
    SELECT 1 FROM public.user_activity a
    WHERE a.user_id = _user AND a.is_online AND a.last_seen_at > now() - interval '30 seconds'
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.user_activity AS a (user_id, last_seen_at, is_online)
  VALUES (_user, now(), true)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now(), is_online = true;

  UPDATE public.users SET last_active_at = now() WHERE id = _user;
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = _user_id;
  RETURN FOUND;
END;
$$;
CREATE OR REPLACE FUNCTION public.undo_last_pass() RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _target uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(_me) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.likes l
  WHERE l.id = (
    SELECT p.id FROM public.likes p
    WHERE p.sender_id = _me AND p.kind = 'pass' AND p.status = 'active'
      AND p.created_at > now() - interval '24 hours'
    ORDER BY p.created_at DESC
    LIMIT 1
  )
  RETURNING l.receiver_id INTO _target;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'nothing_to_undo' USING ERRCODE = 'P0002';
  END IF;
  RETURN _target;
END;
$$;
CREATE OR REPLACE FUNCTION public.url_decode(_s text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
DECLARE
  _bytes bytea := ''::bytea;
  _i integer := 1;
  _c text;
BEGIN
  IF _s IS NULL THEN
    RETURN NULL;
  END IF;
  WHILE _i <= length(_s) LOOP
    _c := substr(_s, _i, 1);
    IF _c = '%' AND substr(_s, _i + 1, 2) ~ '^[0-9A-Fa-f]{2}$' THEN
      _bytes := _bytes || decode(substr(_s, _i + 1, 2), 'hex');
      _i := _i + 3;
    ELSE
      _bytes := _bytes || convert_to(CASE WHEN _c = '+' THEN ' ' ELSE _c END, 'UTF8');
      _i := _i + 1;
    END IF;
  END LOOP;
  RETURN convert_from(_bytes, 'UTF8');
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END; $_$;
CREATE OR REPLACE FUNCTION public.utc_day_start() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT date_trunc('day', now(), 'UTC')
$$;
CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _type text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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

-- ============================================================================
-- 7. Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.activity_events (
    id bigint NOT NULL,
    user_id uuid,
    event text NOT NULL,
    target_user_id uuid,
    ref_id uuid,
    ip text,
    country text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activity_events_event_check CHECK ((event = ANY (ARRAY['like'::text, 'pass'::text, 'match'::text, 'message'::text, 'voice_message'::text, 'block'::text, 'report'::text, 'contact_request'::text, 'flash_message'::text, 'favorite'::text, 'visit'::text, 'account_suspended'::text, 'account_banned'::text, 'account_reactivated'::text, 'account_deleted'::text])))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.activity_events'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.activity_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.activity_events_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.ad_events (
    id bigint NOT NULL,
    ad_id uuid NOT NULL,
    user_id uuid,
    event text NOT NULL,
    placement text NOT NULL,
    country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_events_country_check CHECK (((country IS NULL) OR (char_length(country) <= 80))),
    CONSTRAINT ad_events_event_check CHECK ((event = ANY (ARRAY['view'::text, 'click'::text, 'skip'::text]))),
    CONSTRAINT ad_events_placement_check CHECK ((placement = ANY (ARRAY['discover'::text, 'matches'::text, 'messages'::text])))
);
COMMENT ON TABLE public.ad_events IS 'Journal des publicités : vues, clics et « Passer ».';
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.ad_events'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.ad_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.ad_events_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.ad_settings (
    id boolean DEFAULT true NOT NULL,
    discover_every integer DEFAULT 5 NOT NULL,
    list_every integer DEFAULT 6 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_settings_discover_every_check CHECK (((discover_every >= 2) AND (discover_every <= 50))),
    CONSTRAINT ad_settings_id_check CHECK (id),
    CONSTRAINT ad_settings_list_every_check CHECK (((list_every >= 2) AND (list_every <= 50)))
);
COMMENT ON TABLE public.ad_settings IS 'Publicités : une toutes les N cartes de Découvrir (discover_every), une toutes les N lignes des listes (list_every).';
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id bigint NOT NULL,
    admin_id uuid,
    action text NOT NULL,
    target_table text,
    target_id text,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT admin_audit_log_action_length CHECK ((char_length(action) <= 100))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.admin_audit_log'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.admin_audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.admin_audit_log_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.ads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text,
    advertiser text,
    media_type text NOT NULL,
    media_path text NOT NULL,
    poster_path text,
    cta_label text DEFAULT 'En savoir plus'::text NOT NULL,
    cta_url text NOT NULL,
    cta_icon text DEFAULT 'external'::text NOT NULL,
    placements text[] DEFAULT ARRAY['discover'::text] NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    ends_at timestamp with time zone,
    target_countries text[] DEFAULT '{}'::text[] NOT NULL,
    target_gender public.gender,
    min_age integer,
    max_age integer,
    priority integer DEFAULT 0 NOT NULL,
    daily_cap integer DEFAULT 3 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ads_advertiser_check CHECK (((advertiser IS NULL) OR (char_length(advertiser) <= 40))),
    CONSTRAINT ads_ages_check CHECK (((min_age IS NULL) OR (max_age IS NULL) OR (min_age <= max_age))),
    CONSTRAINT ads_body_check CHECK (((body IS NULL) OR (char_length(body) <= 300))),
    CONSTRAINT ads_cta_icon_check CHECK ((cta_icon = ANY (ARRAY['external'::text, 'message'::text, 'phone'::text]))),
    CONSTRAINT ads_cta_label_check CHECK (((char_length(btrim(cta_label)) >= 1) AND (char_length(btrim(cta_label)) <= 24))),
    CONSTRAINT ads_cta_url_check CHECK (((cta_url ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?([/?#][^[:space:]]*)?$'::text) AND (char_length(cta_url) <= 500))),
    CONSTRAINT ads_daily_cap_check CHECK (((daily_cap >= 1) AND (daily_cap <= 50))),
    CONSTRAINT ads_dates_check CHECK (((ends_at IS NULL) OR (ends_at > starts_at))),
    CONSTRAINT ads_max_age_check CHECK (((max_age IS NULL) OR ((max_age >= 18) AND (max_age <= 99)))),
    CONSTRAINT ads_media_folder_check CHECK (((split_part(media_path, '/'::text, 1) = (id)::text) AND ((poster_path IS NULL) OR (split_part(poster_path, '/'::text, 1) = (id)::text)))),
    CONSTRAINT ads_media_path_check CHECK ((media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'::text)),
    CONSTRAINT ads_media_type_check CHECK ((media_type = ANY (ARRAY['image'::text, 'video'::text]))),
    CONSTRAINT ads_min_age_check CHECK (((min_age IS NULL) OR ((min_age >= 18) AND (min_age <= 99)))),
    CONSTRAINT ads_placements_check CHECK (((cardinality(placements) >= 1) AND (placements <@ ARRAY['discover'::text, 'matches'::text, 'messages'::text]))),
    CONSTRAINT ads_poster_path_check CHECK (((poster_path IS NULL) OR (poster_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'::text))),
    CONSTRAINT ads_priority_check CHECK (((priority >= 0) AND (priority <= 100))),
    CONSTRAINT ads_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text]))),
    CONSTRAINT ads_title_check CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 90)))
);
COMMENT ON TABLE public.ads IS 'Publicités sponsorisées, montrées uniquement aux membres gratuits (get_ads_for_me).';
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    feature text DEFAULT 'roi_salomon'::text NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_count_positive CHECK ((usage_count >= 0))
);
CREATE TABLE IF NOT EXISTS public.auth_events (
    id bigint NOT NULL,
    user_id uuid,
    email text,
    event text NOT NULL,
    method text,
    ip text,
    country text,
    city text,
    user_agent text,
    timezone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT auth_events_email_length CHECK (((email IS NULL) OR (char_length(email) <= 320))),
    CONSTRAINT auth_events_event_check CHECK ((event = ANY (ARRAY['signup'::text, 'login'::text, 'login_failed'::text, 'logout'::text, 'password_reset_requested'::text, 'password_changed'::text]))),
    CONSTRAINT auth_events_method_check CHECK (((method IS NULL) OR (method = ANY (ARRAY['email'::text, 'google'::text, 'other'::text])))),
    CONSTRAINT auth_events_timezone_length CHECK (((timezone IS NULL) OR (char_length(timezone) <= 64)))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.auth_events'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.auth_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.auth_events_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT blocks_no_self CHECK ((blocker_id <> blocked_id))
);
CREATE TABLE IF NOT EXISTS public.christian_profiles (
    user_id uuid NOT NULL,
    denomination text,
    faith_commitment text,
    church_attendance text,
    prayer_practice text,
    faith_importance text,
    marriage_vision text,
    couple_vision text,
    christian_values text[] DEFAULT '{}'::text[] NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT christian_church_attendance_length CHECK (((church_attendance IS NULL) OR (char_length(church_attendance) <= 100))),
    CONSTRAINT christian_couple_vision_length CHECK (((couple_vision IS NULL) OR (char_length(couple_vision) <= 1000))),
    CONSTRAINT christian_denomination_length CHECK (((denomination IS NULL) OR (char_length(denomination) <= 100))),
    CONSTRAINT christian_faith_commitment_length CHECK (((faith_commitment IS NULL) OR (char_length(faith_commitment) <= 100))),
    CONSTRAINT christian_faith_importance_length CHECK (((faith_importance IS NULL) OR (char_length(faith_importance) <= 100))),
    CONSTRAINT christian_marriage_vision_length CHECK (((marriage_vision IS NULL) OR (char_length(marriage_vision) <= 1000))),
    CONSTRAINT christian_prayer_practice_length CHECK (((prayer_practice IS NULL) OR (char_length(prayer_practice) <= 100))),
    CONSTRAINT christian_values_count CHECK ((cardinality(christian_values) <= 10)),
    CONSTRAINT christian_values_item_length CHECK (public.text_items_max_length(christian_values, 40))
);
CREATE TABLE IF NOT EXISTS public.contact_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    is_flash boolean DEFAULT false NOT NULL,
    CONSTRAINT contact_requests_message_length CHECK (((message IS NULL) OR ((char_length(message) >= 1) AND (char_length(message) <= 300)))),
    CONSTRAINT contact_requests_no_self CHECK ((sender_id <> receiver_id)),
    CONSTRAINT contact_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])))
);
CREATE TABLE IF NOT EXISTS public.conversation_reads (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.conversation_unlocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    paid_by_user_id uuid NOT NULL,
    amount integer DEFAULT 100 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    status public.unlock_status DEFAULT 'pending'::public.unlock_status NOT NULL,
    payment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT unlocks_period CHECK (((expires_at IS NULL) OR (starts_at IS NULL) OR (expires_at > starts_at)))
);
CREATE TABLE IF NOT EXISTS public.conversation_user_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    free_messages_used smallint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversation_user_usage_range CHECK (((free_messages_used >= 0) AND (free_messages_used <= 3)))
);
CREATE TABLE IF NOT EXISTS public.favorites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    favorite_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT favorites_no_self CHECK ((user_id <> favorite_user_id))
);
CREATE TABLE IF NOT EXISTS public.geo_countries (
    code text NOT NULL,
    name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL
);
CREATE TABLE IF NOT EXISTS public.geo_timezones (
    tz text NOT NULL,
    country_codes text[] NOT NULL
);
COMMENT ON TABLE public.geo_timezones IS 'Fuseau horaire IANA → pays où il est utilisé (indice de localisation).';
CREATE TABLE IF NOT EXISTS public.likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    kind public.like_kind DEFAULT 'like'::public.like_kind NOT NULL,
    status public.like_status DEFAULT 'active'::public.like_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT likes_no_self CHECK ((sender_id <> receiver_id))
);
CREATE TABLE IF NOT EXISTS public.location_history (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    source text NOT NULL,
    retained_source text NOT NULL,
    country_code text,
    country text,
    city text,
    ip_country text,
    timezone text,
    inconsistent boolean DEFAULT false NOT NULL,
    inconsistency text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_history_retained_source_check CHECK ((retained_source = ANY (ARRAY['device'::text, 'declared'::text, 'ip'::text]))),
    CONSTRAINT location_history_source_check CHECK ((source = ANY (ARRAY['device'::text, 'declared'::text, 'ip'::text])))
);
COMMENT ON TABLE public.location_history IS 'Positions reçues (appareil, déclarée, IP) et position retenue ; indices d''incohérence. Administration seulement.';
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.location_history'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.location_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.location_history_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_1_id uuid NOT NULL,
    user_2_id uuid NOT NULL,
    status public.match_status DEFAULT 'active'::public.match_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT matches_ordered_pair CHECK ((user_1_id < user_2_id))
);
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    status public.message_status DEFAULT 'delivered'::public.message_status NOT NULL,
    moderation_status public.moderation_status DEFAULT 'clean'::public.moderation_status NOT NULL,
    moderation_flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    contains_phone_number boolean DEFAULT false NOT NULL,
    blocked_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'text'::text NOT NULL,
    audio_path text,
    audio_duration_seconds integer,
    CONSTRAINT messages_content_length CHECK (((char_length(content) >= 1) AND (char_length(content) <= 4000))),
    CONSTRAINT messages_kind_valid CHECK ((((kind = 'text'::text) AND (audio_path IS NULL) AND (audio_duration_seconds IS NULL)) OR ((kind = 'voice'::text) AND (audio_path IS NOT NULL) AND ((audio_duration_seconds >= 1) AND (audio_duration_seconds <= 120))))),
    CONSTRAINT messages_no_phone_number_delivered CHECK ((NOT ((status = 'delivered'::public.message_status) AND contains_phone_number)))
);
CREATE TABLE IF NOT EXISTS public.moderation_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    action public.moderation_action_type NOT NULL,
    reason text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    actor_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['like'::text, 'match'::text, 'message'::text, 'favorite'::text, 'visit'::text, 'contact_request'::text])))
);
CREATE TABLE IF NOT EXISTS public.payment_events (
    id bigint NOT NULL,
    payment_id uuid,
    user_id uuid,
    event text NOT NULL,
    product text,
    amount integer,
    currency text,
    provider text,
    provider_ref text,
    reason text,
    ip text,
    country text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_events_event_check CHECK ((event = ANY (ARRAY['created'::text, 'pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text, 'refunded'::text, 'abandoned'::text, 'webhook'::text]))),
    CONSTRAINT payment_events_reason_length CHECK (((reason IS NULL) OR (char_length(reason) <= 300)))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.payment_events'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.payment_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.payment_events_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type public.payment_type NOT NULL,
    amount integer NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    provider text NOT NULL,
    provider_transaction_id text,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_positive CHECK ((amount > 0))
);
CREATE TABLE IF NOT EXISTS public.photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    status public.photo_status DEFAULT 'pending'::public.photo_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT photos_path_in_owner_folder CHECK ((split_part(storage_path, '/'::text, 1) = (user_id)::text))
);
CREATE TABLE IF NOT EXISTS public.preferences (
    user_id uuid NOT NULL,
    min_age smallint DEFAULT 18 NOT NULL,
    max_age smallint DEFAULT 60 NOT NULL,
    preferred_gender public.gender,
    city text,
    country text,
    max_distance_km integer,
    relationship_goal text,
    family_project text,
    christian_criteria jsonb DEFAULT '{}'::jsonb NOT NULL,
    extra jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT preferences_age_range CHECK (((min_age >= 18) AND (max_age >= min_age) AND (max_age <= 99))),
    CONSTRAINT preferences_family_project_length CHECK (((family_project IS NULL) OR (char_length(family_project) <= 200))),
    CONSTRAINT preferences_relationship_goal_length CHECK (((relationship_goal IS NULL) OR (char_length(relationship_goal) <= 100)))
);
CREATE TABLE IF NOT EXISTS public.profile_boosts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_boosts_period CHECK ((expires_at > starts_at))
);
CREATE TABLE IF NOT EXISTS public.profile_locations (
    user_id uuid NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'device'::text NOT NULL,
    country_code text,
    country text,
    region text,
    city text,
    accuracy_m integer,
    ip_country text,
    ip_city text,
    timezone text,
    language text,
    inconsistent boolean DEFAULT false NOT NULL,
    inconsistency text[] DEFAULT '{}'::text[] NOT NULL,
    checked_at timestamp with time zone,
    CONSTRAINT profile_locations_country_code_check CHECK (((country_code IS NULL) OR (country_code ~ '^[A-Z]{2}$'::text))),
    CONSTRAINT profile_locations_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT profile_locations_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
    CONSTRAINT profile_locations_source_check CHECK ((source = ANY (ARRAY['device'::text, 'declared'::text, 'ip'::text])))
);
COMMENT ON COLUMN public.profile_locations.source IS 'Origine de la position retenue : device (appareil), declared (ville choisie), ip (adresse IP, dernier recours).';
COMMENT ON COLUMN public.profile_locations.inconsistency IS 'Indices qui contredisent la position retenue (ip_country:FR, timezone:Europe/Paris, declared_country:France) : VPN possible.';
CREATE TABLE IF NOT EXISTS public.profile_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    method text NOT NULL,
    storage_path text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    document_type text,
    challenge text,
    challenge_path text,
    document_path text,
    consent_at timestamp with time zone,
    automatic boolean DEFAULT false NOT NULL,
    engine text,
    reason text,
    profile_similarity numeric(5,4),
    document_similarity numeric(5,4),
    liveness_similarity numeric(5,4),
    liveness_shift numeric(5,4),
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    decided_at timestamp with time zone,
    files_deleted_at timestamp with time zone,
    CONSTRAINT profile_verifications_challenge_check CHECK (((challenge IS NULL) OR (challenge = ANY (ARRAY['turn_left'::text, 'turn_right'::text])))),
    CONSTRAINT profile_verifications_document_type_check CHECK (((document_type IS NULL) OR (document_type = ANY (ARRAY['id_card'::text, 'passport'::text, 'student_card'::text, 'school_card'::text])))),
    CONSTRAINT profile_verifications_files_owner CHECK ((((challenge_path IS NULL) OR (split_part(challenge_path, '/'::text, 1) = (user_id)::text)) AND ((document_path IS NULL) OR (split_part(document_path, '/'::text, 1) = (user_id)::text)))),
    CONSTRAINT profile_verifications_method_check CHECK ((method = ANY (ARRAY['selfie'::text, 'id_document'::text]))),
    CONSTRAINT profile_verifications_path_owner CHECK ((split_part(storage_path, '/'::text, 1) = (user_id)::text)),
    CONSTRAINT profile_verifications_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
);
COMMENT ON COLUMN public.profile_verifications.reason IS 'Motif de la décision : match, no_face, multiple_faces, blurry, not_frontal, liveness_failed, wrong_direction, no_profile_face, document_no_face, mismatch, gray_zone, engine_unavailable, files_missing, abandoned, manual.';
CREATE TABLE IF NOT EXISTS public.profile_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_id uuid NOT NULL,
    visited_user_id uuid NOT NULL,
    visited_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_visits_no_self CHECK ((visitor_id <> visited_user_id))
);
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id uuid NOT NULL,
    first_name text,
    birth_date date,
    gender public.gender,
    city text,
    country text,
    latitude double precision,
    longitude double precision,
    profession text,
    education_level text,
    marital_status text,
    has_children boolean,
    children_count smallint,
    bio text,
    personality jsonb DEFAULT '{}'::jsonb NOT NULL,
    interests text[] DEFAULT '{}'::text[] NOT NULL,
    status public.profile_status DEFAULT 'incomplete'::public.profile_status NOT NULL,
    visibility public.profile_visibility DEFAULT 'visible'::public.profile_visibility NOT NULL,
    onboarding_step smallint DEFAULT 0 NOT NULL,
    onboarding_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    region text,
    origin text,
    terms_accepted_at timestamp with time zone,
    is_virtual boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    demo_photo_path text,
    demo_photo_source text,
    CONSTRAINT profiles_bio_length CHECK (((bio IS NULL) OR (char_length(bio) <= 2000))),
    CONSTRAINT profiles_children_check CHECK (((children_count IS NULL) OR ((has_children IS TRUE) AND ((children_count >= 1) AND (children_count <= 20))))),
    CONSTRAINT profiles_city_length CHECK (((city IS NULL) OR (char_length(city) <= 100))),
    CONSTRAINT profiles_country_length CHECK (((country IS NULL) OR (char_length(country) <= 100))),
    CONSTRAINT profiles_demo_photo_check CHECK ((((demo_photo_path IS NULL) AND (demo_photo_source IS NULL)) OR (is_virtual AND ((char_length(demo_photo_path) >= 1) AND (char_length(demo_photo_path) <= 300)) AND ((split_part(demo_photo_path, '/'::text, 1) = (user_id)::text) OR (demo_photo_path ~ '^/demo-profils/[a-z0-9-]+\.(webp|jpg|png)$'::text)) AND (demo_photo_source = ANY (ARRAY['generated'::text, 'licensed'::text, 'consent'::text]))))),
    CONSTRAINT profiles_first_name_length CHECK (((first_name IS NULL) OR ((char_length(first_name) >= 1) AND (char_length(first_name) <= 60)))),
    CONSTRAINT profiles_interests_count CHECK ((cardinality(interests) <= 10)),
    CONSTRAINT profiles_interests_item_length CHECK (public.text_items_max_length(interests, 40)),
    CONSTRAINT profiles_marital_status_check CHECK (((marital_status IS NULL) OR (marital_status = ANY (ARRAY['never_married'::text, 'divorced'::text, 'widowed'::text])))),
    CONSTRAINT profiles_origin_length CHECK (((origin IS NULL) OR (char_length(origin) <= 60))),
    CONSTRAINT profiles_profession_length CHECK (((profession IS NULL) OR (char_length(profession) <= 100))),
    CONSTRAINT profiles_region_length CHECK (((region IS NULL) OR (char_length(region) <= 100)))
);
COMMENT ON COLUMN public.profiles.demo_photo_path IS 'Profil de démonstration : chemin de la photo dans le stockage public « demo-profils ».';
COMMENT ON COLUMN public.profiles.demo_photo_source IS 'Nature attestée par l''administrateur : generated (personne qui n''existe pas), licensed (licence), consent (accord écrit).';
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid NOT NULL,
    conversation_id uuid,
    message_id uuid,
    reason public.report_reason NOT NULL,
    description text,
    status public.report_status DEFAULT 'open'::public.report_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reports_description_length CHECK (((description IS NULL) OR (char_length(description) <= 2000))),
    CONSTRAINT reports_no_self CHECK ((reporter_id <> reported_user_id))
);
CREATE TABLE IF NOT EXISTS public.server_errors (
    id bigint NOT NULL,
    source text NOT NULL,
    message text NOT NULL,
    user_id uuid,
    path text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT server_errors_message_length CHECK ((char_length(message) <= 2000)),
    CONSTRAINT server_errors_path_length CHECK (((path IS NULL) OR (char_length(path) <= 300))),
    CONSTRAINT server_errors_source_length CHECK ((char_length(source) <= 100))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.server_errors'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.server_errors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.server_errors_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.signup_events (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    step text NOT NULL,
    method text,
    country text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT signup_events_step_check CHECK ((step = ANY (ARRAY['account_created'::text, 'step_1'::text, 'step_2'::text, 'step_3'::text, 'step_4'::text, 'profile_completed'::text, 'verification_requested'::text, 'verification_approved'::text, 'verification_rejected'::text])))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.signup_events'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.signup_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.signup_events_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
    id bigint NOT NULL,
    bucket_id text NOT NULL,
    path text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    done_at timestamp with time zone,
    CONSTRAINT storage_cleanup_queue_reason_length CHECK ((char_length(reason) <= 100))
);
DO $identity$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute
                 WHERE attrelid = 'public.storage_cleanup_queue'::pg_catalog.regclass
                   AND attname = 'id' AND attidentity <> '') THEN
    ALTER TABLE public.storage_cleanup_queue ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
        SEQUENCE NAME public.storage_cleanup_queue_id_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    );
  END IF;
END
$identity$;
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan public.subscription_plan DEFAULT 'premium_monthly'::public.subscription_plan NOT NULL,
    amount integer DEFAULT 500 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status public.subscription_status DEFAULT 'pending'::public.subscription_status NOT NULL,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    payment_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_period CHECK (((expires_at IS NULL) OR (starts_at IS NULL) OR (expires_at > starts_at)))
);
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    admin_reply text,
    answered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_tickets_admin_reply_check CHECK (((admin_reply IS NULL) OR (char_length(admin_reply) <= 4000))),
    CONSTRAINT support_tickets_message_check CHECK (((char_length(message) >= 10) AND (char_length(message) <= 4000))),
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['normal'::text, 'priority'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'closed'::text]))),
    CONSTRAINT support_tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 120)))
);
CREATE TABLE IF NOT EXISTS public.user_activity (
    user_id uuid NOT NULL,
    last_login_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    is_online boolean DEFAULT false NOT NULL,
    login_count integer DEFAULT 0 NOT NULL,
    events jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id uuid NOT NULL,
    activity_visible boolean DEFAULT true NOT NULL,
    notify_email boolean DEFAULT true NOT NULL,
    notify_messages boolean DEFAULT true NOT NULL,
    notify_matches boolean DEFAULT true NOT NULL,
    notify_likes boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    marketing_emails boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    status public.account_status DEFAULT 'active'::public.account_status NOT NULL,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.verification_settings (
    id boolean DEFAULT true NOT NULL,
    accept_similarity numeric(4,3) DEFAULT 0.550 NOT NULL,
    reject_similarity numeric(4,3) DEFAULT 0.400 NOT NULL,
    aws_accept_similarity numeric(4,3) DEFAULT 0.950 NOT NULL,
    aws_reject_similarity numeric(4,3) DEFAULT 0.800 NOT NULL,
    liveness_min_shift numeric(4,3) DEFAULT 0.080 NOT NULL,
    min_sharpness numeric(8,2) DEFAULT 15 NOT NULL,
    max_attempts_per_day integer DEFAULT 5 NOT NULL,
    file_retention_hours integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT verification_settings_accept_similarity_check CHECK (((accept_similarity >= (0)::numeric) AND (accept_similarity <= (1)::numeric))),
    CONSTRAINT verification_settings_aws_accept_similarity_check CHECK (((aws_accept_similarity >= (0)::numeric) AND (aws_accept_similarity <= (1)::numeric))),
    CONSTRAINT verification_settings_aws_order CHECK ((aws_reject_similarity <= aws_accept_similarity)),
    CONSTRAINT verification_settings_aws_reject_similarity_check CHECK (((aws_reject_similarity >= (0)::numeric) AND (aws_reject_similarity <= (1)::numeric))),
    CONSTRAINT verification_settings_file_retention_hours_check CHECK (((file_retention_hours >= 0) AND (file_retention_hours <= 720))),
    CONSTRAINT verification_settings_id_check CHECK (id),
    CONSTRAINT verification_settings_liveness_min_shift_check CHECK (((liveness_min_shift >= (0)::numeric) AND (liveness_min_shift <= 0.5))),
    CONSTRAINT verification_settings_local_order CHECK ((reject_similarity <= accept_similarity)),
    CONSTRAINT verification_settings_max_attempts_per_day_check CHECK (((max_attempts_per_day >= 1) AND (max_attempts_per_day <= 50))),
    CONSTRAINT verification_settings_min_sharpness_check CHECK ((min_sharpness >= (0)::numeric)),
    CONSTRAINT verification_settings_reject_similarity_check CHECK (((reject_similarity >= (0)::numeric) AND (reject_similarity <= (1)::numeric)))
);
COMMENT ON TABLE public.verification_settings IS 'Vérification d''identité automatique : seuils de ressemblance, vivacité, netteté, essais par jour, conservation des images.';
CREATE TABLE IF NOT EXISTS public.virtual_profile_removals (
    user_id uuid NOT NULL,
    removed_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reason text
);

-- ============================================================================
-- 8. Clés primaires et valeurs uniques
-- ============================================================================

DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.activity_events'::pg_catalog.regclass AND conname = 'activity_events_pkey') THEN
    ALTER TABLE ONLY public.activity_events
      ADD CONSTRAINT activity_events_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ad_events'::pg_catalog.regclass AND conname = 'ad_events_pkey') THEN
    ALTER TABLE ONLY public.ad_events
      ADD CONSTRAINT ad_events_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ad_settings'::pg_catalog.regclass AND conname = 'ad_settings_pkey') THEN
    ALTER TABLE ONLY public.ad_settings
      ADD CONSTRAINT ad_settings_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.admin_audit_log'::pg_catalog.regclass AND conname = 'admin_audit_log_pkey') THEN
    ALTER TABLE ONLY public.admin_audit_log
      ADD CONSTRAINT admin_audit_log_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ads'::pg_catalog.regclass AND conname = 'ads_pkey') THEN
    ALTER TABLE ONLY public.ads
      ADD CONSTRAINT ads_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ai_usage'::pg_catalog.regclass AND conname = 'ai_usage_pkey') THEN
    ALTER TABLE ONLY public.ai_usage
      ADD CONSTRAINT ai_usage_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ai_usage'::pg_catalog.regclass AND conname = 'ai_usage_user_id_feature_usage_date_key') THEN
    ALTER TABLE ONLY public.ai_usage
      ADD CONSTRAINT ai_usage_user_id_feature_usage_date_key UNIQUE (user_id, feature, usage_date);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.auth_events'::pg_catalog.regclass AND conname = 'auth_events_pkey') THEN
    ALTER TABLE ONLY public.auth_events
      ADD CONSTRAINT auth_events_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.blocks'::pg_catalog.regclass AND conname = 'blocks_blocker_id_blocked_id_key') THEN
    ALTER TABLE ONLY public.blocks
      ADD CONSTRAINT blocks_blocker_id_blocked_id_key UNIQUE (blocker_id, blocked_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.blocks'::pg_catalog.regclass AND conname = 'blocks_pkey') THEN
    ALTER TABLE ONLY public.blocks
      ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.christian_profiles'::pg_catalog.regclass AND conname = 'christian_profiles_pkey') THEN
    ALTER TABLE ONLY public.christian_profiles
      ADD CONSTRAINT christian_profiles_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.contact_requests'::pg_catalog.regclass AND conname = 'contact_requests_pkey') THEN
    ALTER TABLE ONLY public.contact_requests
      ADD CONSTRAINT contact_requests_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_reads'::pg_catalog.regclass AND conname = 'conversation_reads_pkey') THEN
    ALTER TABLE ONLY public.conversation_reads
      ADD CONSTRAINT conversation_reads_pkey PRIMARY KEY (conversation_id, user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_unlocks'::pg_catalog.regclass AND conname = 'conversation_unlocks_pkey') THEN
    ALTER TABLE ONLY public.conversation_unlocks
      ADD CONSTRAINT conversation_unlocks_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_user_usage'::pg_catalog.regclass AND conname = 'conversation_user_usage_conversation_id_user_id_key') THEN
    ALTER TABLE ONLY public.conversation_user_usage
      ADD CONSTRAINT conversation_user_usage_conversation_id_user_id_key UNIQUE (conversation_id, user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_user_usage'::pg_catalog.regclass AND conname = 'conversation_user_usage_pkey') THEN
    ALTER TABLE ONLY public.conversation_user_usage
      ADD CONSTRAINT conversation_user_usage_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;
