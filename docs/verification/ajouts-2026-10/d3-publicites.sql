-- Tâche D3 — Publicités sponsorisées : réservées aux membres gratuits, ciblage, plafond,
-- statistiques, règles d'accès, fichiers.
-- À lancer sur une base créée par supabase/nouvelle-base (ou toutes les migrations) :
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/d3-publicites.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_d3;
CREATE TABLE essai_d3.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_d3.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_d3.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
CREATE FUNCTION essai_d3.refus(q text) RETURNS text LANGUAGE plpgsql AS
  $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION essai_d3.pubs(_placement text DEFAULT 'discover') RETURNS text LANGUAGE sql AS
  $$ SELECT coalesce(string_agg(title, ',' ORDER BY title), '') FROM public.get_ads_for_me(_placement, 10) $$;
GRANT USAGE ON SCHEMA essai_d3 TO authenticated, service_role, anon;
GRANT ALL ON ALL TABLES IN SCHEMA essai_d3 TO authenticated, service_role, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_d3 TO authenticated, service_role, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_d3 TO authenticated, service_role, anon;
\set A '''d3000000-0000-0000-0000-00000000000a'''
\set P '''d3000000-0000-0000-0000-00000000000b'''
\set ADM '''d3000000-0000-0000-0000-0000000000ad'''
\set AD1 '''a1000000-0000-0000-0000-000000000001'''
\set AD2 '''a1000000-0000-0000-0000-000000000002'''
SELECT set_config('request.jwt.claim.sub', '', true);

-- Membres : Awa (gratuite, Gabon, 30 ans, femme), Paul (Premium), un administrateur.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'awa@essai-d3.test', 'x', '{"provider":"email"}', '{"first_name":"Awa"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :P, 'authenticated', 'authenticated', 'paul@essai-d3.test', 'x', '{"provider":"email"}', '{"first_name":"Paul"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :ADM, 'authenticated', 'authenticated', 'adm@essai-d3.test', 'x', '{"provider":"email"}', '{"first_name":"Ange"}', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES (:ADM, 'admin');
UPDATE public.profiles SET gender = 'female', birth_date = (current_date - interval '30 years 2 days')::date,
  country = 'Gabon', city = 'Libreville', status = 'active' WHERE user_id = :A;
UPDATE public.profiles SET gender = 'male', birth_date = '1990-01-01', country = 'Gabon', status = 'active' WHERE user_id = :P;
INSERT INTO public.subscriptions (user_id, plan, amount, currency, status, starts_at, expires_at)
VALUES (:P, 'premium_monthly', 500, 'USD', 'active', now() - interval '1 day', now() + interval '29 days');

-- 1. Création par l'administrateur (règles d'accès réelles)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
INSERT INTO public.ads (id, title, body, media_type, media_path, cta_label, cta_url, status, placements, priority)
VALUES (:AD1, 'Pub pour tous', 'Texte', 'image', 'a1000000-0000-0000-0000-000000000001/visuel.webp',
        'En savoir plus', 'https://exemple.yona.test/offre?x=1', 'active', ARRAY['discover', 'messages'], 10),
       (:AD2, 'Pub Cameroun', NULL, 'video', 'a1000000-0000-0000-0000-000000000002/clip.mp4',
        'Contacter', 'https://wa.me/241000000', 'active', ARRAY['discover'], 50);
UPDATE public.ads SET target_countries = ARRAY['Cameroun'] WHERE id = :AD2;
INSERT INTO public.ads (id, title, media_type, media_path, cta_url, status, target_gender, min_age, max_age, starts_at, ends_at, placements)
SELECT g::uuid, t, 'image', g || '/v.jpg', 'https://exemple.yona.test', s, gen::public.gender, mi, ma, sa, ea, pl
FROM (VALUES
  ('a1000000-0000-0000-0000-000000000003', 'Brouillon', 'draft', NULL, NULL, NULL, now() - interval '1 day', NULL, ARRAY['discover']),
  ('a1000000-0000-0000-0000-000000000004', 'Terminée', 'active', NULL, NULL, NULL, now() - interval '9 days', now() - interval '1 day', ARRAY['discover']),
  ('a1000000-0000-0000-0000-000000000005', 'Hommes', 'active', 'male', NULL, NULL, now() - interval '1 day', NULL, ARRAY['discover']),
  ('a1000000-0000-0000-0000-000000000006', 'Plus de 40 ans', 'active', NULL, 40, 60, now() - interval '1 day', NULL, ARRAY['discover']),
  ('a1000000-0000-0000-0000-000000000007', 'Femmes 25-35 Gabon', 'active', 'female', 25, 35, now() - interval '1 day', NULL, ARRAY['discover']),
  ('a1000000-0000-0000-0000-000000000008', 'Pas encore', 'active', NULL, NULL, NULL, now() + interval '1 day', NULL, ARRAY['discover'])
) AS v(g, t, s, gen, mi, ma, sa, ea, pl);
UPDATE public.ads SET target_countries = ARRAY['Gabon', 'Congo'] WHERE title = 'Femmes 25-35 Gabon';
SELECT essai_d3.ok('L''administrateur crée, modifie et lit les publicités',
  (SELECT count(*) FROM public.ads WHERE id::text LIKE 'a1000000-%') = 8);
