-- Parcours réels sur une base créée par creer-toute-la-base.sql (inscription, profil, like, Match, messages, photo, selfie, admin, visiteur, serveur, suppression de compte).
\set ON_ERROR_STOP 1
\set QUIET 1
\pset tuples_only on
\pset format unaligned
\set A '''11111111-1111-1111-1111-111111111111'''
\set B '''22222222-2222-2222-2222-222222222222'''
CREATE SCHEMA essai; CREATE TABLE essai.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS $$ INSERT INTO essai.r(test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
-- Essai qui doit être refusé : renvoie le message d'erreur (ou NULL si accepté).
CREATE FUNCTION essai.refus(q text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
GRANT USAGE ON SCHEMA essai TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA essai TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai TO anon, authenticated, service_role;

-- Deux profils de démonstration (hommes) reçoivent une photo, comme le ferait l'admin.
UPDATE public.profiles p SET demo_photo_path = p.user_id || '/demo.webp', demo_photo_source = 'generated'
WHERE p.user_id IN (SELECT user_id FROM public.profiles WHERE is_virtual AND gender = 'male');
SELECT count(*) AS v0 FROM public.profiles WHERE is_virtual AND country = 'Gabon' \gset

-- 1. Inscriptions : e-mail (Awa) et Google (Jean), insérées comme le fait Supabase Auth.
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'awa@test.ga', 'x', '{"provider":"email"}', '{"first_name":"Awa"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :B, 'authenticated', 'authenticated', 'jean@test.ga', 'x', '{"provider":"google"}', '{"full_name":"Jean Mba","given_name":"Jean"}', now(), now());
SELECT essai.ok('Inscription : compte, profil, préférences, foi, rôle, activité créés',
  (SELECT count(*) = 2 FROM public.users WHERE id IN (:A, :B)) AND (SELECT count(*) = 2 FROM public.profiles WHERE user_id IN (:A, :B))
  AND (SELECT count(*) = 2 FROM public.preferences WHERE user_id IN (:A, :B)) AND (SELECT count(*) = 2 FROM public.christian_profiles WHERE user_id IN (:A, :B))
  AND (SELECT count(*) = 2 FROM public.user_roles WHERE user_id IN (:A, :B)) AND (SELECT count(*) = 2 FROM public.user_activity WHERE user_id IN (:A, :B)));
SELECT essai.ok('Inscription Google : prénom repris', (SELECT first_name FROM public.profiles WHERE user_id = :B) = 'Jean', (SELECT first_name FROM public.profiles WHERE user_id = :B));

-- 2. Awa remplit son profil (rôle « authenticated », comme l'API).
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :A, false) \gset
INSERT INTO public.user_settings (user_id, marketing_emails) VALUES (auth.uid(), true) ON CONFLICT (user_id) DO UPDATE SET marketing_emails = EXCLUDED.marketing_emails;
UPDATE public.preferences SET preferred_gender = 'male', min_age = 25, max_age = 45, relationship_goal = 'Mariage' WHERE user_id = auth.uid();
UPDATE public.christian_profiles SET denomination = 'Évangélique' WHERE user_id = auth.uid();
UPDATE public.profiles SET gender = 'female', birth_date = '1996-01-01', bio = 'Bonjour', interests = ARRAY['Louange'], country = 'Gabon', region = 'Estuaire', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active', visibility = 'visible' WHERE user_id = auth.uid();
SELECT essai.ok('Profil d''Awa enregistré par elle-même', (SELECT city FROM public.profiles WHERE user_id = auth.uid()) = 'Libreville');
SELECT essai.ok('Awa ne peut pas modifier le profil de Jean', (SELECT count(*) FROM public.profiles WHERE user_id = :B AND first_name = 'Pirate') = 0
  AND essai.refus($$UPDATE public.profiles SET first_name = 'Pirate' WHERE user_id = '22222222-2222-2222-2222-222222222222'$$) IS NULL
  AND (SELECT first_name FROM public.profiles WHERE user_id = :B) IS DISTINCT FROM 'Pirate');
SELECT essai.ok('Découverte : des profils proposés à Awa', (SELECT count(*) FROM public.discover_profiles(30)) > 0, (SELECT count(*) FROM public.discover_profiles(30))::text || ' profils');

-- 3. Jean remplit son profil.
SELECT set_config('request.jwt.claim.sub', :B, false) \gset
UPDATE public.preferences SET preferred_gender = 'female', min_age = 22, max_age = 40 WHERE user_id = auth.uid();
UPDATE public.profiles SET gender = 'male', birth_date = '1992-05-05', bio = 'Salut', country = 'Gabon', region = 'Estuaire', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active', visibility = 'visible' WHERE user_id = auth.uid();
RESET ROLE;
SELECT essai.ok('Fin du profil : aucun profil de démo retiré (ce sera à la vérification)', (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon') = :v0,
  :v0 || ' → ' || (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon'));

-- 4. Like réciproque → Match → conversation → messages.
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :A, false) \gset
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :B, 'like', 'active') ON CONFLICT (sender_id, receiver_id) DO UPDATE SET kind = EXCLUDED.kind, status = EXCLUDED.status;
SELECT set_config('request.jwt.claim.sub', :B, false) \gset
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :A, 'like', 'active') ON CONFLICT (sender_id, receiver_id) DO UPDATE SET kind = EXCLUDED.kind, status = EXCLUDED.status;
SELECT essai.ok('Like réciproque : Match et conversation créés', (SELECT count(*) FROM public.matches) = 1 AND (SELECT count(*) FROM public.conversations) = 1);
SELECT id AS conv FROM public.conversations LIMIT 1 \gset
SELECT essai.ok('Message envoyé', (SELECT status FROM public.send_message(:'conv', 'Bonjour Awa, que Dieu te bénisse')) = 'delivered');
SELECT essai.ok('Numéro de téléphone refusé', essai.refus(format($$SELECT public.send_message(%L, 'Appelle-moi au 074 77 42 66')$$, :'conv')) LIKE '%phone_number_detected%');
SELECT set_config('request.jwt.claim.sub', :A, false) \gset
SELECT essai.ok('Awa voit le message de Jean', (SELECT count(*) FROM public.messages WHERE conversation_id = :'conv') = 1);
SELECT essai.ok('Compteur de messages non lus', (SELECT count(*) FROM public.get_unread_counts()) >= 1);
SELECT essai.ok('Notifications reçues (like, match, message)', (SELECT count(*) FROM public.list_notifications(20)) >= 2, (SELECT count(*) FROM public.list_notifications(20))::text);
SELECT public.send_message(:'conv', 'Merci Jean'), public.send_message(:'conv', 'Deuxième'), public.send_message(:'conv', 'Troisième') \gset
SELECT essai.ok('4e message gratuit bloqué', essai.refus(format($$SELECT public.send_message(%L, 'Quatrième')$$, :'conv')) LIKE '%free_limit_reached%');

-- 5. Photo et selfie : fichiers privés dans le dossier de chacun.
INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('photos', '11111111-1111-1111-1111-111111111111/p1.jpg', auth.uid());
INSERT INTO public.photos (user_id, storage_path) VALUES (auth.uid(), '11111111-1111-1111-1111-111111111111/p1.jpg');
SELECT essai.ok('Photo envoyée (en attente de validation)', (SELECT status FROM public.photos WHERE user_id = auth.uid()) = 'pending');
SELECT essai.ok('Dépôt dans le dossier d''un autre membre refusé',
  essai.refus($$INSERT INTO storage.objects (bucket_id, name) VALUES ('photos', '22222222-2222-2222-2222-222222222222/x.jpg')$$) LIKE '%row-level security%');
INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('verifications', '11111111-1111-1111-1111-111111111111/selfie-1.jpg', auth.uid());
INSERT INTO public.profile_verifications (user_id, method, storage_path) VALUES (auth.uid(), 'selfie', '11111111-1111-1111-1111-111111111111/selfie-1.jpg');
SELECT set_config('request.jwt.claim.sub', :B, false) \gset
SELECT essai.ok('Jean ne voit ni le selfie ni sa demande', (SELECT count(*) FROM public.profile_verifications) = 0
  AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'verifications') = 0);
SELECT essai.ok('Jean ne voit pas la photo non validée d''Awa', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'photos') = 0);
SELECT essai.ok('Signalement', public.report_user(:A, 'scam', 'test', NULL) IS NOT NULL);
SELECT essai.ok('Accès admin refusé à un membre', essai.refus('SELECT public.admin_stats()') IS NOT NULL);
RESET ROLE;

