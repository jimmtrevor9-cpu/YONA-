-- Tâche E — Localisation réelle des membres : appareil > déclarée > IP, indices (pays de
-- l'IP, fuseau horaire), drapeau d'incohérence (VPN possible), pays retenu pour le retrait
-- d'un profil de démonstration, accès et conservation.
-- À lancer sur une base créée par supabase/nouvelle-base (ou toutes les migrations) :
--   psql -v ON_ERROR_STOP=1 -f docs/verification/ajouts-2026-10/e-localisation.sql
-- Tout se passe dans une transaction annulée à la fin : la base n'est pas modifiée.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
BEGIN;
CREATE SCHEMA essai_e;
CREATE TABLE essai_e.r (n serial, test text, ok boolean, detail text);
CREATE FUNCTION essai_e.ok(t text, c boolean, d text DEFAULT NULL) RETURNS void LANGUAGE sql AS
  $$ INSERT INTO essai_e.r (test, ok, detail) VALUES (t, coalesce(c, false), d) $$;
CREATE FUNCTION essai_e.refus(q text) RETURNS text LANGUAGE plpgsql AS
  $$ BEGIN EXECUTE q; RETURN NULL; EXCEPTION WHEN OTHERS THEN RETURN SQLERRM; END $$;
CREATE FUNCTION essai_e.pos(u uuid) RETURNS text LANGUAGE sql AS
  $$ SELECT source || '|' || coalesce(country, '?') || '|' || coalesce(city, '?') || '|' || inconsistent
            || '|' || array_to_string(inconsistency, ',')
     FROM public.profile_locations WHERE user_id = u $$;
GRANT USAGE ON SCHEMA essai_e TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA essai_e TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA essai_e TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA essai_e TO authenticated, service_role;
\set A '''e0000000-0000-0000-0000-00000000000a'''
\set B '''e0000000-0000-0000-0000-00000000000b'''
\set ADM '''e0000000-0000-0000-0000-0000000000ad'''
-- Requête arrivée par un VPN situé en France (en-têtes transmis par le serveur du site).
\set VPN '''{"x-yona-country":"FR","x-yona-city":"Paris"}'''
\set GAB '''{"x-yona-country":"GA","x-yona-city":"Libreville"}'''
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) VALUES
 ('00000000-0000-0000-0000-000000000000', :A, 'authenticated', 'authenticated', 'awa@essai-e.test', 'x', '{"provider":"email"}', '{"first_name":"Awa"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :B, 'authenticated', 'authenticated', 'ben@essai-e.test', 'x', '{"provider":"email"}', '{"first_name":"Ben"}', now(), now()),
 ('00000000-0000-0000-0000-000000000000', :ADM, 'authenticated', 'authenticated', 'adm@essai-e.test', 'x', '{"provider":"email"}', '{"first_name":"Ange"}', now(), now());
INSERT INTO public.user_roles (user_id, role) VALUES (:ADM, 'admin');
UPDATE public.profiles SET gender = 'female', birth_date = '1996-04-12', country = 'Gabon', region = 'Estuaire',
  city = 'Libreville', terms_accepted_at = now(), onboarding_step = 4, onboarding_completed_at = now(),
  status = 'active' WHERE user_id = :A;
UPDATE public.preferences SET preferred_gender = 'male' WHERE user_id = :A;

-- 1. Ville déclarée à l'étape « Où es-tu ? », visite depuis le Gabon : cohérent
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :GAB, true);
SELECT public.set_member_location(:A, 'declared', 0.39, 9.45, 'GA', 'Estuaire', 'Libreville', NULL, 'Africa/Libreville', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('Ville déclarée retenue (Libreville, Gabon), cohérente', essai_e.pos(:A) = 'declared|Gabon|Libreville|false|', essai_e.pos(:A));

-- 2. Visite par un VPN en France : la position déclarée reste retenue, drapeau levé
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :VPN, true);
SELECT public.set_member_location(:A, 'ip', 48.86, 2.35, 'FR', 'Île-de-France', 'Paris', NULL, 'Africa/Libreville', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('VPN en France : la position déclarée reste retenue, incohérence « IP en FR »',
  essai_e.pos(:A) = 'declared|Gabon|Libreville|true|ip_country:FR', essai_e.pos(:A));
SELECT essai_e.ok('Pays retenu = Gabon (jamais le pays du VPN)', public.member_country(:A) = 'Gabon');

-- 3. Position de l'appareil (GPS) : prioritaire, même derrière le VPN ; fuseau de Paris
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :VPN, true);
SELECT public.set_member_location(:A, 'device', 0.4162, 9.4673, 'GA', 'Estuaire', 'Libreville', 35, 'Europe/Paris', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('Position de l''appareil retenue ; indices : IP en FR et fuseau de Paris',
  essai_e.pos(:A) = 'device|Gabon|Libreville|true|ip_country:FR,timezone:Europe/Paris', essai_e.pos(:A));
SELECT essai_e.ok('Position arrondie à environ 1 km (2 décimales)',
  (SELECT latitude = 0.42 AND longitude = 9.47 AND accuracy_m = 35 FROM public.profile_locations WHERE user_id = :A));

-- 4. Une ville déclarée ensuite ne remplace pas la position de l'appareil
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :GAB, true);
SELECT public.set_member_location(:A, 'declared', 4.05, 9.7, 'CM', 'Littoral', 'Douala', NULL, 'Africa/Libreville', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('Priorité : appareil > déclarée (Douala déclarée ne remplace pas)',
  essai_e.pos(:A) = 'device|Gabon|Libreville|false|', essai_e.pos(:A));

-- 5. Profil affiché en France, appareil au Gabon : indice « pays déclaré différent »
UPDATE public.profiles SET country = 'France', city = 'Lyon' WHERE user_id = :A;
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :GAB, true);
SELECT public.set_member_location(:A, 'ip', 0.39, 9.45, 'GA', NULL, 'Libreville', NULL, 'Africa/Libreville', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('Appareil au Gabon, profil « France » : signalé, pays retenu Gabon',
  essai_e.pos(:A) = 'device|Gabon|Libreville|true|declared_country:France' AND public.member_country(:A) = 'Gabon',
  essai_e.pos(:A));

-- 6. Membre sans appareil ni ville : l'IP en dernier recours ; fuseau incohérent signalé
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :VPN, true);
SELECT public.set_member_location(:B, 'ip', 48.86, 2.35, 'FR', 'Île-de-France', 'Paris', NULL, 'Africa/Douala', 'fr-CM');
RESET ROLE;
SELECT essai_e.ok('IP en dernier recours ; fuseau de Douala contredit la France',
  essai_e.pos(:B) = 'ip|France|Paris|true|timezone:Africa/Douala', essai_e.pos(:B));