SELECT essai_d3.ok('Lien non https refusé (javascript:, http:)',
  essai_d3.refus($$INSERT INTO public.ads (title, media_type, media_path, cta_url) SELECT 'x', 'image', gen_random_uuid() || '/a.jpg', 'javascript:alert(1)'$$) LIKE '%violates check%'
  AND essai_d3.refus($$INSERT INTO public.ads (title, media_type, media_path, cta_url) SELECT 'x', 'image', gen_random_uuid() || '/a.jpg', 'http://exemple.test'$$) LIKE '%violates check%');
SELECT essai_d3.ok('Le média doit être rangé dans le dossier de sa publicité',
  essai_d3.refus($$INSERT INTO public.ads (title, media_type, media_path, cta_url) VALUES ('x', 'image', 'a1000000-0000-0000-0000-000000000001/a.jpg', 'https://a.test')$$) LIKE '%ads_media_folder_check%');
SELECT essai_d3.ok('Pas de publicité pour l''administrateur (mode normal)', essai_d3.pubs() = '');
SELECT essai_d3.ok('L''administrateur peut déposer un fichier dans l''espace « ads »',
  essai_d3.refus($$INSERT INTO storage.objects (bucket_id, name) VALUES ('ads', 'a1000000-0000-0000-0000-000000000001/visuel.webp')$$) IS NULL);

-- 2. Un membre ne touche ni aux publicités ni aux statistiques
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Un membre ne lit pas la table des publicités ni le journal',
  (SELECT count(*) FROM public.ads) = 0 AND (SELECT count(*) FROM public.ad_events) = 0);
SELECT essai_d3.ok('Un membre ne peut pas créer de publicité',
  essai_d3.refus($$INSERT INTO public.ads (title, media_type, media_path, cta_url) SELECT 'x', 'image', gen_random_uuid() || '/a.jpg', 'https://a.test'$$) LIKE '%row-level security%');
SELECT essai_d3.ok('Un membre ne peut pas déposer de fichier dans l''espace « ads »',
  essai_d3.refus($$INSERT INTO storage.objects (bucket_id, name) VALUES ('ads', 'a1000000-0000-0000-0000-000000000002/x.jpg')$$) LIKE '%row-level security%');
SELECT essai_d3.ok('Un membre ne peut pas lire les statistiques',
  essai_d3.refus($$SELECT public.admin_ad_stats(NULL, now() - interval '1 day', now())$$) LIKE '%admin%');

-- 3. Membre gratuit : seulement les publicités actives, en cours et qui le ciblent
SELECT essai_d3.ok('Gratuite au Gabon, 30 ans : pub pour tous + pub ciblée femmes 25-35 Gabon',
  essai_d3.pubs() = 'Femmes 25-35 Gabon,Pub pour tous', essai_d3.pubs());
SELECT essai_d3.ok('Emplacement « messages » : seulement les publicités prévues pour lui',
  essai_d3.pubs('messages') = 'Pub pour tous', essai_d3.pubs('messages'));
SELECT essai_d3.ok('Une publicité toutes les 5 cartes par défaut (réglage)',
  (SELECT DISTINCT every_n FROM public.get_ads_for_me('discover', 10)) = 5);
RESET ROLE;
UPDATE public.ads SET priority = 90 WHERE title = 'Femmes 25-35 Gabon';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Priorité : la plus haute d''abord',
  (SELECT title FROM public.get_ads_for_me('discover', 10) LIMIT 1) = 'Femmes 25-35 Gabon');

-- 4. Vues, clics, anti-gonflage, plafond par jour
SELECT essai_d3.ok('Vue enregistrée, puis ignorée si répétée dans les 5 minutes',
  public.record_ad_event(:AD1, 'view') AND NOT public.record_ad_event(:AD1, 'view'));
SELECT essai_d3.ok('Clic enregistré', public.record_ad_event(:AD1, 'click'));
SELECT essai_d3.ok('Action inconnue refusée',
  essai_d3.refus($$SELECT public.record_ad_event('a1000000-0000-0000-0000-000000000001', 'like')$$) = 'invalid_event');
SELECT essai_d3.ok('Brouillon : aucune vue comptée',
  NOT public.record_ad_event('a1000000-0000-0000-0000-000000000003', 'view'));
