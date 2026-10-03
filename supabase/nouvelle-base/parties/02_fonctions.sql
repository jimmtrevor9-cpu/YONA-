-- YONA — base de données complète, partie 2 sur 5
-- Contenu :
--   4. Fonctions : les règles du site exécutées par la base (suite)
--   5. Table utilisée par les fonctions qui suivent
--   6. Fonctions : les règles du site exécutées par la base (suite)
-- À exécuter dans l'ordre (01, 02, …), chaque partie en entier :
-- Supabase → SQL Editor → New query → coller la partie → Run.
-- Chaque partie peut être relancée sans danger (par exemple après une erreur).
-- Fichier généré par scripts/generate-base-complete.py. Ne pas modifier à la main.

SET client_min_messages = warning;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;
CREATE OR REPLACE FUNCTION public.contains_phone_number(_text text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
DECLARE
  _t text := coalesce(_text, '');
  _prev text;
BEGIN
  -- Variantes du signe plus ramenées à « + » (6.2).
  _t := translate(_t, '＋⁺', '++');
  -- 6.3 — Tous les espaces ramenés à une espace simple.
  _t := translate(
    _t,
    E'              　\t\r\n\v\f',
    '                     '
  );
  -- 6.6 — Caractères invisibles supprimés (sélecteurs d'émoji, touches, largeur nulle).
  _t := regexp_replace(_t, E'[️︎⃣​‌‍⁠﻿]', '', 'g');
  -- 6.6 — Chiffres spéciaux ramenés aux chiffres ordinaires.
  _t := translate(_t, '０１２３４５６７８９', '0123456789');
  _t := translate(_t, '⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉', '01234567890123456789');
  _t := translate(_t, '⓪①②③④⑤⑥⑦⑧⑨⓿❶❷❸❹❺❻❼❽❾', '01234567890123456789');
  _t := translate(_t, '➀➁➂➃➄➅➆➇➈➊➋➌➍➎➏➐➑➒', '123456789123456789');
  _t := translate(_t, '𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗𝟘𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠𝟡', '01234567890123456789');
  _t := translate(_t, '𝟢𝟣𝟤𝟥𝟦𝟧𝟨𝟩𝟪𝟫𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵𝟶𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾𝟿', '012345678901234567890123456789');
  _t := translate(_t, '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789');

  _t := lower(_t);
  -- Accents retirés (pour « zéro » et les mots séparateurs).
  _t := translate(_t, 'àâäáãåéèêëíìîïóòôöõúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn');
  -- 6.4 — Tirets typographiques ramenés au tiret simple.
  _t := translate(_t, '‐‑‒–—−﹣－', '--------');
  -- 6.5 — Parenthèses et crochets (y compris pleine largeur) ramenés à ( et ).
  _t := translate(_t, '（）［］｛｝[]{}', '()()()()()');

  -- 6.6 — Nombres écrits en lettres (français, puis anglais), du plus long au plus court.
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]sept\M', ' 97 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]huit\M', ' 98 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix[- ]neuf\M', ' 99 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]onze\M', ' 91 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]douze\M', ' 92 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]treize\M', ' 93 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatorze\M', ' 94 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quinze\M', ' 95 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]seize\M', ' 96 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]dix\M', ' 90 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ](un|une)\M', ' 81 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]deux\M', ' 82 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]trois\M', ' 83 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]quatre\M', ' 84 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]cinq\M', ' 85 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]six\M', ' 86 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]sept\M', ' 87 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]huit\M', ' 88 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?[- ]neuf\M', ' 89 ', 'g');
  _t := regexp_replace(_t, '\mquatre[- ]vingts?\M', ' 80 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]sept\M', ' 77 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]huit\M', ' 78 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix[- ]neuf\M', ' 79 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?onze\M', ' 71 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]douze\M', ' 72 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]treize\M', ' 73 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quatorze\M', ' 74 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]quinze\M', ' 75 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]seize\M', ' 76 ', 'g');
  _t := regexp_replace(_t, '\msoixante[- ]dix\M', ' 70 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]sept\M', ' 17 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]huit\M', ' 18 ', 'g');
  _t := regexp_replace(_t, '\mdix[- ]neuf\M', ' 19 ', 'g');
  -- Dizaines suivies d'une unité (« trente-quatre », « vingt et un »).
  _t := regexp_replace(_t, '\mvingt[- ](et[- ])?', ' 2', 'g');
  _t := regexp_replace(_t, '\mtrente[- ](et[- ])?', ' 3', 'g');
  _t := regexp_replace(_t, '\mquarante[- ](et[- ])?', ' 4', 'g');
  _t := regexp_replace(_t, '\mcinquante[- ](et[- ])?', ' 5', 'g');
  _t := regexp_replace(_t, '\msoixante[- ](et[- ])?', ' 6', 'g');
  _t := regexp_replace(_t, '\m([2-6])(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf)\M', '\1\2', 'g');
  _t := regexp_replace(_t, '\mvingt\M', ' 20 ', 'g');
  _t := regexp_replace(_t, '\mtrente\M', ' 30 ', 'g');
  _t := regexp_replace(_t, '\mquarante\M', ' 40 ', 'g');
  _t := regexp_replace(_t, '\mcinquante\M', ' 50 ', 'g');
  _t := regexp_replace(_t, '\msoixante\M', ' 60 ', 'g');
  _t := regexp_replace(_t, '\monze\M', ' 11 ', 'g');
  _t := regexp_replace(_t, '\mdouze\M', ' 12 ', 'g');
  _t := regexp_replace(_t, '\mtreize\M', ' 13 ', 'g');
  _t := regexp_replace(_t, '\mquatorze\M', ' 14 ', 'g');
  _t := regexp_replace(_t, '\mquinze\M', ' 15 ', 'g');
  _t := regexp_replace(_t, '\mseize\M', ' 16 ', 'g');
  _t := regexp_replace(_t, '\mdix\M', ' 10 ', 'g');
  -- Unités (une dizaine déjà convertie peut précéder : « 3quatre » → « 34 »).
  _t := regexp_replace(_t, '(zero|\mzero)\M', ' 0 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)(un|une)\M', '\1 1 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)deux\M', '\1 2 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)trois\M', '\1 3 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)quatre\M', '\1 4 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)cinq\M', '\1 5 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)six\M', '\1 6 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)sept\M', '\1 7 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)huit\M', '\1 8 ', 'g');
  _t := regexp_replace(_t, '([2-6]|\m)neuf\M', '\1 9 ', 'g');
  _t := regexp_replace(_t, '([2-6]) ([0-9]) ', '\1\2 ', 'g');
  -- Anglais.
  _t := regexp_replace(_t, '\mone\M', ' 1 ', 'g');
  _t := regexp_replace(_t, '\mtwo\M', ' 2 ', 'g');
  _t := regexp_replace(_t, '\mthree\M', ' 3 ', 'g');
  _t := regexp_replace(_t, '\mfour\M', ' 4 ', 'g');
  _t := regexp_replace(_t, '\mfive\M', ' 5 ', 'g');
  _t := regexp_replace(_t, '\mseven\M', ' 7 ', 'g');
  _t := regexp_replace(_t, '\meight\M', ' 8 ', 'g');
  _t := regexp_replace(_t, '\mnine\M', ' 9 ', 'g');
  -- Mots utilisés comme séparateurs.
  _t := regexp_replace(_t, '\m(point|tiret|espace|virgule|slash|dot|dash)\M', ' ', 'g');

  -- 6.6 — Lettres utilisées comme chiffres entre des chiffres : o → 0 ; l, i, | → 1.
  LOOP
    _prev := _t;
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)o(?=[^[:alpha:][:digit:]]*[0-9])', '\10', 'g');
    _t := regexp_replace(_t, '([0-9][^[:alpha:][:digit:]]*)[li|](?=[^[:alpha:][:digit:]]*[0-9])', '\11', 'g');
    _t := regexp_replace(_t, '\mo(?=[0-9])', '0', 'g');
    EXIT WHEN _t = _prev;
  END LOOP;

  -- Formes ordinaires écartées : montants avec devise (séparateurs de milliers en
  -- espaces, points, virgules ou apostrophes), dates, heures et plages horaires.
  _t := regexp_replace(
    _t,
    '[0-9]{1,3}([ .,''][0-9]{3})+ ?(f ?cfa|cfa|xaf|xof|francs?|f\M|€|euros?|eur\M|\$|usd|dollars?)',
    ' ', 'g');
  _t := regexp_replace(_t, '(€|\$|usd|eur) ?[0-9]{1,3}([ .,''][0-9]{3})+', ' ', 'g');
  _t := regexp_replace(_t, '\m[0-9]{1,2} ?[ ./-] ?[0-9]{1,2} ?[ ./-] ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?[./-] ?[0-9]{1,2} ?[./-] ?[0-9]{1,2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?- ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9] ?(-|a) ?([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M',
    ' ', 'g');
  _t := regexp_replace(
    _t,
    '\m([01]?[0-9]|2[0-3]) ?[:h] ?[0-5][0-9]\M(?![ ]*[:./-][ ]*[0-9])',
    ' ', 'g');

  -- Séparateurs entre les chiffres (et après un « + ») supprimés : espaces (6.3),
  -- tirets (6.4), parenthèses (6.5) et tout autre signe (6.6).
  _t := regexp_replace(_t, '\(( ?\+? ?[0-9][0-9 -]*) ?\)', ' \1 ', 'g');
  _t := regexp_replace(_t, '\+[^[:alpha:][:digit:]+]+(?=[0-9])', '+', 'g');
  _t := regexp_replace(_t, '([0-9])[^[:alpha:][:digit:]+]+(?=[0-9])', '\1', 'g');

  -- 6.1 — Numéro classique : au moins 8 chiffres à la suite.
  IF _t ~ '[0-9]{8,}' THEN
    RETURN true;
  END IF;

  -- 6.2 — Format international : « + » suivi d'au moins 7 chiffres.
  IF _t ~ '\+[0-9]{7,}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$_$;