-- 6. Administration (Awa devient administratrice, comme dans le guide).
INSERT INTO public.user_roles (user_id, role) VALUES (:A, 'admin');
SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', :A, false) \gset
SELECT essai.ok('Admin : selfie en attente visible', (SELECT count(*) FROM public.admin_list_pending_verifications()) = 1);
SELECT id AS verif FROM public.profile_verifications LIMIT 1 \gset
SELECT public.admin_review_verification(:'verif', true) \gset
SELECT essai.ok('Admin : profil vérifié', (SELECT verified_at IS NOT NULL FROM public.profiles WHERE user_id = :A));
SELECT essai.ok('Identité vérifiée : un homme de démo du Gabon retiré (Awa cherche un homme)',
  (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon') = :v0 - 1
  AND (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon' AND gender = 'male') = 1,
  :v0 || ' → ' || (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon'));
SELECT id AS photo FROM public.photos LIMIT 1 \gset
SELECT public.admin_moderate_photo(:'photo', true, NULL) \gset
SELECT essai.ok('Admin : photo validée', (SELECT status FROM public.photos WHERE id = :'photo') = 'approved');
SELECT essai.ok('Admin : signalements, membres, statistiques', (SELECT count(*) FROM public.admin_list_reports('open')) = 1
  AND (SELECT count(*) FROM public.admin_list_users(NULL, NULL, 50, 0)) >= 2 AND public.admin_stats() IS NOT NULL);
SELECT set_config('request.jwt.claim.sub', :B, false) \gset
SELECT essai.ok('Jean voit la photo validée d''Awa', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'photos') = 1);
RESET ROLE;

-- 7. Visiteur non connecté et serveur du site.
SET ROLE anon; SELECT set_config('request.jwt.claim.sub', '', false) \gset
SELECT essai.ok('Visiteur : aucun profil lisible', essai.refus('SELECT 1 FROM public.profiles') LIKE '%permission denied%');
SELECT essai.ok('Visiteur : « derniers inscrits » réservé au serveur', essai.refus('SELECT public.recent_signups()') LIKE '%permission denied%');
RESET ROLE; SET ROLE service_role;
SELECT essai.ok('Serveur : derniers inscrits (sans profils virtuels)', (SELECT count(*) FROM public.recent_signups()) = 2);
SELECT essai.ok('Serveur : lecture de toutes les tables', (SELECT count(*) FROM public.payments) = 0 AND (SELECT count(*) FROM public.users) > 0);
RESET ROLE;

-- 8. Suppression d'un compte : tout disparaît avec lui.
DELETE FROM auth.users WHERE id = :B;
SELECT essai.ok('Compte supprimé : profil, likes, Match effacés', (SELECT count(*) FROM public.users WHERE id = :B) = 0
  AND (SELECT count(*) FROM public.profiles WHERE user_id = :B) = 0 AND (SELECT count(*) FROM public.likes WHERE sender_id = :B OR receiver_id = :B) = 0);

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai.r;