RESET ROLE;
UPDATE public.ads SET daily_cap = 1 WHERE id = :AD1;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Plafond atteint (1 vue par jour) : la publicité n''est plus proposée',
  essai_d3.pubs() = 'Femmes 25-35 Gabon', essai_d3.pubs());

-- 5. Premium : jamais de publicité, et dès le passage à Premium
SELECT set_config('request.jwt.claim.sub', :P, true);
SELECT essai_d3.ok('Membre Premium : aucune publicité, nulle part',
  essai_d3.pubs() = '' AND essai_d3.pubs('messages') = '' AND essai_d3.pubs('matches') = '');
SELECT essai_d3.ok('Membre Premium : aucune vue comptée', NOT public.record_ad_event(:AD1, 'view'));
RESET ROLE;
INSERT INTO public.subscriptions (user_id, plan, amount, currency, status, starts_at, expires_at)
VALUES (:A, 'premium_yearly', 3500, 'USD', 'active', now(), now() + interval '1 year');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Awa passe Premium : les publicités disparaissent immédiatement', essai_d3.pubs() = '');
RESET ROLE;
UPDATE public.subscriptions SET status = 'expired', starts_at = now() - interval '2 days', expires_at = now() - interval '1 second' WHERE user_id = :A;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Fin du Premium : les publicités reviennent', essai_d3.pubs() = 'Femmes 25-35 Gabon');

-- 6. Profil de démonstration, compte suspendu, visiteur non connecté
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.profiles WHERE is_virtual LIMIT 1), true);
SELECT essai_d3.ok('Profil de démonstration : aucune publicité', essai_d3.pubs() = '');
RESET ROLE;
-- (modification faite par la base elle-même, pas au nom d'un membre)
SELECT set_config('request.jwt.claim.sub', '', true);
UPDATE public.users SET status = 'suspended' WHERE id = :A;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d3.ok('Compte suspendu : aucune publicité', essai_d3.pubs() = '');
RESET ROLE;
UPDATE public.users SET status = 'active' WHERE id = :A;
SET LOCAL ROLE anon;
SELECT essai_d3.ok('Visiteur non connecté : refusé',
  essai_d3.refus($$SELECT * FROM public.get_ads_for_me()$$) LIKE '%permission denied%');
RESET ROLE;

-- 7. Statistiques (administrateur)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
CREATE TEMP TABLE st AS SELECT public.admin_ad_stats(:AD1, now() - interval '7 days', now() + interval '1 hour', 'day', 'Africa/Libreville') AS j;
RESET ROLE;
SELECT essai_d3.ok('Statistiques : 1 vue, 1 clic, taux de clic 100 %, pays Gabon',
  (SELECT (j -> 'ads' -> 0 ->> 'views')::int = 1 AND (j -> 'ads' -> 0 ->> 'clicks')::int = 1
          AND (j -> 'ads' -> 0 ->> 'ctr')::numeric = 100 AND j -> 'by_country' -> 0 ->> 'name' = 'Gabon' FROM st),
  (SELECT j::text FROM st));
SELECT essai_d3.ok('Statistiques : courbe par jour (8 ou 9 points), total = vues',
  (SELECT jsonb_array_length(j -> 'series') IN (8, 9)
          AND (SELECT sum((x ->> 'views')::int) FROM jsonb_array_elements(j -> 'series') x) = 1 FROM st));

-- 8. Audit, suppression, RGPD
SELECT essai_d3.ok('Création de publicité tracée dans l''audit',
  (SELECT count(*) FROM public.admin_audit_log WHERE target_table = 'ads' AND action = 'insert' AND admin_id = :ADM) = 8);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
UPDATE public.ads SET media_path = 'a1000000-0000-0000-0000-000000000002/clip-v2.mp4' WHERE id = :AD2;
DELETE FROM public.ads WHERE id = :AD1;
RESET ROLE;
SELECT essai_d3.ok('Média remplacé ou publicité supprimée : fichiers mis en file de suppression',
  (SELECT string_agg(path, ',' ORDER BY path) FROM public.storage_cleanup_queue WHERE bucket_id = 'ads')
  = 'a1000000-0000-0000-0000-000000000001/visuel.webp,a1000000-0000-0000-0000-000000000002/clip.mp4');
SELECT essai_d3.ok('Publicité supprimée : ses statistiques aussi',
  (SELECT count(*) FROM public.ad_events WHERE ad_id = :AD1) = 0);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT public.record_ad_event('a1000000-0000-0000-0000-000000000007', 'view');
RESET ROLE;
DELETE FROM auth.users WHERE id = :A;
SELECT essai_d3.ok('Compte supprimé : la vue reste comptée, sans lien avec la personne',
  (SELECT count(*) FROM public.ad_events WHERE ad_id = 'a1000000-0000-0000-0000-000000000007' AND user_id IS NULL) = 1);

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_d3.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_d3.r;
ROLLBACK;