SELECT essai_e.ok('Fuseau Africa/Lagos accepté pour le Gabon (même fuseau)',
  EXISTS (SELECT 1 FROM public.geo_timezones WHERE tz = 'Africa/Lagos' AND 'GA' = ANY (country_codes)));

-- 7. Position de plus de 6 mois : remplacée par une source plus faible
UPDATE public.profile_locations SET updated_at = now() - interval '7 months' WHERE user_id = :A;
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :GAB, true);
SELECT public.set_member_location(:A, 'declared', 45.76, 4.84, 'FR', 'Auvergne-Rhône-Alpes', 'Lyon', NULL, 'Europe/Paris', 'fr-FR');
RESET ROLE;
SELECT essai_e.ok('Position de plus de 6 mois remplacée par la ville déclarée',
  essai_e.pos(:A) LIKE 'declared|France|Lyon|true|ip_country:GA', essai_e.pos(:A));

-- 8. Données invalides, accès
SET LOCAL ROLE service_role;
SELECT essai_e.ok('Coordonnées impossibles refusées',
  essai_e.refus($$SELECT public.set_member_location('e0000000-0000-0000-0000-00000000000a', 'device', 95, 10)$$) = 'invalid_location');
SELECT essai_e.ok('Source inconnue refusée',
  essai_e.refus($$SELECT public.set_member_location('e0000000-0000-0000-0000-00000000000a', 'gps', 1, 1)$$) = 'invalid_source');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :B, true);
