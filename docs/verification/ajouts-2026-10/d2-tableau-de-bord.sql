-- Tâche D2 — Tableau de bord de l'administration (chiffres, courbes, entonnoir, membres, historique).
-- À lancer sur une base créée par supabase/nouvelle-base (ou toutes les migrations) :
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/d2-tableau-de-bord.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_d2;
CREATE TABLE essai_d2.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_d2.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_d2.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
CREATE FUNCTION essai_d2.refus(q text) RETURNS text LANGUAGE plpgsql AS
  $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE TABLE essai_d2.v (k text PRIMARY KEY, j jsonb);
GRANT USAGE ON SCHEMA essai_d2 TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA essai_d2 TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_d2 TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_d2 TO authenticated, service_role;
\set A '''d2000000-0000-0000-0000-00000000000a'''
\set B '''d2000000-0000-0000-0000-00000000000b'''
\set ADM '''d2000000-0000-0000-0000-0000000000ad'''
SELECT set_config('request.jwt.claim.sub', '', true);

-- Point de départ : chiffres avant l'essai (la base peut déjà contenir des membres).
SELECT count(*) AS reels0 FROM public.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual) \gset

-- 1. Deux membres (Ada termine son inscription, Ben s'arrête après la création du compte) et un admin
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'ada@essai-d2.test', 'x', '{"provider":"email"}', '{"first_name":"Ada"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :B, 'authenticated', 'authenticated', 'ben@essai-d2.test', 'x', '{"provider":"google"}', '{"first_name":"Ben"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :ADM, 'authenticated', 'authenticated', 'adm@essai-d2.test', 'x', '{"provider":"email"}', '{"first_name":"Ange"}', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES (:ADM, 'admin');
UPDATE auth.users SET last_sign_in_at = now() WHERE id IN (:A, :ADM);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT public.record_signup_step(s) FROM generate_series(1, 4) s;
UPDATE public.profiles SET gender = 'female', birth_date = '1995-05-05', country = 'Gabon', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active' WHERE user_id = auth.uid();
RESET ROLE;
UPDATE public.profiles SET gender = 'male', birth_date = '1990-01-01', country = 'Cameroun', city = 'Douala' WHERE user_id = :B;
-- Paiement réussi (5 000 centimes) et une connexion plus ancienne (période précédente).
INSERT INTO public.payment_events (user_id, event, product, amount, currency) VALUES
  (:A, 'created', 'premium_month', 5000, 'EUR'), (:A, 'succeeded', 'premium_month', 5000, 'EUR');
INSERT INTO public.auth_events (user_id, event, created_at) VALUES (:A, 'login', now() - interval '10 days');
INSERT INTO public.activity_events (user_id, event, target_user_id) VALUES (:A, 'like', :B), (:A, 'message', :B);
-- Un profil de démonstration « actif » ne doit jamais compter.
INSERT INTO public.activity_events (user_id, event)
SELECT user_id, 'like' FROM public.profiles WHERE is_virtual LIMIT 1;

-- 2. Accès réservé à l'administration
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d2.ok('Un membre ne peut pas lire le tableau de bord',
  essai_d2.refus('SELECT public.admin_dashboard(now() - interval ''7 days'', now())') LIKE '%admin%');
SELECT essai_d2.ok('Un membre ne peut pas lister les membres',
  essai_d2.refus('SELECT * FROM public.admin_members()') LIKE '%admin%');
SELECT essai_d2.ok('Un membre ne peut pas lire l''historique d''un autre',
  essai_d2.refus('SELECT public.admin_user_history(''d2000000-0000-0000-0000-00000000000b'')') LIKE '%admin%');
SELECT essai_d2.ok('Les fonctions internes ne sont pas appelables par un membre',
  essai_d2.refus('SELECT public.admin_period_kpis(now(), now())') LIKE '%permission denied%'
  AND essai_d2.refus('SELECT public.is_real_member(''d2000000-0000-0000-0000-00000000000b'')') LIKE '%permission denied%');

-- 3. Tableau de bord (administrateur), 7 derniers jours par jour
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT essai_d2.ok('Période invalide ou trop longue refusée',
  essai_d2.refus('SELECT public.admin_dashboard(now(), now() - interval ''1 day'')') = 'invalid_period'
  AND essai_d2.refus('SELECT public.admin_dashboard(now() - interval ''6 years'', now())') = 'period_too_long');
INSERT INTO essai_d2.v SELECT 'semaine', public.admin_dashboard(now() - interval '7 days', now() + interval '1 hour', 'day');
INSERT INTO essai_d2.v SELECT 'annee', public.admin_dashboard(date_trunc('year', now()), date_trunc('year', now()) + interval '1 year', 'month');
INSERT INTO essai_d2.v SELECT 'jour', public.admin_dashboard(now() - interval '24 hours', now() + interval '1 second', 'hour', 'Africa/Libreville');
INSERT INTO essai_d2.v SELECT 'tz_faux', public.admin_dashboard(now() - interval '1 day', now(), 'day', 'Pas/Un_Fuseau');
INSERT INTO essai_d2.v SELECT 'heure_trop', public.admin_dashboard(now() - interval '90 days', now(), 'hour');
INSERT INTO essai_d2.v SELECT 'histo_a', public.admin_user_history(:A);
INSERT INTO essai_d2.v SELECT 'stats', public.admin_stats();
RESET ROLE;
\set D '(SELECT j FROM essai_d2.v WHERE k = ''semaine'')'
SELECT essai_d2.ok('Période : inscriptions (3), connexions (2), 1 « j''aime » (pas celui du profil de démo), paiement réussi, revenus 5 000',
  (:D -> 'current' ->> 'signups')::int = 3 AND (:D -> 'current' ->> 'logins')::int = 2
  AND (:D -> 'current' ->> 'payments_succeeded')::int = 1 AND (:D -> 'current' ->> 'likes')::int = 1 AND (:D -> 'current' ->> 'revenue_cents')::int = 5000,
  (:D -> 'current')::text);
SELECT essai_d2.ok('Comparaison : la connexion d''il y a 10 jours est dans la période précédente',
  (:D -> 'previous' ->> 'logins')::int = 1 AND (:D -> 'previous' ->> 'signups')::int = 0);
SELECT essai_d2.ok('Membres actifs : Ada et l''admin (le profil de démonstration ne compte pas)',
  (:D -> 'current' ->> 'active_users')::int = 2, :D -> 'current' ->> 'active_users');
SELECT essai_d2.ok('Courbe par jour : 8 points (9 si la période déborde minuit), total des connexions = chiffre de la période',
  jsonb_array_length(:D -> 'series') IN (8, 9)
  AND (SELECT sum((x ->> 'logins')::int) FROM jsonb_array_elements(:D -> 'series') x) = 2
  AND (SELECT sum((x ->> 'revenue_cents')::int) FROM jsonb_array_elements(:D -> 'series') x) = 5000,
  jsonb_array_length(:D -> 'series')::text);
SELECT essai_d2.ok('Courbe par mois sur une année : 12 points',
  jsonb_array_length((SELECT j FROM essai_d2.v WHERE k = 'annee') -> 'series') = 12);
SELECT essai_d2.ok('Courbe par heure sur 24 h, découpée à l''heure de Libreville',
  jsonb_array_length((SELECT j FROM essai_d2.v WHERE k = 'jour') -> 'series') IN (24, 25)
  AND (SELECT j FROM essai_d2.v WHERE k = 'jour') -> 'period' ->> 'timezone' = 'Africa/Libreville'
  AND (SELECT sum((x ->> 'logins')::int) FROM jsonb_array_elements((SELECT j FROM essai_d2.v WHERE k = 'jour') -> 'series') x) = 2);
SELECT essai_d2.ok('Fuseau inconnu → UTC ; par heure sur 90 jours → par jour (courbe lisible)',
  (SELECT j FROM essai_d2.v WHERE k = 'tz_faux') -> 'period' ->> 'timezone' = 'UTC'
  AND (SELECT j FROM essai_d2.v WHERE k = 'heure_trop') -> 'period' ->> 'bucket' = 'day');
SELECT essai_d2.ok('Entonnoir : 3 comptes créés, 1 a fini les 4 étapes et son profil',
  (SELECT string_agg(x ->> 'n', ',' ORDER BY ord) FROM jsonb_array_elements(:D -> 'funnel') WITH ORDINALITY t(x, ord))
  = '3,1,1,1,1,1,0,0',
  (SELECT string_agg(x ->> 'n', ',' ORDER BY ord) FROM jsonb_array_elements(:D -> 'funnel') WITH ORDINALITY t(x, ord)));
SELECT essai_d2.ok('Revenus par produit',
  :D -> 'revenue_by_product' -> 0 ->> 'product' = 'premium_month' AND (:D -> 'revenue_by_product' -> 0 ->> 'cents')::int = 5000);
SELECT essai_d2.ok('Membres : les 40 profils de démonstration ne sont jamais comptés',
  (:D -> 'snapshot' ->> 'members')::int = :reels0 + 3
  AND (:D -> 'snapshot' ->> 'free')::int + (:D -> 'snapshot' ->> 'premium')::int = :reels0 + 3,
  (:D -> 'snapshot' ->> 'members'));
SELECT essai_d2.ok('Profils de démonstration restants (visibles / total / départ)',
  (:D -> 'snapshot' ->> 'demo_visible')::int = (SELECT count(*) FROM public.profiles WHERE is_virtual AND demo_photo_path IS NOT NULL)
  AND (:D -> 'snapshot' ->> 'demo_total')::int = (SELECT count(*) FROM public.profiles WHERE is_virtual)
  AND (:D -> 'snapshot' ->> 'demo_initial')::int = 40);
SELECT essai_d2.ok('Répartition par sexe et par pays (vrais membres)',
  (:D -> 'snapshot' -> 'by_gender' ->> 'female')::int >= 1
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(:D -> 'snapshot' -> 'by_country') x WHERE x ->> 'name' = 'Cameroun')
  AND (SELECT sum((x ->> 'n')::int) FROM jsonb_array_elements(:D -> 'snapshot' -> 'by_age') x) = :reels0 + 3);
SELECT essai_d2.ok('Actifs du jour / 7 jours / 30 jours',
  (:D -> 'snapshot' ->> 'dau')::int >= 2 AND (:D -> 'snapshot' ->> 'wau')::int >= (:D -> 'snapshot' ->> 'dau')::int
  AND (:D -> 'snapshot' ->> 'mau')::int >= (:D -> 'snapshot' ->> 'wau')::int);
SELECT essai_d2.ok('Chiffres clés (ancienne vue) : sans les profils de démonstration',
  ((SELECT j FROM essai_d2.v WHERE k = 'stats') ->> 'users_total')::int = :reels0 + 3);

-- 4. Tableau des membres : filtre, recherche, tri, pages
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT essai_d2.ok('Membres réels seulement par défaut ; démonstration à part',
  (SELECT count(*) FROM public.admin_members(_limit => 5000) WHERE is_virtual) = 0
  AND (SELECT count(*) FROM public.admin_members(_kind => 'demo', _limit => 5000)) = 40
  AND (SELECT bool_and(is_virtual) FROM public.admin_members(_kind => 'demo', _limit => 5000)));
SELECT essai_d2.ok('Recherche par e-mail, ville ou prénom',
  (SELECT string_agg(first_name, ',') FROM public.admin_members(_search => 'essai-d2.test', _sort => 'first_name', _desc => false))
  = 'Ada,Ange,Ben'
  AND (SELECT count(*) FROM public.admin_members(_search => 'douala')) = 1);
SELECT essai_d2.ok('Pages : 2 par page, sans doublon, total exact',
  (SELECT array_agg(user_id) FROM public.admin_members(_search => 'essai-d2.test', _sort => 'email', _desc => false, _limit => 2))
  && (SELECT array_agg(user_id) FROM public.admin_members(_search => 'essai-d2.test', _sort => 'email', _desc => false, _limit => 2, _offset => 2)) = false
  AND (SELECT DISTINCT total_count FROM public.admin_members(_search => 'essai-d2.test', _limit => 2)) = 3);
SELECT essai_d2.ok('Tri inconnu ou piégé : remplacé par la date d''inscription, pas d''erreur',
  essai_d2.refus('SELECT * FROM public.admin_members(_sort => ''email; DROP TABLE public.users'')') IS NULL);
SELECT essai_d2.ok('Filtre par état du compte',
  (SELECT count(*) FROM public.admin_members(_search => 'essai-d2.test', _status => 'suspended')) = 0
  AND (SELECT count(*) FROM public.admin_members(_search => 'essai-d2.test', _status => 'active')) = 3);
RESET ROLE;

-- 5. Historique d'un membre
\set H '(SELECT j FROM essai_d2.v WHERE k = ''histo_a'')'
SELECT essai_d2.ok('Historique : connexions, étapes, paiements, actions (sans contenu de message)',
  jsonb_array_length(:H -> 'connections') >= 2
  AND jsonb_array_length(:H -> 'signup') = 6
  AND jsonb_array_length(:H -> 'payments') = 2
  AND (:H -> 'activity_counts' ->> 'message')::int = 1
  AND NOT (:H::text LIKE '%"body"%'));

-- 6. Compteur de connexions du membre (tenu à jour par le journal)
SELECT essai_d2.ok('Fiche membre : nombre de connexions et dernière connexion à jour',
  (SELECT login_count = 2 AND last_login_at >= now() - interval '1 minute'
   FROM public.user_activity WHERE user_id = :A),
  (SELECT login_count || ' / ' || last_login_at FROM public.user_activity WHERE user_id = :A));

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_d2.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_d2.r;
ROLLBACK;
