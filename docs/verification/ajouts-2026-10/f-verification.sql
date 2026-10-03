-- Tâche F — Vérification d'identité automatique : consentement, essais par jour, consigne,
-- décisions (vérifié / refusé / en attente), suppression des images, accès réservés aux
-- membres vérifiés (découverte, likes, messages, demandes de contact), réglages.
-- La comparaison des visages elle-même (moteur) est testée à part (f-moteur-visages) ; ici,
-- le serveur est simulé par des appels avec la clé service, comme le fait le site.
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/f-verification.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_f;
CREATE TABLE essai_f.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_f.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_f.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
CREATE FUNCTION essai_f.refus(q text) RETURNS text LANGUAGE plpgsql AS
  $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
GRANT USAGE ON SCHEMA essai_f TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA essai_f TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_f TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_f TO authenticated, service_role;
\set A '''f0000000-0000-0000-0000-00000000000a'''
\set B '''f0000000-0000-0000-0000-00000000000b'''
\set C '''f0000000-0000-0000-0000-00000000000c'''
\set ADM '''f0000000-0000-0000-0000-0000000000ad'''
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'awa@essai-f.test', 'x', '{"provider":"email"}', '{"first_name":"Awa"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :B, 'authenticated', 'authenticated', 'ben@essai-f.test', 'x', '{"provider":"email"}', '{"first_name":"Ben"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :C, 'authenticated', 'authenticated', 'carole@essai-f.test', 'x', '{"provider":"email"}', '{"first_name":"Carole"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :ADM, 'authenticated', 'authenticated', 'adm@essai-f.test', 'x', '{"provider":"email"}', '{"first_name":"Ange"}', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES (:ADM, 'admin');
UPDATE public.profiles SET gender = 'female', birth_date = '1995-05-05', country = 'Gabon', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active', visibility = 'visible'
WHERE user_id IN (:A, :C);
UPDATE public.profiles SET gender = 'male', birth_date = '1990-01-01', country = 'Gabon', city = 'Libreville',
  terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(), status = 'active', visibility = 'visible'
WHERE user_id = :B;
UPDATE public.preferences SET preferred_gender = 'male' WHERE user_id IN (:A, :C);
UPDATE public.preferences SET preferred_gender = 'female' WHERE user_id = :B;
SELECT count(*) AS demo_ga FROM public.profiles WHERE is_virtual AND country = 'Gabon' \gset

-- 1. Sans vérification : ni découverte, ni like, ni message, ni demande de contact
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_f.ok('Non vérifiée : aucun profil dans Découvrir', (SELECT count(*) FROM public.discover_profiles(30)) = 0);
SELECT essai_f.ok('Non vérifiée : like refusé',
  essai_f.refus($$INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), 'f0000000-0000-0000-0000-00000000000b', 'like', 'active')$$) LIKE '%row-level security%');
SELECT essai_f.ok('Non vérifiée : demande de contact refusée',
  essai_f.refus($$SELECT public.send_contact_request('f0000000-0000-0000-0000-00000000000b', 'Bonjour')$$) LIKE '%identity_not_verified%'
  OR essai_f.refus($$SELECT public.send_contact_request('f0000000-0000-0000-0000-00000000000b', 'Bonjour')$$) LIKE '%profile_unavailable%');
SELECT essai_f.ok('Un membre ne crée pas lui-même une demande de vérification',
  essai_f.refus($$INSERT INTO public.profile_verifications (user_id, method, storage_path) VALUES (auth.uid(), 'selfie', 'f0000000-0000-0000-0000-00000000000a/x.jpg')$$) LIKE '%permission denied%');
SELECT essai_f.ok('Un membre ne lance pas l''analyse ni ne choisit le résultat',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', true, NULL, true)$$) LIKE '%permission denied%'
  AND essai_f.refus($$SELECT public.record_verification_result(gen_random_uuid(), 'approved', 'match', 'local')$$) LIKE '%permission denied%');
SELECT essai_f.ok('Un membre ne lit pas les réglages',
  (SELECT count(*) FROM public.verification_settings) = 0);
SELECT essai_f.ok('État : non vérifiée, 5 essais par jour',
  (public.my_verification_status() ->> 'verified')::boolean = false
  AND (public.my_verification_status() ->> 'attempts_left')::int = 5);
RESET ROLE;

