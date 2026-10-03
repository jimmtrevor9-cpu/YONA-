-- Tâche D1 — Journal (connexions, inscriptions, paiements, actions, audit admin, RGPD).
-- À lancer sur une base créée par supabase/nouvelle-base (ou toutes les migrations) :
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/d1-journal.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_d;
CREATE TABLE essai_d.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_d.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_d.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
CREATE FUNCTION essai_d.refus(q text) RETURNS text LANGUAGE plpgsql AS
  $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
GRANT USAGE ON SCHEMA essai_d TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA essai_d TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_d TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_d TO authenticated, service_role;
\set A '''d0000000-0000-0000-0000-00000000000a'''
\set B '''d0000000-0000-0000-0000-00000000000b'''
\set ADM '''d0000000-0000-0000-0000-0000000000ad'''
-- En-têtes d'une requête venue d'un téléphone Android au Gabon.
\set H '''{"x-forwarded-for":"41.158.10.20, 10.0.0.1","user-agent":"Mozilla/5.0 (Linux; Android 14) Chrome/130","cf-ipcountry":"ga"}'''
SELECT set_config('request.jwt.claim.sub', '', true);

-- 1. Inscriptions (e-mail, Google) et connexion
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'a@essai.test', 'x', '{"provider":"email"}', '{"first_name":"Ada"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :B, 'authenticated', 'authenticated', 'b@essai.test', 'x', '{"provider":"google"}', '{"first_name":"Ben"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :ADM, 'authenticated', 'authenticated', 'adm@essai.test', 'x', '{"provider":"email"}', '{"first_name":"Ange"}', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES (:ADM, 'admin');
SELECT essai_d.ok('Inscription : événement « signup » avec la méthode (e-mail, Google)',
  (SELECT count(*) FROM public.auth_events WHERE event = 'signup' AND user_id IN (:A, :B)) = 2
  AND (SELECT method FROM public.auth_events WHERE event = 'signup' AND user_id = :B) = 'google');
SELECT essai_d.ok('Parcours : « compte créé »',
  (SELECT count(*) FROM public.signup_events WHERE step = 'account_created' AND user_id IN (:A, :B)) = 2);
SELECT essai_d.ok('Profils de démonstration : jamais dans le journal',
  (SELECT count(*) FROM public.auth_events WHERE email LIKE '%@profils-virtuels.yona.invalid') = 0);
UPDATE auth.users SET last_sign_in_at = now() WHERE id = :A;
SELECT essai_d.ok('Connexion réussie tracée (déclencheur sur auth.users)',
  (SELECT count(*) FROM public.auth_events WHERE event = 'login' AND user_id = :A) = 1);
-- Contexte envoyé par le site après la connexion
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true), set_config('request.headers', :H, true);
SELECT public.record_session_context('Africa/Libreville');
RESET ROLE;
SELECT essai_d.ok('Connexion : IP, pays, appareil et fuseau rattachés',
  (SELECT ip = '41.158.10.20' AND country = 'GA' AND user_agent LIKE '%Android%' AND timezone = 'Africa/Libreville'
   FROM public.auth_events WHERE event = 'login' AND user_id = :A));

-- 2. Connexions échouées (serveur) et limite anti-abus
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :H, true);
SELECT public.record_login_failure('A@Essai.test', 'email');
SELECT public.record_login_failure('inconnu@essai.test', 'email') FROM generate_series(1, 30);
RESET ROLE;
SELECT essai_d.ok('Connexion échouée : adresse saisie (sans mot de passe) et membre reconnu',
  (SELECT user_id = :A::uuid AND email = 'a@essai.test' FROM public.auth_events
   WHERE event = 'login_failed' ORDER BY id LIMIT 1));
SELECT essai_d.ok('Anti-abus : 20 échecs au plus par IP et par 10 minutes',
  (SELECT count(*) FROM public.auth_events WHERE event = 'login_failed') = 20,
  (SELECT count(*) FROM public.auth_events WHERE event = 'login_failed')::text);
SET LOCAL ROLE authenticated;
SELECT essai_d.ok('Un membre ne peut pas inventer un échec de connexion',
  essai_d.refus('SELECT public.record_login_failure(''x@y.z'')') LIKE '%permission denied%');

-- 3. Parcours d'inscription : étapes 1 à 4, profil terminé, vérification
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT public.record_signup_step(s) FROM generate_series(1, 4) s;
SELECT public.record_signup_step(2);
UPDATE public.profiles SET gender = 'female', birth_date = '1995-05-05', country = 'Gabon', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active' WHERE user_id = auth.uid();
UPDATE public.preferences SET preferred_gender = 'male' WHERE user_id = auth.uid();
RESET ROLE;
-- Vérification d'identité : demandée par le serveur du site (clé service), cas incertain.
SET LOCAL ROLE service_role;
SELECT public.start_identity_verification(:A, true, NULL, true) ->> 'id' AS verif \gset
SELECT public.record_verification_result(:'verif', 'pending', 'gray_zone', 'local', 0.5, NULL, 0.8, 0.1) AS r \gset
RESET ROLE;
SELECT essai_d.ok('Parcours : étapes 1 à 4 (une seule fois chacune), profil terminé, vérification demandée',
  (SELECT string_agg(step, ',' ORDER BY id) FROM public.signup_events WHERE user_id = :A)
  = 'account_created,step_1,step_2,step_3,step_4,profile_completed,verification_requested',
  (SELECT string_agg(step, ',' ORDER BY id) FROM public.signup_events WHERE user_id = :A));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT public.admin_review_verification(:'verif', true);
RESET ROLE;
SELECT essai_d.ok('Parcours : vérification réussie',
  EXISTS (SELECT 1 FROM public.signup_events WHERE user_id = :A AND step = 'verification_approved'));