CREATE OR REPLACE FUNCTION public.count_member_login() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_activity AS a (user_id, last_login_at, login_count)
  SELECT NEW.user_id, NEW.created_at, 1
  WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id)
  ON CONFLICT (user_id) DO UPDATE
    SET login_count = a.login_count + 1,
        last_login_at = greatest(a.last_login_at, EXCLUDED.last_login_at);
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.create_conversation_for_match() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (match_id, user_1_id, user_2_id)
  VALUES (NEW.id, NEW.user_1_id, NEW.user_2_id)
  ON CONFLICT (match_id) DO UPDATE SET status = 'open'
    WHERE public.conversations.status = 'closed';
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.create_match_on_mutual_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _a uuid := least(NEW.sender_id, NEW.receiver_id);
  _b uuid := greatest(NEW.sender_id, NEW.receiver_id);
BEGIN
  IF NEW.kind <> 'like' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.kind = 'like' AND OLD.status = 'active' THEN
    RETURN NEW; -- Like déjà actif : rien de nouveau
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  IF EXISTS (
       SELECT 1 FROM public.likes
       WHERE sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id
         AND kind = 'like' AND status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks
       WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
     )
  THEN
    INSERT INTO public.matches (user_1_id, user_2_id)
    VALUES (_a, _b)
    ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
      WHERE public.matches.status = 'unmatched';
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.create_notification(_user_id uuid, _type text, _actor_id uuid, _data jsonb, _group_key text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.create_support_ticket(_subject text, _message text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.discover_profiles(_limit integer DEFAULT 30) RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, region text, country text, bio text, gender public.gender, interests text[], is_virtual boolean, is_verified boolean, relationship_goal text, photo_path text, demo_photo_path text, distance_km integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
             PARTITION BY c.pgender
             ORDER BY c.virt, c.boosted DESC, c.premium DESC, c.pupdated DESC
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
CREATE OR REPLACE FUNCTION public.distance_km(_lat1 double precision, _lng1 double precision, _lat2 double precision, _lng2 double precision) RETURNS double precision
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT 2 * 6371 * asin(sqrt(least(1,
    sin(radians(_lat2 - _lat1) / 2) ^ 2
    + cos(radians(_lat1)) * cos(radians(_lat2)) * sin(radians(_lng2 - _lng1) / 2) ^ 2
  )))
$$;
CREATE OR REPLACE FUNCTION public.enforce_photo_limit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.expire_conversation_unlocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.conversation_unlocks u
     SET status = 'expired'
   WHERE u.status = 'active' AND u.expires_at IS NOT NULL AND u.expires_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
CREATE OR REPLACE FUNCTION public.expire_subscriptions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.subscriptions s SET status = 'expired'
  WHERE s.status = 'active' AND s.expires_at IS NOT NULL AND s.expires_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;
CREATE OR REPLACE FUNCTION public.expire_verification_attempts(_user_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _id uuid;
  _n integer := 0;
BEGIN
  FOR _id IN
    UPDATE public.profile_verifications
    SET status = 'rejected', reason = 'abandoned', decided_at = now()
    WHERE status = 'processing' AND created_at < now() - interval '30 minutes'
      AND (_user_id IS NULL OR user_id = _user_id)
    RETURNING id
  LOOP
    PERFORM public.queue_verification_files(_id, 'vérification abandonnée');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;
CREATE OR REPLACE FUNCTION public.get_ads_for_me(_placement text DEFAULT 'discover'::text, _limit integer DEFAULT 3) RETURNS TABLE(id uuid, title text, body text, advertiser text, media_type text, media_path text, poster_path text, cta_label text, cta_url text, cta_icon text, every_n integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
CREATE OR REPLACE FUNCTION public.get_ai_quota(_feature text DEFAULT 'roi_salomon'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 3, 'remaining', 0,
      'unlimited', false);
  END IF;
  _premium := public.is_premium(_uid);
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = public.ai_usage_day();
  _used := coalesce(_used, 0);
  RETURN jsonb_build_object('allowed', _premium OR _used < 3, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;
CREATE OR REPLACE FUNCTION public.get_compatibility(_other uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _b jsonb;
  _score integer;
  _premium boolean;
  _strong text[];
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_view_profile(_other) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  _b := public.compatibility_breakdown(_me, _other);
  _score := (_b->>'score')::integer;
  _premium := public.is_premium(_me);
  -- Explication courte (pour tous) : les points forts, sans le détail des réponses.
  SELECT coalesce(array_agg(lower(d->>'label')), '{}') INTO _strong
  FROM jsonb_array_elements(_b->'details') d
  WHERE (d->>'matched')::boolean;
  RETURN jsonb_build_object(
    'score', _score,
    'level', CASE WHEN _score IS NULL THEN NULL
                  WHEN _score >= 80 THEN 'excellent'
                  WHEN _score >= 60 THEN 'good'
                  WHEN _score >= 40 THEN 'medium'
                  ELSE 'low' END,
    'summary', CASE
      WHEN _score IS NULL THEN 'Pas encore assez d''informations dans vos profils pour calculer la compatibilité.'
      WHEN cardinality(_strong) = 0 THEN 'Peu de points communs dans vos profils pour le moment.'
      ELSE 'Points forts : ' || array_to_string(_strong[1:3], ', ') || '.'
    END,
    'premium', _premium,
    'details', CASE WHEN _premium THEN _b->'details' ELSE NULL END
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.get_compatibility_scores(_user_ids uuid[]) RETURNS TABLE(user_id uuid, score integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT u, (public.compatibility_breakdown(auth.uid(), u)->>'score')::integer
  FROM (SELECT DISTINCT unnest(_user_ids[1:60]) AS u) ids
  WHERE public.can_view_profile(u)
$$;
CREATE OR REPLACE FUNCTION public.get_contact_request_quota() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  _premium := public.is_premium(_me);
  SELECT count(*)::integer INTO _used FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
  RETURN jsonb_build_object(
    'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 5 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(5 - _used, 0) END,
    'unlimited', _premium,
    'resets_at', public.utc_day_start() + interval '1 day'
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.get_conversation_quota(_conversation_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ DECLARE _uid uuid := auth.uid(); _used smallint := 0; _premium boolean; _unlocked boolean; BEGIN IF _uid IS NULL OR NOT public.is_conversation_participant(_conversation_id, _uid) THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_participant'); END IF; _premium := public.is_premium(_uid); _unlocked := public.has_active_conversation_unlock(_conversation_id); SELECT COALESCE(free_messages_used, 0) INTO _used FROM public.conversation_user_usage WHERE conversation_id = _conversation_id AND user_id = _uid; _used := COALESCE(_used, 0); RETURN jsonb_build_object('allowed', _premium OR _unlocked OR _used < 3, 'used', _used, 'limit', CASE WHEN _premium OR _unlocked THEN NULL ELSE 3 END, 'premium', _premium, 'unlocked', _unlocked); END; $$;
CREATE OR REPLACE FUNCTION public.get_favorited_by() RETURNS TABLE(user_id uuid, first_name text, birth_date date, city text, country text, favorited_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(auth.uid()) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT f.user_id, p.first_name, p.birth_date, p.city, p.country, f.created_at
  FROM public.favorites f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.favorite_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(f.user_id)
    AND NOT public.is_blocked_between(auth.uid(), f.user_id)
  ORDER BY f.created_at DESC;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_message_quota(_conversation_id uuid) RETURNS TABLE(used integer, quota_limit integer, remaining integer, exhausted boolean, unlocked boolean, unlocked_by uuid, unlock_expires_at timestamp with time zone, last_unlock_expired_at timestamp with time zone, premium boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;
CREATE OR REPLACE FUNCTION public.get_my_boost() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.get_my_premium() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _end timestamptz;
  _plan public.subscription_plan;
  _s record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    SELECT max(s.expires_at) INTO _end FROM public.subscriptions s
    WHERE s.user_id = _uid AND s.status IN ('active', 'expired') AND s.expires_at <= now();
    RETURN jsonb_build_object('premium', false, 'expired_at', _end);
  END IF;
  -- Fin de la période continue (abonnements qui se suivent).
  _end := now();
  FOR _s IN
    SELECT s.starts_at, s.expires_at, s.plan FROM public.subscriptions s
    WHERE s.user_id = _uid AND s.status = 'active' AND s.expires_at > now()
    ORDER BY s.starts_at
  LOOP
    IF _s.starts_at <= _end THEN
      _end := greatest(_end, _s.expires_at);
      _plan := _s.plan;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('premium', true, 'plan', _plan, 'expires_at', _end);
END;
$$;
CREATE OR REPLACE FUNCTION public.get_premium_badges(_user_ids uuid[]) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT DISTINCT u
  FROM unnest(_user_ids[1:200]) AS u
  WHERE auth.uid() IS NOT NULL
    AND public.is_premium(u)
    AND (
      u = auth.uid()
      OR (public.can_browse_profiles()
          AND public.is_discoverable_profile(u)
          AND NOT public.is_blocked_between(auth.uid(), u))
    )
$$;
CREATE OR REPLACE FUNCTION public.get_presence(_user_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;
CREATE OR REPLACE FUNCTION public.get_profile_visitors() RETURNS TABLE(visitor_id uuid, first_name text, birth_date date, city text, country text, visited_at timestamp with time zone, visit_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(auth.uid()) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT v.visitor_id, p.first_name, p.birth_date, p.city, p.country,
         max(v.visited_at) AS visited_at, count(*)::integer AS visit_count
  FROM public.profile_visits v
  JOIN public.profiles p ON p.user_id = v.visitor_id
  WHERE v.visited_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(v.visitor_id)
    AND NOT public.is_blocked_between(auth.uid(), v.visitor_id)
  GROUP BY v.visitor_id, p.first_name, p.birth_date, p.city, p.country
  ORDER BY max(v.visited_at) DESC
  LIMIT 100;
END;
$$;
CREATE OR REPLACE FUNCTION public.get_unread_counts() RETURNS TABLE(conversation_id uuid, unread integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT c.id, count(m.id)::integer
  FROM public.conversations c
  JOIN public.matches ma ON ma.id = c.match_id AND ma.status = 'active'
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END AS other_id
  ) o
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = auth.uid()
  JOIN public.messages m ON m.conversation_id = c.id
    AND m.status = 'delivered'
    AND m.sender_id = o.other_id
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  WHERE auth.uid() IN (c.user_1_id, c.user_2_id)
    AND c.status <> 'closed'
    AND public.is_discoverable_profile(o.other_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = o.other_id)
         OR (b.blocker_id = o.other_id AND b.blocked_id = auth.uid())
    )
  GROUP BY c.id
$$;
CREATE OR REPLACE FUNCTION public.get_unread_notification_count() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(*)::integer FROM public.notifications n
  WHERE n.user_id = auth.uid() AND n.read_at IS NULL
    AND (n.actor_id IS NULL OR NOT public.is_blocked_between(auth.uid(), n.actor_id))
$$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  _first text;
BEGIN
  _first := NULLIF(btrim(_meta ->> 'first_name'), '');
  IF _first IS NULL THEN
    _first := NULLIF(btrim(_meta ->> 'given_name'), '');
  END IF;
  IF _first IS NULL THEN
    _first := NULLIF(split_part(btrim(COALESCE(_meta ->> 'full_name', _meta ->> 'name', '')), ' ', 1), '');
  END IF;
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.profiles (user_id, first_name) VALUES (NEW.id, left(_first, 60));
  INSERT INTO public.christian_profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_activity (user_id, last_login_at, last_seen_at) VALUES (NEW.id, now(), now());
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.has_active_conversation_unlock(_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (
      auth.uid() IS NULL
      OR public.is_conversation_participant(_conversation_id, auth.uid())
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_unlocks u
      WHERE u.conversation_id = _conversation_id AND u.status = 'active'
        AND u.starts_at IS NOT NULL AND u.starts_at <= now()
        AND u.expires_at IS NOT NULL AND u.expires_at > now()
    )
$$;
CREATE OR REPLACE FUNCTION public.has_mutual_like(_other uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND _other IS NOT NULL
    AND _other <> auth.uid()
    AND NOT public.is_blocked_between(auth.uid(), _other)
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = auth.uid() AND receiver_id = _other AND kind = 'like' AND status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = _other AND receiver_id = auth.uid() AND kind = 'like' AND status = 'active'
    )
$$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (
      auth.uid() IS NULL
      OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.init_conversation_usage() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
  VALUES (NEW.id, NEW.user_1_id, 0), (NEW.id, NEW.user_2_id, 0)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.is_active_account(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id AND u.status = 'active')
$$;
CREATE OR REPLACE FUNCTION public.is_activity_visible(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce((SELECT s.activity_visible FROM public.user_settings s WHERE s.user_id = _user_id), true)
$$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() IN (_a, _b) OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
    )
$$;
CREATE OR REPLACE FUNCTION public.is_boosted(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _user_id AND b.starts_at <= now() AND b.expires_at > now()
  ) AND public.is_premium(_user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_conversation_folder_participant(_folder text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = _folder AND auth.uid() IN (c.user_1_id, c.user_2_id)
  )
$$;
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = _conversation_id AND (_user_id = user_1_id OR _user_id = user_2_id)
    )
$$;
CREATE OR REPLACE FUNCTION public.is_discoverable_profile(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = _user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active'
      AND (NOT p.is_virtual OR p.demo_photo_path IS NOT NULL)
  )
$$;
CREATE OR REPLACE FUNCTION public.is_identity_verified(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.user_id = _user_id AND (p.verified_at IS NOT NULL OR p.is_virtual))
         OR public.has_role(_user_id, 'admin')
$$;
CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  )
$$;
CREATE OR REPLACE FUNCTION public.is_real_member(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.is_virtual)
$$;
CREATE OR REPLACE FUNCTION public.list_blocked_users() RETURNS TABLE(user_id uuid, first_name text, blocked_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT b.blocked_id, p.first_name, b.created_at
  FROM public.blocks b
  LEFT JOIN public.profiles p ON p.user_id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC
$$;
CREATE OR REPLACE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received'::text) RETURNS TABLE(id uuid, other_user_id uuid, first_name text, birth_date date, city text, country text, message text, status text, created_at timestamp with time zone, responded_at timestamp with time zone, is_flash boolean)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _direction NOT IN ('received', 'sent') THEN
    RAISE EXCEPTION 'invalid_direction' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT r.id, o.user_id, o.first_name, o.birth_date, o.city, o.country, r.message,
         r.status, r.created_at, r.responded_at, r.is_flash
  FROM public.contact_requests r
  JOIN public.profiles o
    ON o.user_id = CASE WHEN _direction = 'received' THEN r.sender_id ELSE r.receiver_id END
  WHERE (CASE WHEN _direction = 'received' THEN r.receiver_id ELSE r.sender_id END) = _me
    AND public.is_discoverable_profile(o.user_id)
    AND NOT public.is_blocked_between(_me, o.user_id)
  -- 17.4 : parmi les demandes en attente, les Messages Flash d'abord.
  ORDER BY (r.status = 'pending') DESC, (r.status = 'pending' AND r.is_flash) DESC, r.created_at DESC
  LIMIT 100;
END;
$$;
CREATE OR REPLACE FUNCTION public.list_notifications(_limit integer DEFAULT 50) RETURNS TABLE(id uuid, type text, actor_id uuid, actor_first_name text, data jsonb, read_at timestamp with time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.list_search_cities(_country text DEFAULT NULL::text) RETURNS TABLE(city text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _norm_country text := public.normalize_place(_country);
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _country IS NOT NULL AND char_length(_country) > 100 THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'country';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(p.city), '\s+', ' ', 'g') AS label,
           public.normalize_place(p.city) AS norm
    FROM public.profiles p
    WHERE p.user_id <> _me
      AND public.normalize_place(p.city) IS NOT NULL
      AND (_norm_country IS NULL OR public.normalize_place(p.country) = _norm_country)
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  spellings AS (
    SELECT norm, label, count(*) AS n,
           row_number() OVER (
             PARTITION BY norm
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
CREATE OR REPLACE FUNCTION public.list_search_countries() RETURNS TABLE(country text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.list_search_values(_field text) RETURNS TABLE(value text, profiles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _field IS NULL OR _field NOT IN ('denomination', 'faith_commitment', 'interests') THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'field';
  END IF;
  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT regexp_replace(btrim(
             CASE _field
               WHEN 'denomination' THEN cp.denomination
               WHEN 'faith_commitment' THEN cp.faith_commitment
             END
           ), '\s+', ' ', 'g') AS label
    FROM public.christian_profiles cp
    WHERE _field IN ('denomination', 'faith_commitment')
      AND cp.user_id <> _me
      AND public.is_discoverable_profile(cp.user_id)
      AND NOT public.is_blocked_between(_me, cp.user_id)
    UNION ALL
    SELECT regexp_replace(btrim(i), '\s+', ' ', 'g')
    FROM public.profiles p, unnest(p.interests) i
    WHERE _field = 'interests'
      AND p.user_id <> _me
      AND public.is_discoverable_profile(p.user_id)
      AND NOT public.is_blocked_between(_me, p.user_id)
  ),
  normalized AS (
    SELECT label, public.normalize_place(label) AS norm FROM visible
    WHERE public.normalize_place(label) IS NOT NULL
  ),
  spellings AS (
    SELECT norm, label,
           row_number() OVER (
             PARTITION BY norm
             ORDER BY count(*) DESC,
                      (label <> upper(label) AND label <> lower(label)) DESC,
                      (label <> extensions.unaccent(label)) DESC,
                      label
           ) AS rank
    FROM normalized GROUP BY norm, label
  )
  SELECT s.label, (SELECT count(*) FROM normalized n WHERE n.norm = s.norm)::integer
  FROM spellings s
  WHERE s.rank = 1
  ORDER BY 2 DESC, 1
  LIMIT 300;
END;
$$;
CREATE OR REPLACE FUNCTION public.location_priority(_source text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _source WHEN 'device' THEN 3 WHEN 'declared' THEN 2 WHEN 'ip' THEN 1 ELSE 0 END
$$;

-- ============================================================================
-- 5. Table utilisée par les fonctions qui suivent
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    user_1_id uuid NOT NULL,
    user_2_id uuid NOT NULL,
    status public.conversation_status DEFAULT 'open'::public.conversation_status NOT NULL,
    free_messages_used smallint DEFAULT 0 NOT NULL,
    last_message_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_ordered_pair CHECK ((user_1_id < user_2_id))
);

-- ============================================================================
-- 6. Fonctions : les règles du site exécutées par la base (suite)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lock_conversation_for_sending(_uid uuid, _conversation_id uuid) RETURNS public.conversations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.log_account_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.auth_events SET ip = NULL, user_agent = NULL, city = NULL, email = NULL
    WHERE user_id = OLD.id;
    UPDATE public.activity_events SET ip = NULL, user_agent = NULL WHERE user_id = OLD.id;
    UPDATE public.payment_events SET ip = NULL, user_agent = NULL WHERE user_id = OLD.id;
    IF NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = OLD.id AND a.raw_app_meta_data ->> 'provider' = 'virtual')
       AND OLD.email NOT LIKE '%@profils-virtuels.yona.invalid' THEN
      INSERT INTO public.activity_events (user_id, event) VALUES (OLD.id, 'account_deleted');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_activity(NEW.id,
      CASE NEW.status WHEN 'suspended' THEN 'account_suspended' WHEN 'disabled' THEN 'account_banned'
                      WHEN 'active' THEN 'account_reactivated' ELSE 'account_deleted' END,
      NULL, NULL);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_account_change: %', SQLERRM;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.log_activity(_user uuid, _event text, _target uuid, _ref uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  INSERT INTO public.activity_events (user_id, event, target_user_id, ref_id, ip, country, user_agent)
  VALUES (_user, _event, _target, _ref, _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_activity: %', SQLERRM;
END; $$;
CREATE OR REPLACE FUNCTION public.log_auth_user_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _provider text := NEW.raw_app_meta_data ->> 'provider';
  _ctx jsonb := public.request_context();
BEGIN
  -- Les profils de démonstration ne sont pas des connexions.
  IF _provider = 'virtual' THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.auth_events (user_id, email, event, method, ip, country, user_agent)
      VALUES (NEW.id, NEW.email, 'signup', public.auth_method(_provider),
              _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
      INSERT INTO public.signup_events (user_id, step, method)
      VALUES (NEW.id, 'account_created', public.auth_method(_provider))
      ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
    ELSE
      IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at AND NEW.last_sign_in_at IS NOT NULL THEN
        INSERT INTO public.auth_events (user_id, email, event, method, ip, country, user_agent)
        VALUES (NEW.id, NEW.email, 'login', public.auth_method(_provider),
                _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
      END IF;
      IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password AND OLD.encrypted_password IS NOT NULL
         AND OLD.encrypted_password <> '' THEN
        INSERT INTO public.auth_events (user_id, email, event, method)
        VALUES (NEW.id, NEW.email, 'password_changed', 'email');
      END IF;
      IF NEW.recovery_sent_at IS DISTINCT FROM OLD.recovery_sent_at AND NEW.recovery_sent_at IS NOT NULL THEN
        INSERT INTO public.auth_events (user_id, email, event, method)
        VALUES (NEW.id, NEW.email, 'password_reset_requested', 'email');
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Le journal ne doit jamais empêcher une inscription ou une connexion.
    RAISE WARNING 'log_auth_user_change: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.log_member_action() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _row jsonb := to_jsonb(NEW);
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'likes' THEN
      IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.kind IS DISTINCT FROM NEW.kind
                                    OR OLD.status IS DISTINCT FROM NEW.status) THEN
        PERFORM public.log_activity(NEW.sender_id, NEW.kind::text, NEW.receiver_id, NEW.id);
      END IF;
    WHEN 'matches' THEN
      PERFORM public.log_activity(NEW.user_1_id, 'match', NEW.user_2_id, NEW.id);
    WHEN 'messages' THEN
      PERFORM public.log_activity(NEW.sender_id,
        CASE WHEN _row ->> 'kind' = 'voice' THEN 'voice_message' ELSE 'message' END,
        NULL, NEW.conversation_id);
    WHEN 'blocks' THEN
      PERFORM public.log_activity(NEW.blocker_id, 'block', NEW.blocked_id, NEW.id);
    WHEN 'reports' THEN
      PERFORM public.log_activity((_row ->> 'reporter_id')::uuid, 'report',
                                  (_row ->> 'reported_user_id')::uuid, NEW.id);
    WHEN 'contact_requests' THEN
      PERFORM public.log_activity(NEW.sender_id,
        CASE WHEN coalesce((_row ->> 'is_flash')::boolean, false) THEN 'flash_message' ELSE 'contact_request' END,
        NEW.receiver_id, NEW.id);
    WHEN 'favorites' THEN
      PERFORM public.log_activity(NEW.user_id, 'favorite', NEW.favorite_user_id, NEW.id);
    WHEN 'profile_visits' THEN
      PERFORM public.log_activity((_row ->> 'visitor_id')::uuid, 'visit',
                                  (_row ->> 'visited_user_id')::uuid, NEW.id);
    ELSE
      NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_member_action (%): %', TG_TABLE_NAME, SQLERRM;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.log_payment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ctx jsonb := public.request_context();
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.payment_events (payment_id, user_id, event, product, amount, currency, provider,
                                     provider_ref, reason, ip, country, user_agent)
  VALUES (NEW.id, NEW.user_id,
          CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE NEW.status::text END,
          public.payment_product(NEW.type, NEW.metadata), NEW.amount, NEW.currency, NEW.provider,
          NEW.provider_transaction_id, left(NEW.metadata ->> 'failure_reason', 300),
          _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'user_agent');
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_payment_change: %', SQLERRM;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.log_server_error(_source text, _message text, _user_id uuid DEFAULT NULL::uuid, _path text DEFAULT NULL::text, _details jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  INSERT INTO public.server_errors (source, message, user_id, path, details)
  VALUES (left(coalesce(_source, 'serveur'), 100), left(coalesce(_message, '?'), 2000), _user_id,
          left(_path, 300), coalesce(_details, '{}'::jsonb));
$$;
CREATE OR REPLACE FUNCTION public.log_signup_milestone() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _user uuid;
  _step text;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.is_virtual OR NEW.onboarding_completed_at IS NULL OR OLD.onboarding_completed_at IS NOT NULL THEN
      RETURN NULL;
    END IF;
    _user := NEW.user_id;
    _step := 'profile_completed';
  ELSIF TG_OP = 'INSERT' THEN
    _user := NEW.user_id;
    _step := 'verification_requested';
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    _user := NEW.user_id;
    _step := 'verification_' || NEW.status;
  ELSE
    RETURN NULL;
  END IF;
  INSERT INTO public.signup_events (user_id, step) VALUES (_user, _step)
  ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'log_signup_milestone: %', SQLERRM;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _uid uuid := auth.uid();
  _at timestamptz;
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

  INSERT INTO public.conversation_reads AS r (conversation_id, user_id, last_read_at)
  VALUES (_conversation_id, _uid, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = greatest(r.last_read_at, excluded.last_read_at)
  RETURNING r.last_read_at INTO _at;
  RETURN _at;
END;
$$;
CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
CREATE OR REPLACE FUNCTION public.mark_offline() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_activity SET is_online = false WHERE user_id = auth.uid();
END;
$$;
CREATE OR REPLACE FUNCTION public.member_country(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT coalesce(
    (SELECT l.country FROM public.profile_locations l WHERE l.user_id = _user_id AND l.country IS NOT NULL),
    (SELECT p.country FROM public.profiles p WHERE p.user_id = _user_id))
$$;
CREATE OR REPLACE FUNCTION public.messages_block_phone_numbers() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.contains_phone_number := public.contains_phone_number(NEW.content);
  IF NEW.contains_phone_number AND NEW.status = 'delivered' THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.my_verification_status() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _max integer;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT max_attempts_per_day INTO _max FROM public.verification_settings WHERE id;
  SELECT count(*) INTO _used FROM public.profile_verifications v
  WHERE v.user_id = _me AND v.automatic AND v.created_at > now() - interval '24 hours'
    AND v.reason IS DISTINCT FROM 'engine_unavailable';
  RETURN jsonb_build_object(
    'verified', EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _me AND p.verified_at IS NOT NULL),
    'verified_at', (SELECT p.verified_at FROM public.profiles p WHERE p.user_id = _me),
    'attempts_left', greatest(coalesce(_max, 5) - _used, 0),
    'max_attempts', coalesce(_max, 5),
    'latest', (SELECT jsonb_build_object('id', v.id, 'status', v.status, 'reason', v.reason,
                                         'document_type', v.document_type, 'created_at', v.created_at)
               FROM public.profile_verifications v WHERE v.user_id = _me
               ORDER BY v.created_at DESC LIMIT 1)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.normalize_place(_value text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT nullif(
    btrim(regexp_replace(lower(extensions.unaccent(coalesce(_value, ''))), '[\s''’`\-]+', ' ', 'g')),
    ''
  )
$$;
CREATE OR REPLACE FUNCTION public.notify_contact_request() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.receiver_id, 'contact_request', NEW.sender_id,
    jsonb_build_object('request_id', NEW.id, 'is_flash', NEW.is_flash));
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_favorite() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.favorite_user_id, 'favorite', NEW.user_id, '{}'::jsonb,
    'favorite:' || NEW.user_id::text);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_like() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.kind = 'like' AND NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.receiver_id, 'like', NEW.sender_id, '{}'::jsonb,
      'like:' || NEW.sender_id::text);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_match() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.user_1_id, 'match', NEW.user_2_id,
      jsonb_build_object('match_id', NEW.id));
    PERFORM public.create_notification(NEW.user_2_id, 'match', NEW.user_1_id,
      jsonb_build_object('match_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.notify_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
CREATE OR REPLACE FUNCTION public.notify_visit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.create_notification(NEW.visited_user_id, 'visit', NEW.visitor_id, '{}'::jsonb,
    'visit:' || NEW.visitor_id::text);
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.payment_product(_type public.payment_type, _metadata jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _type WHEN 'conversation_unlock' THEN 'conversation_unlock'
                    ELSE coalesce(_metadata ->> 'plan', 'premium') END
$$;
CREATE OR REPLACE FUNCTION public.photos_after_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.is_primary THEN
    UPDATE public.photos SET is_primary = true
    WHERE id = (
      SELECT id FROM public.photos WHERE user_id = OLD.user_id ORDER BY position, created_at LIMIT 1
    );
  END IF;
  RETURN NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.photos_before_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.is_primary := NOT EXISTS (
    SELECT 1 FROM public.photos WHERE user_id = NEW.user_id AND is_primary
  );
  NEW.position := coalesce(
    (SELECT max(position) + 1 FROM public.photos WHERE user_id = NEW.user_id), 0
  );
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.premium_plan_amount(_plan public.subscription_plan) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE _plan WHEN 'premium_monthly' THEN 500 WHEN 'premium_yearly' THEN 3500 END
$$;
CREATE OR REPLACE FUNCTION public.protect_like_parties() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
    RAISE EXCEPTION 'like_parties_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.protect_photo_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.status := 'pending';
    ELSE NEW.status := OLD.status; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.protect_profile_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL AND OLD.status = 'suspended' THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.protect_server_profile_fields() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Requête d'un membre (auth.uid() renseigné, hors administrateur) : ces champs restent
  -- ceux du serveur.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_virtual := false;
      NEW.verified_at := NULL;
      NEW.demo_photo_path := NULL;
      NEW.demo_photo_source := NULL;
    ELSE
      NEW.is_virtual := OLD.is_virtual;
      NEW.verified_at := OLD.verified_at;
      NEW.demo_photo_path := OLD.demo_photo_path;
      NEW.demo_photo_source := OLD.demo_photo_source;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.protect_terms_accepted_at() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  ELSIF NEW.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := LEAST(NEW.terms_accepted_at, now());
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.protect_user_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    NEW.status := OLD.status;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.purge_old_logs() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _n integer := 0;
  _c integer;
BEGIN
  UPDATE public.auth_events SET ip = NULL, user_agent = NULL, city = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.activity_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.payment_events SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  UPDATE public.admin_audit_log SET ip = NULL, user_agent = NULL
  WHERE created_at < now() - interval '12 months' AND (ip IS NOT NULL OR user_agent IS NOT NULL);
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.server_errors WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  DELETE FROM public.location_history WHERE created_at < now() - interval '12 months';
  GET DIAGNOSTICS _c = ROW_COUNT; _n := _n + _c;
  RETURN _n;
END; $$;
CREATE OR REPLACE FUNCTION public.purge_verification_files() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _n integer;
  _id uuid;
  _retention integer;
BEGIN
  _n := public.expire_verification_attempts(NULL);
  SELECT file_retention_hours INTO _retention FROM public.verification_settings WHERE id;
  FOR _id IN
    SELECT v.id FROM public.profile_verifications v
    WHERE v.status IN ('approved', 'rejected') AND v.files_deleted_at IS NULL
      AND coalesce(v.decided_at, v.reviewed_at, v.created_at) < now() - make_interval(hours => coalesce(_retention, 0))
  LOOP
    PERFORM public.queue_verification_files(_id, 'fin du délai de conservation');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;
CREATE OR REPLACE FUNCTION public.queue_ad_media_cleanup() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
CREATE OR REPLACE FUNCTION public.queue_verification_files(_id uuid, _reason text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _n integer;
BEGIN
  INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
  SELECT 'verifications', p, _reason
  FROM public.profile_verifications v,
       unnest(ARRAY[v.storage_path, v.challenge_path, v.document_path]) AS p
  WHERE v.id = _id AND v.files_deleted_at IS NULL AND p IS NOT NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE public.profile_verifications SET files_deleted_at = now() WHERE id = _id AND files_deleted_at IS NULL;
  RETURN _n;
END; $$;
CREATE OR REPLACE FUNCTION public.recent_signups() RETURNS TABLE(first_name text, country text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT split_part(p.first_name, ' ', 1), p.country, p.created_at
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.visibility = 'visible'
    AND NOT p.is_virtual
    AND p.onboarding_completed_at IS NOT NULL
    AND p.first_name IS NOT NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 8;
$$;
CREATE OR REPLACE FUNCTION public.record_ad_event(_ad_id uuid, _event text, _placement text DEFAULT 'discover'::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
CREATE OR REPLACE FUNCTION public.record_login_failure(_email text, _method text DEFAULT 'email'::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _ctx jsonb := public.request_context();
  _clean text := lower(left(btrim(coalesce(_email, '')), 320));
BEGIN
  IF (SELECT count(*) FROM public.auth_events e
      WHERE e.event = 'login_failed' AND e.ip IS NOT DISTINCT FROM (_ctx ->> 'ip')
        AND e.created_at > now() - interval '10 minutes') >= 20 THEN
    RETURN;
  END IF;
  INSERT INTO public.auth_events (user_id, email, event, method, ip, country, city, user_agent)
  VALUES ((SELECT u.id FROM public.users u WHERE lower(u.email) = _clean LIMIT 1),
          nullif(_clean, ''), 'login_failed',
          CASE WHEN _method IN ('email', 'google') THEN _method ELSE 'other' END,
          _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'city', _ctx ->> 'user_agent');
END; $$;
CREATE OR REPLACE FUNCTION public.record_logout() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _ctx jsonb := public.request_context();
BEGIN
  IF _me IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.auth_events (user_id, email, event, ip, country, city, user_agent)
  SELECT _me, u.email, 'logout', _ctx ->> 'ip', _ctx ->> 'country', _ctx ->> 'city', _ctx ->> 'user_agent'
  FROM public.users u WHERE u.id = _me;
END; $$;
CREATE OR REPLACE FUNCTION public.record_payment_webhook(_event_type text, _payment_id uuid DEFAULT NULL::uuid, _reason text DEFAULT NULL::text, _provider_ref text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _pay public.payments%ROWTYPE;
BEGIN
  SELECT * INTO _pay FROM public.payments p WHERE p.id = _payment_id;
  INSERT INTO public.payment_events (payment_id, user_id, event, product, amount, currency, provider,
                                     provider_ref, reason)
  VALUES (_payment_id, _pay.user_id, 'webhook',
          CASE WHEN _pay.id IS NULL THEN NULL ELSE public.payment_product(_pay.type, _pay.metadata) END,
          _pay.amount, _pay.currency, coalesce(_pay.provider, 'stripe'), left(_provider_ref, 200),
          left(coalesce(_event_type, '') || CASE WHEN _reason IS NULL THEN '' ELSE ' : ' || _reason END, 300));
  IF _pay.id IS NOT NULL AND _pay.status = 'pending'
     AND _event_type IN ('checkout.session.expired', 'checkout.session.async_payment_failed',
                         'payment_intent.payment_failed') THEN
    UPDATE public.payments
    SET status = CASE WHEN _event_type = 'checkout.session.expired' THEN 'cancelled' ELSE 'failed' END::public.payment_status,
        metadata = metadata || jsonb_build_object('failure_reason', left(coalesce(_reason, _event_type), 300))
    WHERE id = _pay.id;
  END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.record_profile_visit(_visited_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _visitor uuid := auth.uid();
BEGIN
  IF _visitor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _visited_user_id IS NULL OR _visited_user_id = _visitor THEN
    RETURN false;
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_visited_user_id)
     OR public.is_blocked_between(_visitor, _visited_user_id) THEN
    RETURN false;
  END IF;

  -- Appels simultanés pour le même couple : traités l'un après l'autre.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('profile_visit:' || _visitor::text || ':' || _visited_user_id::text, 0)
  );

  -- 1. Une visite par heure et par profil visité.
  IF EXISTS (
    SELECT 1 FROM public.profile_visits v
    WHERE v.visitor_id = _visitor
      AND v.visited_user_id = _visited_user_id
      AND v.visited_at > now() - interval '1 hour'
  ) THEN
    RETURN false;
  END IF;

  -- 2. Au plus 100 visites enregistrées par visiteur sur 24 heures.
  IF (
    SELECT count(*) FROM public.profile_visits v
    WHERE v.visitor_id = _visitor AND v.visited_at > now() - interval '24 hours'
  ) >= 100 THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_visits (visitor_id, visited_user_id)
  VALUES (_visitor, _visited_user_id);
  RETURN true;
END;
$$;
CREATE OR REPLACE FUNCTION public.record_session_context(_timezone text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
  _ctx jsonb := public.request_context();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  UPDATE public.auth_events e
  SET ip = _ctx ->> 'ip', country = _ctx ->> 'country', city = _ctx ->> 'city',
      user_agent = _ctx ->> 'user_agent', timezone = left(nullif(btrim(_timezone), ''), 64)
  WHERE e.user_id = _me AND e.event IN ('login', 'signup')
    AND e.created_at > now() - interval '15 minutes' AND e.user_agent IS NULL;
END; $$;
CREATE OR REPLACE FUNCTION public.record_signup_step(_step integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _step IS NULL OR _step NOT BETWEEN 1 AND 4 THEN
    RAISE EXCEPTION 'invalid_step' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.signup_events (user_id, step, country)
  VALUES (_me, 'step_' || _step, public.request_context() ->> 'country')
  ON CONFLICT ON CONSTRAINT signup_events_once DO NOTHING;
END; $$;
CREATE OR REPLACE FUNCTION public.record_verification_result(_id uuid, _status text, _reason text, _engine text, _profile_similarity numeric DEFAULT NULL::numeric, _document_similarity numeric DEFAULT NULL::numeric, _liveness_similarity numeric DEFAULT NULL::numeric, _liveness_shift numeric DEFAULT NULL::numeric, _details jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _v public.profile_verifications%ROWTYPE;
  _retention integer;
BEGIN
  IF _status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profile_verifications v SET
    status = _status, reason = left(_reason, 40), engine = left(_engine, 20),
    profile_similarity = _profile_similarity, document_similarity = _document_similarity,
    liveness_similarity = _liveness_similarity, liveness_shift = _liveness_shift,
    details = coalesce(_details, '{}'::jsonb),
    decided_at = CASE WHEN _status = 'pending' THEN NULL ELSE now() END
  WHERE v.id = _id AND v.status = 'processing'
  RETURNING * INTO _v;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _status = 'approved' THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _v.user_id AND verified_at IS NULL;
  END IF;
  SELECT file_retention_hours INTO _retention FROM public.verification_settings WHERE id;
  IF _status <> 'pending' AND coalesce(_retention, 0) = 0 THEN
    PERFORM public.queue_verification_files(_id, 'décision automatique');
  END IF;
  RETURN jsonb_build_object('status', _v.status, 'reason', _v.reason,
                            'verified', _status = 'approved');
END;
$$;
CREATE OR REPLACE FUNCTION public.refund_ai_quota(_user_id uuid, _feature text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  UPDATE public.ai_usage SET usage_count = usage_count - 1
  WHERE user_id = _user_id AND feature = _feature AND usage_date = public.ai_usage_day()
    AND usage_count > 0
$$;
CREATE OR REPLACE FUNCTION public.refuse_blocked_interaction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _a uuid;
  _b uuid;
BEGIN
  IF TG_TABLE_NAME = 'favorites' THEN
    _a := NEW.user_id; _b := NEW.favorite_user_id;
  ELSIF TG_TABLE_NAME = 'profile_visits' THEN
    _a := NEW.visitor_id; _b := NEW.visited_user_id;
  ELSIF TG_TABLE_NAME = 'likes' THEN
    _a := NEW.sender_id; _b := NEW.receiver_id;
  END IF;
  IF public.is_blocked_between(_a, _b) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.refuse_contact_to_demo_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.receiver_id AND p.is_virtual) THEN
    RAISE EXCEPTION 'demo_profile' USING ERRCODE = '22023',
      HINT = 'Profil de démonstration : il ne peut pas répondre.';
  END IF;
  RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.remove_one_virtual_profile(_country text, _gender public.gender) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  _key text := lower(btrim(coalesce(_country, '')));
  _origin public.geo_countries%ROWTYPE;
  _target uuid;
  _photo text;
BEGIN
  -- D'abord dans le pays du membre : sexe recherché, puis profils visibles (avec photo).
  SELECT p.user_id INTO _target
  FROM public.profiles p
  WHERE p.is_virtual AND lower(btrim(p.country)) = _key
  ORDER BY (_gender IS NULL OR p.gender = _gender) DESC, (p.demo_photo_path IS NOT NULL) DESC,
           p.created_at, p.user_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Sinon dans le pays le plus proche.
  IF _target IS NULL THEN
    SELECT * INTO _origin FROM public.geo_countries g WHERE lower(g.name) = _key LIMIT 1;
    SELECT p.user_id INTO _target
    FROM public.profiles p
    LEFT JOIN public.geo_countries g ON lower(g.name) = lower(btrim(p.country))
    WHERE p.is_virtual
    ORDER BY
      CASE
        WHEN _origin.code IS NULL OR g.code IS NULL THEN 1e12
        ELSE power(g.lat - _origin.lat, 2)
           + power((g.lng - _origin.lng) * cos(radians((g.lat + _origin.lat) / 2)), 2)
      END,
      (_gender IS NULL OR p.gender = _gender) DESC, (p.demo_photo_path IS NOT NULL) DESC,
      p.created_at, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF _target IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.demo_photo_path INTO _photo FROM public.profiles p WHERE p.user_id = _target;

  -- Double vérification : uniquement un compte virtuel (profil ET compte marqués). La
  -- suppression du compte efface en cascade profil, préférences, likes, favoris, visites…
  DELETE FROM auth.users u
  WHERE u.id = _target
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- Photo déposée dans le stockage : fichier à supprimer (une image livrée avec le site,
  -- /demo-profils/…, reste en place).
  IF _photo IS NOT NULL AND left(_photo, 1) <> '/' THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
    VALUES ('demo-profils', _photo, 'profil de démonstration retiré');
  END IF;
  RETURN _target;
END; $$;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;