-- 2. Démarrage : consentement, choix, consigne aléatoire, emplacements privés
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT essai_f.ok('Consentement obligatoire',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', true, NULL, false)$$) LIKE '%consent_required%');
SELECT essai_f.ok('Il faut un selfie ou une pièce',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', false, NULL, true)$$) LIKE '%nothing_to_check%');
SELECT essai_f.ok('Type de pièce inconnu refusé',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', true, 'permis', true)$$) LIKE '%invalid_document_type%');
SELECT public.start_identity_verification(:A, true, 'passport', true) AS s1 \gset
SELECT essai_f.ok('Selfie + passeport : consigne gauche ou droite, 3 images dans le dossier du membre',
  (:'s1'::jsonb ->> 'challenge') IN ('turn_left', 'turn_right')
  AND (:'s1'::jsonb ->> 'selfie_path') LIKE 'f0000000-0000-0000-0000-00000000000a/%/selfie.jpg'
  AND (:'s1'::jsonb ->> 'challenge_path') LIKE 'f0000000-0000-0000-0000-00000000000a/%/consigne.jpg'
  AND (:'s1'::jsonb ->> 'document_path') LIKE 'f0000000-0000-0000-0000-00000000000a/%/piece.jpg'
  AND (:'s1'::jsonb ->> 'attempts_left')::int = 4, :'s1');
SELECT essai_f.ok('Une seule vérification à la fois',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', true, NULL, true)$$) LIKE '%verification_in_progress%');
-- Décision automatique : vérifiée
SELECT public.record_verification_result((:'s1'::jsonb ->> 'id')::uuid, 'approved', 'match', 'local', 0.78, 0.71, 0.86, 0.12,
  '{"faces": {"selfie": 1}}') AS r1 \gset
RESET ROLE;
SELECT essai_f.ok('Vérifiée automatiquement : profil vérifié, scores et type de pièce gardés',
  (SELECT verified_at IS NOT NULL FROM public.profiles WHERE user_id = :A)
  AND (SELECT status = 'approved' AND automatic AND profile_similarity = 0.78 AND document_type = 'passport' AND decided_at IS NOT NULL
       FROM public.profile_verifications WHERE id = (:'s1'::jsonb ->> 'id')::uuid));
SELECT essai_f.ok('Images supprimées après la décision (selfie, consigne, pièce)',
  (SELECT count(*) FROM public.storage_cleanup_queue WHERE bucket_id = 'verifications' AND path LIKE 'f0000000-0000-0000-0000-00000000000a/%') = 3
  AND (SELECT files_deleted_at IS NOT NULL FROM public.profile_verifications WHERE id = (:'s1'::jsonb ->> 'id')::uuid));
SELECT essai_f.ok('Journal : vérification demandée puis réussie',
  (SELECT string_agg(step, ',' ORDER BY id) FROM public.signup_events WHERE user_id = :A AND step LIKE 'verification%')
  = 'verification_requested,verification_approved');
SELECT essai_f.ok('Vérifiée : un profil de démonstration du Gabon retiré',
  (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon') = :demo_ga - 1);
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT essai_f.ok('Déjà vérifiée : pas de nouvelle tentative',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000a', true, NULL, true)$$) LIKE '%already_verified%');
RESET ROLE;

-- 3. Refus, essais limités par jour (le moteur indisponible ne compte pas)
UPDATE public.verification_settings SET max_attempts_per_day = 2;
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT public.start_identity_verification(:C, true, NULL, true) ->> 'id' AS c1 \gset
SELECT public.record_verification_result(:'c1', 'rejected', 'mismatch', 'local', 0.22, NULL, 0.8, 0.1) AS rc1 \gset
SELECT public.start_identity_verification(:C, true, NULL, true) ->> 'id' AS c2 \gset
SELECT public.record_verification_result(:'c2', 'rejected', 'blurry', 'local') AS rc2 \gset
SELECT essai_f.ok('Essais du jour épuisés : nouvelle tentative refusée',
  essai_f.refus($$SELECT public.start_identity_verification('f0000000-0000-0000-0000-00000000000c', true, NULL, true)$$) LIKE '%too_many_attempts%');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :C, true);
SELECT essai_f.ok('État du membre : refusée (motif), plus d''essai aujourd''hui',
  public.my_verification_status() -> 'latest' ->> 'reason' = 'blurry'
  AND (public.my_verification_status() ->> 'attempts_left')::int = 0);
RESET ROLE;
UPDATE public.profile_verifications SET created_at = now() - interval '25 hours' WHERE user_id = :C;
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT public.start_identity_verification(:C, true, NULL, true) ->> 'id' AS c3 \gset
SELECT public.record_verification_result(:'c3', 'pending', 'engine_unavailable', 'local') AS rc3 \gset
RESET ROLE;
SELECT essai_f.ok('Le lendemain : nouvel essai ; moteur indisponible → « en attente », jamais « vérifié »',
  (SELECT status FROM public.profile_verifications WHERE id = :'c3') = 'pending'
  AND (SELECT verified_at IS NULL FROM public.profiles WHERE user_id = :C));
SELECT essai_f.ok('En attente : images gardées pour l''examen',
  (SELECT count(*) FROM public.storage_cleanup_queue WHERE path LIKE 'f0000000-0000-0000-0000-00000000000c/' || :'c3' || '/%') = 0);

-- 4. Administration : cas incertains, décision, réglages
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT essai_f.ok('Admin : cas en attente visible (motif, chemins des images)',
  (SELECT count(*) FROM public.admin_verification_queue() WHERE id = :'c3' AND reason = 'engine_unavailable' AND challenge_path IS NOT NULL) = 1);
SELECT public.admin_review_verification(:'c3', false) AS rv \gset
RESET ROLE;
SELECT essai_f.ok('Admin : refus enregistré, images en file de suppression',
  (SELECT status = 'rejected' AND reason = 'manual' AND reviewed_by = 'f0000000-0000-0000-0000-0000000000ad'
   FROM public.profile_verifications WHERE id = :'c3')
  AND (SELECT count(*) FROM public.storage_cleanup_queue WHERE path LIKE 'f0000000-0000-0000-0000-00000000000c/' || :'c3' || '/%') = 2);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
UPDATE public.verification_settings SET accept_similarity = 0.6, reject_similarity = 0.45, file_retention_hours = 24;
SELECT essai_f.ok('Admin : réglages modifiés et tracés dans l''audit',
  (SELECT accept_similarity = 0.6 AND file_retention_hours = 24 FROM public.verification_settings)
  AND EXISTS (SELECT 1 FROM public.admin_audit_log WHERE target_table = 'verification_settings' AND admin_id = :ADM));
SELECT essai_f.ok('Réglages incohérents refusés (refus > acceptation)',
  essai_f.refus($$UPDATE public.verification_settings SET reject_similarity = 0.9$$) LIKE '%verification_settings_local_order%');
SELECT essai_f.ok('Admin non vérifié : la découverte reste ouverte (mode administration)',
  public.can_browse_profiles());
RESET ROLE;

-- 5. Délai de conservation réglé, tentatives abandonnées
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT public.start_identity_verification(:B, false, 'student_card', true) ->> 'id' AS b1 \gset
SELECT public.record_verification_result(:'b1', 'approved', 'match', 'local', 0.66) AS rb1 \gset
RESET ROLE;
SELECT essai_f.ok('Conservation 24 h : images gardées juste après la décision',
  (SELECT count(*) FROM public.storage_cleanup_queue WHERE path LIKE 'f0000000-0000-0000-0000-00000000000b/%') = 0);
UPDATE public.profile_verifications SET decided_at = now() - interval '25 hours' WHERE id = :'b1';
UPDATE public.verification_settings SET max_attempts_per_day = 5;
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT public.start_identity_verification(:C, true, NULL, true) ->> 'id' AS c4 \gset
RESET ROLE;
UPDATE public.profile_verifications SET created_at = now() - interval '40 minutes' WHERE id = :'c4';
-- Clé service : aucune session de membre (comme le serveur du site).
SELECT set_config('request.jwt.claim.sub', '', true);
SET LOCAL ROLE service_role;
SELECT public.purge_verification_files() AS purge \gset
RESET ROLE;
SELECT essai_f.ok('Nettoyage : délai écoulé → images supprimées ; tentative abandonnée → refusée et supprimée',
  (SELECT count(*) FROM public.storage_cleanup_queue WHERE path LIKE 'f0000000-0000-0000-0000-00000000000b/%') = 1
  AND (SELECT status = 'rejected' AND reason = 'abandoned' FROM public.profile_verifications WHERE id = :'c4')
  AND (SELECT count(*) FROM public.storage_cleanup_queue WHERE path LIKE 'f0000000-0000-0000-0000-00000000000c/' || :'c4' || '/%') = 2);

-- 6. Vérifiés : découverte, likes, messages
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :A, true);
SELECT essai_f.ok('Vérifiée : des profils dans Découvrir', (SELECT count(*) FROM public.discover_profiles(30)) > 0);
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :B, 'like', 'active');
SELECT set_config('request.jwt.claim.sub', :B, true);
INSERT INTO public.likes (sender_id, receiver_id, kind, status) VALUES (auth.uid(), :A, 'like', 'active');
SELECT id AS conv FROM public.conversations WHERE (user_1_id, user_2_id) IN ((:A, :B), (:B, :A)) LIMIT 1 \gset
SELECT essai_f.ok('Vérifiés : Match et message envoyé',
  (SELECT status FROM public.send_message(:'conv', 'Bonjour Awa')) = 'delivered');
RESET ROLE;
-- Un compte qui perdrait sa vérification ne peut plus écrire (contrôle à chaque message).
SELECT set_config('request.jwt.claim.sub', '', true);
UPDATE public.profiles SET verified_at = NULL WHERE user_id = :B;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :B, true);
SELECT essai_f.ok('Identité non vérifiée : message refusé (contrôle de la base)',
  essai_f.refus(format($$SELECT public.send_message(%L, 'Re-bonjour')$$, :'conv')) LIKE '%identity_not_verified%');
RESET ROLE;

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_f.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_f.r;
ROLLBACK;
