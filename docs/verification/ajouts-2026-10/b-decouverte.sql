-- Tâche B — Découverte et recherche filtrées par sexe (tests automatiques).
-- À lancer sur une base créée par supabase/nouvelle-base (ou toutes les migrations) :
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/b-decouverte.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_b;
CREATE TABLE essai_b.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_b.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_b.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
GRANT USAGE ON SCHEMA essai_b TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA essai_b TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_b TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_b TO authenticated;

-- Membres réels : 4 hommes, 4 femmes, au Gabon (âge 30). Chacun cherche l'autre sexe,
-- sauf Fanny (cherche des femmes) et Bruno (cherche les deux).
CREATE FUNCTION essai_b.membre(_id uuid, _prenom text, _sexe public.gender, _cherche public.gender)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', _id, 'authenticated', 'authenticated',
          lower(_prenom) || '@essai.test', 'x', '{"provider":"email"}', jsonb_build_object('first_name', _prenom), now(), now());
  UPDATE public.profiles SET gender = _sexe, birth_date = current_date - interval '30 years', country = 'Gabon',
    city = 'Libreville', terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(),
    status = 'active', visibility = 'visible', verified_at = now()
  WHERE user_id = _id;
  UPDATE public.preferences SET preferred_gender = _cherche, min_age = 18, max_age = 60 WHERE user_id = _id;
END $$;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000001', 'Hugo', 'male', 'female');
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000002', 'Marc', 'male', 'female');
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000003', 'Paul', 'male', 'female');
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000004', 'Bruno', 'male', NULL);
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000011', 'Alice', 'female', 'male');
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000012', 'Berthe', 'female', 'male');
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000013', 'Carole', 'female', NULL);
SELECT essai_b.membre('b0000000-0000-0000-0000-000000000014', 'Fanny', 'female', 'female');
-- Profils de démonstration : photo pour 6 femmes et 2 hommes ; les autres restent cachés.
UPDATE public.profiles p SET demo_photo_path = p.user_id || '/x.webp', demo_photo_source = 'generated'
WHERE p.user_id IN (
  (SELECT user_id FROM public.profiles WHERE is_virtual AND gender = 'female' ORDER BY user_id LIMIT 6)
  UNION ALL
  (SELECT user_id FROM public.profiles WHERE is_virtual AND gender = 'male' ORDER BY user_id LIMIT 2)
);

SET LOCAL ROLE authenticated;
-- Hugo (homme qui cherche des femmes)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
SELECT essai_b.ok('H→F : uniquement des femmes (vraies et démo)',
  (SELECT bool_and(gender = 'female') AND count(*) > 0 FROM public.discover_profiles(50)),
  (SELECT string_agg(DISTINCT gender::text, ',') || ' / ' || count(*) FROM public.discover_profiles(50)));
SELECT essai_b.ok('H→F : vraies femmes cherchant des hommes ou les deux (Alice, Berthe, Carole), pas Fanny',
  (SELECT array_agg(first_name ORDER BY first_name) FROM public.discover_profiles(50) WHERE NOT is_virtual)
    = ARRAY['Alice', 'Berthe', 'Carole']);
SELECT essai_b.ok('H→F : 6 démo avec photo, aucune démo sans photo, étiquette « démo » renvoyée',
  (SELECT count(*) FROM public.discover_profiles(50) WHERE is_virtual AND demo_photo_path IS NOT NULL) = 6
  AND (SELECT count(*) FROM public.discover_profiles(50) WHERE is_virtual AND demo_photo_path IS NULL) = 0);
SELECT essai_b.ok('H→F : la recherche aussi n''a que des femmes',
  (SELECT bool_and(gender = 'female') FROM public.search_profiles('{}'::jsonb, 50)));
SELECT essai_b.ok('H→F : un filtre « homme » ne contourne pas la règle (aucun résultat)',
  (SELECT count(*) FROM public.search_profiles('{"gender":"male"}'::jsonb, 50)) = 0);

-- Alice (femme qui cherche des hommes)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000011', true);
SELECT essai_b.ok('F→H : uniquement des hommes',
  (SELECT bool_and(gender = 'male') AND count(*) > 0 FROM public.discover_profiles(50)));
SELECT essai_b.ok('F→H : Hugo, Marc, Paul, Bruno + 2 démo',
  (SELECT count(*) FROM public.discover_profiles(50) WHERE NOT is_virtual) = 4
  AND (SELECT count(*) FROM public.discover_profiles(50) WHERE is_virtual) = 2);

-- Bruno (homme qui cherche les deux)
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000004', true);
SELECT essai_b.ok('Les deux : hommes ET femmes',
  (SELECT count(DISTINCT gender) FROM public.discover_profiles(50)) = 2);
SELECT essai_b.ok('Les deux : intercalés, femme d''abord (sexe opposé), H et F alternés',
  (SELECT string_agg(left(gender::text, 1), '' ORDER BY n) FROM (
     SELECT gender, row_number() OVER () AS n FROM public.discover_profiles(50)) x WHERE n <= 4) = 'fmfm',
  (SELECT string_agg(left(gender::text, 1), '') FROM public.discover_profiles(50)));
SELECT essai_b.ok('Les deux : préférence réciproque (Hugo, Marc, Paul cherchent des femmes : absents)',
  (SELECT count(*) FROM public.discover_profiles(50)
   WHERE NOT is_virtual AND first_name IN ('Hugo', 'Marc', 'Paul')) = 0
  AND (SELECT count(*) FROM public.discover_profiles(50) WHERE NOT is_virtual AND gender = 'male') = 0);
SELECT essai_b.ok('Cas limite : pas assez d''hommes, la suite est complétée par des femmes',
  (SELECT string_agg(left(gender::text, 1), '') FROM public.discover_profiles(50)) ~ '^(fm)+f+$',
  (SELECT string_agg(left(gender::text, 1), '') FROM public.discover_profiles(50)));
SELECT essai_b.ok('Les deux : la recherche aussi est intercalée',
  (SELECT string_agg(left(gender::text, 1), '') FROM public.search_profiles('{}'::jsonb, 50)) ~ '^(fm)+f*$');
SELECT essai_b.ok('Les deux : un filtre peut restreindre à un sexe',
  (SELECT bool_and(gender = 'male') FROM public.search_profiles('{"gender":"male"}'::jsonb, 50)));

-- Profil déjà passé : exclu
SELECT set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
INSERT INTO public.likes (sender_id, receiver_id, kind, status)
VALUES (auth.uid(), 'b0000000-0000-0000-0000-000000000011', 'pass', 'active');
SELECT essai_b.ok('Profil passé : retiré de la découverte',
  (SELECT count(*) FROM public.discover_profiles(50) WHERE first_name = 'Alice') = 0);
-- Profil bloqué : exclu
SELECT public.block_user('b0000000-0000-0000-0000-000000000012');
SELECT essai_b.ok('Profil bloqué : retiré de la découverte et de la recherche',
  (SELECT count(*) FROM public.discover_profiles(50) WHERE first_name = 'Berthe') = 0
  AND (SELECT count(*) FROM public.search_profiles('{}'::jsonb, 50) WHERE first_name = 'Berthe') = 0);
-- Profil de démonstration sans photo : illisible directement
SELECT essai_b.ok('Démo sans photo : invisible même en lecture directe',
  (SELECT count(*) FROM public.profiles WHERE is_virtual AND demo_photo_path IS NULL) = 0);
RESET ROLE;

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_b.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_b.r;
ROLLBACK;