SELECT essai_d.ok('Audit : la décision de l''admin est tracée (qui, quoi, avant / après)',
  EXISTS (SELECT 1 FROM public.admin_audit_log WHERE admin_id = :ADM AND target_table = 'profile_verifications'
          AND changes -> 'status' ->> 'après' = 'approved'));

-- 4. Paiements : tentative, réussite, abandon, webhook
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true), set_config('request.headers', :H, true);
SELECT public.start_premium_payment('premium_monthly', 'test') AS pay1 \gset
SELECT public.start_premium_payment('premium_yearly', 'stripe') AS pay2 \gset
RESET ROLE;
SELECT essai_d.ok('Paiement : tentatives tracées (produit, montant, prestataire, pays, appareil)',
  (SELECT count(*) FROM public.payment_events WHERE user_id = :A AND event = 'created') = 2
  AND (SELECT product = 'premium_yearly' AND amount = 3500 AND provider = 'stripe' AND country = 'GA'
       FROM public.payment_events WHERE payment_id = :'pay2' AND event = 'created'));
SET LOCAL ROLE service_role;
SELECT public.confirm_payment(:'pay1', 'test', 'tx-essai-1', 500, 'USD');
SELECT public.record_payment_webhook('checkout.session.expired', :'pay2', 'Session expirée', 'cs_essai');
RESET ROLE;
SELECT essai_d.ok('Paiement réussi tracé',
  EXISTS (SELECT 1 FROM public.payment_events WHERE payment_id = :'pay1' AND event = 'succeeded'));
SELECT essai_d.ok('Webhook reçu tracé ; paiement expiré passé à « annulé » avec son motif',
  EXISTS (SELECT 1 FROM public.payment_events WHERE payment_id = :'pay2' AND event = 'webhook')
  AND EXISTS (SELECT 1 FROM public.payment_events WHERE payment_id = :'pay2' AND event = 'cancelled'
              AND reason LIKE 'Session expirée%')
  AND (SELECT status FROM public.payments WHERE id = :'pay2') = 'cancelled');

-- 5. Actions : like, Match, message (sans contenu), blocage
SELECT set_config('request.jwt.claim.sub', '', true);
UPDATE public.profiles SET gender = 'male', birth_date = '1990-01-01', country = 'Gabon', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active',
  verified_at = now() WHERE user_id = :B;
UPDATE public.preferences SET preferred_gender = 'female' WHERE user_id = :B;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :B, 'like', 'active');
SELECT set_config('request.jwt.claim.sub', :B, true);
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :A, 'like', 'active');
SELECT id AS conv FROM public.conversations LIMIT 1 \gset
SELECT public.send_message(:'conv', 'Message secret à ne jamais copier');
RESET ROLE;
SELECT essai_d.ok('Actions tracées : 2 likes, 1 Match, 1 message',
  (SELECT count(*) FROM public.activity_events WHERE event = 'like' AND user_id IN (:A, :B)) = 2
  AND (SELECT count(*) FROM public.activity_events WHERE event = 'match') = 1
  AND (SELECT count(*) FROM public.activity_events WHERE event = 'message' AND user_id = :B) = 1);
SELECT essai_d.ok('Le contenu des messages n''est jamais copié dans le journal',
  NOT EXISTS (SELECT 1 FROM public.activity_events a WHERE to_jsonb(a)::text LIKE '%secret%'));

-- 6. Lecture du journal : administrateurs seulement
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_d.ok('Un membre ne lit aucun journal (ni le sien)',
  (SELECT count(*) FROM public.auth_events) = 0 AND (SELECT count(*) FROM public.activity_events) = 0
  AND (SELECT count(*) FROM public.payment_events) = 0 AND (SELECT count(*) FROM public.admin_audit_log) = 0);
SELECT essai_d.ok('Un membre ne peut pas écrire dans le journal',
  essai_d.refus('INSERT INTO public.activity_events (event) VALUES (''like'')') LIKE '%permission denied%');
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT essai_d.ok('L''administrateur lit le journal',
  (SELECT count(*) FROM public.auth_events) > 0 AND (SELECT count(*) FROM public.activity_events) > 0);
RESET ROLE;

-- 7. Erreurs du serveur
SET LOCAL ROLE service_role;
SELECT public.log_server_error('stripe-webhook', 'Signature invalide', NULL, '/api/stripe-webhook');
RESET ROLE;
SELECT essai_d.ok('Erreur du serveur enregistrée', (SELECT count(*) FROM public.server_errors) = 1);

-- 8. RGPD : suppression du compte = journal anonymisé ; purge des IP après 12 mois
DELETE FROM auth.users WHERE id = :B;
SELECT essai_d.ok('Compte supprimé : « account_deleted » et plus d''IP ni d''appareil pour ce membre',
  EXISTS (SELECT 1 FROM public.activity_events WHERE user_id = :B AND event = 'account_deleted')
  AND NOT EXISTS (SELECT 1 FROM public.activity_events WHERE user_id = :B AND (ip IS NOT NULL OR user_agent IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM public.auth_events WHERE user_id = :B AND (ip IS NOT NULL OR email IS NOT NULL)));
UPDATE public.auth_events SET created_at = now() - interval '13 months' WHERE user_id = :A AND event = 'login';
SET LOCAL ROLE service_role;
SELECT public.purge_old_logs() AS purge \gset
RESET ROLE;
SELECT essai_d.ok('Purge : IP et appareil effacés après 12 mois, l''événement reste',
  (SELECT ip IS NULL AND user_agent IS NULL FROM public.auth_events WHERE user_id = :A AND event = 'login'));

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_d.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_d.r;
ROLLBACK;