SELECT essai_e.ok('Un membre ne peut pas choisir lui-même sa position retenue',
  essai_e.refus($$SELECT public.set_member_location('e0000000-0000-0000-0000-00000000000b', 'device', 0.39, 9.45, 'GA')$$) LIKE '%permission denied%');
SELECT essai_e.ok('Un membre voit sa propre position, pas celle des autres',
  (SELECT count(*) FROM public.profile_locations WHERE user_id = :B) = 1
  AND (SELECT count(*) FROM public.profile_locations WHERE user_id = :A) = 0);
SELECT essai_e.ok('Un membre ne lit pas l''historique des positions',
  (SELECT count(*) FROM public.location_history) = 0);
SELECT essai_e.ok('Liste des incohérences : réservée à l''administration',
  essai_e.refus($$SELECT * FROM public.admin_location_flags()$$) LIKE '%admin%');
-- Ancienne fonction (navigateur) : position « appareil » sans ville connue
SELECT public.set_my_location(0.39, 9.45);
RESET ROLE;
SELECT essai_e.ok('Ancienne fonction : source « appareil », pays inconnu (le profil sert alors)',
  essai_e.pos(:B) LIKE 'device|?|?|%' AND public.member_country(:B) IS NOT DISTINCT FROM (SELECT country FROM public.profiles WHERE user_id = :B));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :ADM, true);
SELECT essai_e.ok('Administration : membre signalé avec ses indices',
  (SELECT inconsistency FROM public.admin_location_flags() WHERE user_id = :A) = ARRAY['ip_country:GA']);
SELECT essai_e.ok('Administration : historique des positions du membre',
  jsonb_array_length(public.admin_user_location(:A) -> 'history') >= 6
  AND public.admin_user_location(:A) -> 'current' ->> 'source' = 'declared');
RESET ROLE;

-- 9. Retrait d'un profil de démonstration : pays RETENU, pas celui du VPN ni du profil
SET LOCAL ROLE service_role;
SELECT set_config('request.headers', :VPN, true);
SELECT public.set_member_location(:A, 'device', 0.39, 9.45, 'GA', 'Estuaire', 'Libreville', 20, 'Africa/Libreville', 'fr-FR');
RESET ROLE;
SELECT count(*) AS demo_ga FROM public.profiles WHERE is_virtual AND country = 'Gabon' \gset
SELECT count(*) AS demo_fr FROM public.profiles WHERE is_virtual AND country = 'France' \gset
UPDATE public.profiles SET verified_at = now() WHERE user_id = :A;
SELECT essai_e.ok('Identité vérifiée : un profil de démonstration du Gabon retiré (VPN en France ignoré)',
  (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon') = :demo_ga - 1
  AND (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'France') = :demo_fr,
  :demo_ga || ' → ' || (SELECT count(*) FROM public.profiles WHERE is_virtual AND country = 'Gabon'));

-- 10. RGPD : conservation 12 mois, suppression avec le compte
UPDATE public.location_history SET created_at = now() - interval '13 months' WHERE user_id = :B;
SET LOCAL ROLE service_role;
SELECT public.purge_old_logs() AS purge \gset
RESET ROLE;
SELECT essai_e.ok('Historique des positions effacé après 12 mois',
  (SELECT count(*) FROM public.location_history WHERE user_id = :B) = 0);
DELETE FROM auth.users WHERE id = :A;
SELECT essai_e.ok('Compte supprimé : position et historique supprimés',
  (SELECT count(*) FROM public.profile_locations WHERE user_id = :A) = 0
  AND (SELECT count(*) FROM public.location_history WHERE user_id = :A) = 0);

\pset format aligned
\pset tuples_only off
SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ÉCHEC' END AS etat, test, detail FROM essai_e.r ORDER BY n;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' tests réussis' AS bilan FROM essai_e.r;
ROLLBACK;
