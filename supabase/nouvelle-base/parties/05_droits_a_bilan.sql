-- YONA — base de données complète, partie 5 sur 5
-- Contenu :
--   14. Droits d'accès : écrits un par un (aucun droit automatique) (suite)
--   15. Comptes : chaque nouveau compte (e-mail ou Google) reçoit son profil
--   16. Fichiers : espaces de stockage (privés et publics) et leurs règles
--   17. Temps réel : nouveaux messages affichés sans recharger la page
--   18. Tâches automatiques (pg_cron, si Supabase le permet ; sinon les dates suffisent)
--   19. Données de départ : réglages (publicités, vérification d'identité) et fuseaux horaires
--   20. Données de départ : 247 pays (position, pour le pays le plus proche)
--   21. Données de départ : 40 profils de démonstration (comptes sans mot de passe)
--   22. Premier administrateur (à faire après votre inscription sur le site)
--   23. Bilan
-- À exécuter dans l'ordre (01, 02, …), chaque partie en entier :
-- Supabase → SQL Editor → New query → coller la partie → Run.
-- Chaque partie peut être relancée sans danger (par exemple après une erreur).
-- Fichier généré par scripts/generate-base-complete.py. Ne pas modifier à la main.

SET client_min_messages = warning;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;

-- 94 fonctions — membres connectés : exécution · serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.activate_profile_boost(),
  public.admin_ad_stats(uuid,timestamp with time zone,timestamp with time zone,text,text),
  public.admin_dashboard(timestamp with time zone,timestamp with time zone,text,text),
  public.admin_list_demo_profiles(),
  public.admin_list_payments(),
  public.admin_list_pending_photos(),
  public.admin_list_pending_verifications(),
  public.admin_list_reports(text),
  public.admin_list_subscriptions(),
  public.admin_list_support_tickets(),
  public.admin_list_unlocks(),
  public.admin_list_users(text,text,integer,integer),
  public.admin_location_flags(integer),
  public.admin_log_action(text,text,text,jsonb),
  public.admin_members(text,text,text,text,boolean,integer,integer),
  public.admin_moderate_photo(uuid,boolean,text),
  public.admin_reply_support_ticket(uuid,text,boolean),
  public.admin_resolve_report(uuid,text,text),
  public.admin_review_verification(uuid,boolean),
  public.admin_set_demo_photo(uuid,text,text),
  public.admin_set_user_status(uuid,text,text),
  public.admin_stats(),
  public.admin_user_detail(uuid),
  public.admin_user_history(uuid),
  public.admin_user_location(uuid),
  public.admin_verification_queue(),
  public.assert_admin(),
  public.block_user(uuid),
  public.can_browse_profiles(),
  public.can_view_profile(uuid),
  public.cancel_contact_request(uuid),
  public.clear_my_location(),
  public.consume_ai_quota(text),
  public.create_support_ticket(text,text),
  public.discover_profiles(integer),
  public.distance_km(double precision,double precision,double precision,double precision),
  public.get_ads_for_me(text,integer),
  public.get_ai_quota(text),
  public.get_compatibility(uuid),
  public.get_compatibility_scores(uuid[]),
  public.get_contact_request_quota(),
  public.get_conversation_quota(uuid),
  public.get_favorited_by(),
  public.get_message_quota(uuid),
  public.get_my_boost(),
  public.get_my_premium(),
  public.get_premium_badges(uuid[]),
  public.get_presence(uuid),
  public.get_profile_visitors(),
  public.get_unread_counts(),
  public.get_unread_notification_count(),
  public.has_active_conversation_unlock(uuid),
  public.has_mutual_like(uuid),
  public.has_role(uuid,public.app_role),
  public.is_active_account(uuid),
  public.is_activity_visible(uuid),
  public.is_admin(),
  public.is_blocked_between(uuid,uuid),
  public.is_boosted(uuid),
  public.is_conversation_folder_participant(text),
  public.is_conversation_participant(uuid,uuid),
  public.is_discoverable_profile(uuid),
  public.is_identity_verified(uuid),
  public.is_premium(uuid),
  public.list_blocked_users(),
  public.list_contact_requests(text),
  public.list_notifications(integer),
  public.list_search_cities(text),
  public.list_search_countries(),
  public.list_search_values(text),
  public.mark_all_notifications_read(),
  public.mark_conversation_read(uuid),
  public.mark_notification_read(uuid),
  public.mark_offline(),
  public.my_verification_status(),
  public.normalize_place(text),
  public.record_ad_event(uuid,text,text),
  public.record_logout(),
  public.record_profile_visit(uuid),
  public.record_session_context(text),
  public.record_signup_step(integer),
  public.report_user(uuid,public.report_reason,text,uuid),
  public.respond_contact_request(uuid,boolean),
  public.search_profiles(jsonb,integer),
  public.send_contact_request(uuid,text,boolean),
  public.send_message(uuid,text),
  public.send_voice_message(uuid,text,integer),
  public.set_my_location(double precision,double precision),
  public.set_primary_photo(uuid),
  public.start_conversation_unlock_payment(uuid,text),
  public.start_premium_payment(public.subscription_plan,text),
  public.touch_activity(),
  public.unblock_user(uuid),
  public.undo_last_pass()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.activate_profile_boost(),
  public.admin_ad_stats(uuid,timestamp with time zone,timestamp with time zone,text,text),
  public.admin_dashboard(timestamp with time zone,timestamp with time zone,text,text),
  public.admin_list_demo_profiles(),
  public.admin_list_payments(),
  public.admin_list_pending_photos(),
  public.admin_list_pending_verifications(),
  public.admin_list_reports(text),
  public.admin_list_subscriptions(),
  public.admin_list_support_tickets(),
  public.admin_list_unlocks(),
  public.admin_list_users(text,text,integer,integer),
  public.admin_location_flags(integer),
  public.admin_log_action(text,text,text,jsonb),
  public.admin_members(text,text,text,text,boolean,integer,integer),
  public.admin_moderate_photo(uuid,boolean,text),
  public.admin_reply_support_ticket(uuid,text,boolean),
  public.admin_resolve_report(uuid,text,text),
  public.admin_review_verification(uuid,boolean),
  public.admin_set_demo_photo(uuid,text,text),
  public.admin_set_user_status(uuid,text,text),
  public.admin_stats(),
  public.admin_user_detail(uuid),
  public.admin_user_history(uuid),
  public.admin_user_location(uuid),
  public.admin_verification_queue(),
  public.assert_admin(),
  public.block_user(uuid),
  public.can_browse_profiles(),
  public.can_view_profile(uuid),
  public.cancel_contact_request(uuid),
  public.clear_my_location(),
  public.consume_ai_quota(text),
  public.create_support_ticket(text,text),
  public.discover_profiles(integer),
  public.distance_km(double precision,double precision,double precision,double precision),
  public.get_ads_for_me(text,integer),
  public.get_ai_quota(text),
  public.get_compatibility(uuid),
  public.get_compatibility_scores(uuid[]),
  public.get_contact_request_quota(),
  public.get_conversation_quota(uuid),
  public.get_favorited_by(),
  public.get_message_quota(uuid),
  public.get_my_boost(),
  public.get_my_premium(),
  public.get_premium_badges(uuid[]),
  public.get_presence(uuid),
  public.get_profile_visitors(),
  public.get_unread_counts(),
  public.get_unread_notification_count(),
  public.has_active_conversation_unlock(uuid),
  public.has_mutual_like(uuid),
  public.has_role(uuid,public.app_role),
  public.is_active_account(uuid),
  public.is_activity_visible(uuid),
  public.is_admin(),
  public.is_blocked_between(uuid,uuid),
  public.is_boosted(uuid),
  public.is_conversation_folder_participant(text),
  public.is_conversation_participant(uuid,uuid),
  public.is_discoverable_profile(uuid),
  public.is_identity_verified(uuid),
  public.is_premium(uuid),
  public.list_blocked_users(),
  public.list_contact_requests(text),
  public.list_notifications(integer),
  public.list_search_cities(text),
  public.list_search_countries(),
  public.list_search_values(text),
  public.mark_all_notifications_read(),
  public.mark_conversation_read(uuid),
  public.mark_notification_read(uuid),
  public.mark_offline(),
  public.my_verification_status(),
  public.normalize_place(text),
  public.record_ad_event(uuid,text,text),
  public.record_logout(),
  public.record_profile_visit(uuid),
  public.record_session_context(text),
  public.record_signup_step(integer),
  public.report_user(uuid,public.report_reason,text,uuid),
  public.respond_contact_request(uuid,boolean),
  public.search_profiles(jsonb,integer),
  public.send_contact_request(uuid,text,boolean),
  public.send_message(uuid,text),
  public.send_voice_message(uuid,text,integer),
  public.set_my_location(double precision,double precision),
  public.set_primary_photo(uuid),
  public.start_conversation_unlock_payment(uuid,text),
  public.start_premium_payment(public.subscription_plan,text),
  public.touch_activity(),
  public.unblock_user(uuid),
  public.undo_last_pass()
TO authenticated, service_role;

-- 65 fonctions — serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.activate_conversation_unlock(),
  public.activate_premium_subscription(),
  public.admin_period_kpis(timestamp with time zone,timestamp with time zone),
  public.audit_admin_change(),
  public.check_profile_personal_info(),
  public.check_profile_visibility(),
  public.compatibility_breakdown(uuid,uuid),
  public.confirm_payment(uuid,text,text,integer,text),
  public.consume_free_message(uuid),
  public.contains_phone_number(text),
  public.count_member_login(),
  public.create_conversation_for_match(),
  public.create_match_on_mutual_like(),
  public.create_notification(uuid,text,uuid,jsonb,text),
  public.enforce_photo_limit(),
  public.expire_conversation_unlocks(),
  public.expire_subscriptions(),
  public.expire_verification_attempts(uuid),
  public.handle_new_user(),
  public.init_conversation_usage(),
  public.is_real_member(uuid),
  public.lock_conversation_for_sending(uuid,uuid),
  public.log_account_change(),
  public.log_activity(uuid,text,uuid,uuid),
  public.log_auth_user_change(),
  public.log_member_action(),
  public.log_payment_change(),
  public.log_server_error(text,text,uuid,text,jsonb),
  public.log_signup_milestone(),
  public.member_country(uuid),
  public.messages_block_phone_numbers(),
  public.notify_contact_request(),
  public.notify_favorite(),
  public.notify_like(),
  public.notify_match(),
  public.notify_message(),
  public.notify_visit(),
  public.photos_after_delete(),
  public.photos_before_insert(),
  public.protect_like_parties(),
  public.protect_photo_status(),
  public.protect_profile_status(),
  public.protect_server_profile_fields(),
  public.protect_terms_accepted_at(),
  public.protect_user_columns(),
  public.purge_old_logs(),
  public.purge_verification_files(),
  public.queue_ad_media_cleanup(),
  public.queue_verification_files(uuid,text),
  public.recent_signups(),
  public.record_login_failure(text,text),
  public.record_payment_webhook(text,uuid,text,text),
  public.record_verification_result(uuid,text,text,text,numeric,numeric,numeric,numeric,jsonb),
  public.refund_ai_quota(uuid,text),
  public.refuse_blocked_interaction(),
  public.refuse_contact_to_demo_profile(),
  public.remove_one_virtual_profile(text,public.gender),
  public.replace_virtual_profile_on_signup(),
  public.request_context(),
  public.require_verified_sender(),
  public.set_like_created_at(),
  public.set_member_location(uuid,text,double precision,double precision,text,text,text,integer,text,text,text,text),
  public.set_updated_at(),
  public.start_identity_verification(uuid,boolean,text,boolean),
  public.wants_notification(uuid,text)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.activate_conversation_unlock(),
  public.activate_premium_subscription(),
  public.admin_period_kpis(timestamp with time zone,timestamp with time zone),
  public.audit_admin_change(),
  public.check_profile_personal_info(),
  public.check_profile_visibility(),
  public.compatibility_breakdown(uuid,uuid),
  public.confirm_payment(uuid,text,text,integer,text),
  public.consume_free_message(uuid),
  public.contains_phone_number(text),
  public.count_member_login(),
  public.create_conversation_for_match(),
  public.create_match_on_mutual_like(),
  public.create_notification(uuid,text,uuid,jsonb,text),
  public.enforce_photo_limit(),
  public.expire_conversation_unlocks(),
  public.expire_subscriptions(),
  public.expire_verification_attempts(uuid),
  public.handle_new_user(),
  public.init_conversation_usage(),
  public.is_real_member(uuid),
  public.lock_conversation_for_sending(uuid,uuid),
  public.log_account_change(),
  public.log_activity(uuid,text,uuid,uuid),
  public.log_auth_user_change(),
  public.log_member_action(),
  public.log_payment_change(),
  public.log_server_error(text,text,uuid,text,jsonb),
  public.log_signup_milestone(),
  public.member_country(uuid),
  public.messages_block_phone_numbers(),
  public.notify_contact_request(),
  public.notify_favorite(),
  public.notify_like(),
  public.notify_match(),
  public.notify_message(),
  public.notify_visit(),
  public.photos_after_delete(),
  public.photos_before_insert(),
  public.protect_like_parties(),
  public.protect_photo_status(),
  public.protect_profile_status(),
  public.protect_server_profile_fields(),
  public.protect_terms_accepted_at(),
  public.protect_user_columns(),
  public.purge_old_logs(),
  public.purge_verification_files(),
  public.queue_ad_media_cleanup(),
  public.queue_verification_files(uuid,text),
  public.recent_signups(),
  public.record_login_failure(text,text),
  public.record_payment_webhook(text,uuid,text,text),
  public.record_verification_result(uuid,text,text,text,numeric,numeric,numeric,numeric,jsonb),
  public.refund_ai_quota(uuid,text),
  public.refuse_blocked_interaction(),
  public.refuse_contact_to_demo_profile(),
  public.remove_one_virtual_profile(text,public.gender),
  public.replace_virtual_profile_on_signup(),
  public.request_context(),
  public.require_verified_sender(),
  public.set_like_created_at(),
  public.set_member_location(uuid,text,double precision,double precision,text,text,text,integer,text,text,text,text),
  public.set_updated_at(),
  public.start_identity_verification(uuid,boolean,text,boolean),
  public.wants_notification(uuid,text)
TO service_role;

-- 10 fonctions — tout le monde : exécution · visiteurs : exécution · membres connectés : exécution · serveur du site : exécution
REVOKE ALL ON FUNCTION
  public.ai_usage_day(),
  public.auth_method(text),
  public.clear_profile_coordinates(),
  public.location_priority(text),
  public.payment_product(public.payment_type,jsonb),
  public.premium_plan_amount(public.subscription_plan),
  public.set_favorite_created_at(),
  public.text_items_max_length(text[],integer),
  public.url_decode(text),
  public.utc_day_start()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION
  public.ai_usage_day(),
  public.auth_method(text),
  public.clear_profile_coordinates(),
  public.location_priority(text),
  public.payment_product(public.payment_type,jsonb),
  public.premium_plan_amount(public.subscription_plan),
  public.set_favorite_created_at(),
  public.text_items_max_length(text[],integer),
  public.url_decode(text),
  public.utc_day_start()
TO PUBLIC, anon, authenticated, service_role;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;

-- ============================================================================
-- 15. Comptes : chaque nouveau compte (e-mail ou Google) reçoit son profil
-- ============================================================================

CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE TRIGGER on_auth_user_logged AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.log_auth_user_change();

-- ============================================================================
-- 16. Fichiers : espaces de stockage (privés et publics) et leurs règles
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('ads', 'ads', true, 15728640, '{image/jpeg,image/png,image/webp,video/mp4,video/webm}'),
  ('demo-profils', 'demo-profils', true, 2097152, '{image/jpeg,image/png,image/webp}'),
  ('photos', 'photos', false, 5242880, '{image/jpeg,image/png,image/webp}'),
  ('verifications', 'verifications', false, 8388608, '{image/jpeg,image/png,image/webp}'),
  ('voice-messages', 'voice-messages', false, 2097152, '{audio/webm,audio/ogg,audio/mp4,audio/mpeg}')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS ads_storage_delete_admin ON storage.objects;
CREATE POLICY ads_storage_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'ads'::text) AND public.is_admin()));

DROP POLICY IF EXISTS ads_storage_insert_admin ON storage.objects;
CREATE POLICY ads_storage_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'ads'::text) AND public.is_admin()));

DROP POLICY IF EXISTS ads_storage_select_admin ON storage.objects;
CREATE POLICY ads_storage_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'ads'::text) AND public.is_admin()));

DROP POLICY IF EXISTS ads_storage_update_admin ON storage.objects;
CREATE POLICY ads_storage_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (((bucket_id = 'ads'::text) AND public.is_admin()))
  WITH CHECK (((bucket_id = 'ads'::text) AND public.is_admin()));

DROP POLICY IF EXISTS demo_storage_delete_admin ON storage.objects;
CREATE POLICY demo_storage_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'demo-profils'::text) AND public.is_admin()));

DROP POLICY IF EXISTS demo_storage_insert_admin ON storage.objects;
CREATE POLICY demo_storage_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'demo-profils'::text) AND public.is_admin()));

DROP POLICY IF EXISTS demo_storage_select_admin ON storage.objects;
CREATE POLICY demo_storage_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'demo-profils'::text) AND public.is_admin()));

DROP POLICY IF EXISTS demo_storage_update_admin ON storage.objects;
CREATE POLICY demo_storage_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (((bucket_id = 'demo-profils'::text) AND public.is_admin()))
  WITH CHECK (((bucket_id = 'demo-profils'::text) AND public.is_admin()));

DROP POLICY IF EXISTS photos_storage_delete_own ON storage.objects;
CREATE POLICY photos_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

DROP POLICY IF EXISTS photos_storage_insert_own ON storage.objects;
CREATE POLICY photos_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'photos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS photos_storage_select ON storage.objects;
CREATE POLICY photos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'photos'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin() OR (public.can_browse_profiles() AND (EXISTS ( SELECT 1
   FROM public.photos p
  WHERE ((p.storage_path = objects.name) AND (p.status = 'approved'::public.photo_status) AND (NOT public.is_blocked_between(auth.uid(), p.user_id)) AND public.is_discoverable_profile(p.user_id))))))));

DROP POLICY IF EXISTS verifications_storage_delete ON storage.objects;
CREATE POLICY verifications_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'verifications'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

DROP POLICY IF EXISTS verifications_storage_insert_own ON storage.objects;
CREATE POLICY verifications_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'verifications'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));

DROP POLICY IF EXISTS verifications_storage_select ON storage.objects;
CREATE POLICY verifications_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'verifications'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_admin())));

DROP POLICY IF EXISTS voice_storage_delete_own ON storage.objects;
CREATE POLICY voice_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (((bucket_id = 'voice-messages'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));

DROP POLICY IF EXISTS voice_storage_insert_premium ON storage.objects;
CREATE POLICY voice_storage_insert_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'voice-messages'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND public.is_conversation_folder_participant((storage.foldername(name))[1]) AND public.is_premium(auth.uid())));

DROP POLICY IF EXISTS voice_storage_select_participant ON storage.objects;
CREATE POLICY voice_storage_select_participant ON storage.objects
  FOR SELECT TO authenticated
  USING (((bucket_id = 'voice-messages'::text) AND (public.is_conversation_folder_participant((storage.foldername(name))[1]) OR public.is_admin())));

-- ============================================================================
-- 17. Temps réel : nouveaux messages affichés sans recharger la page
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages')
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ============================================================================
-- 18. Tâches automatiques (pg_cron, si Supabase le permet ; sinon les dates suffisent)
-- ============================================================================

-- Toutes les 5 minutes : fin des déblocages de conversation.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-expirer-deblocages';
    PERFORM cron.schedule(
      'yona-expirer-deblocages',
      '*/5 * * * *',
      'select public.expire_conversation_unlocks()'
    );
  ELSE
    RAISE NOTICE 'pg_cron indisponible : expiration par date seulement (statut mis à jour par appel externe).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : expiration par date seulement.', SQLERRM;
END;
$cron$;

-- Toutes les 5 minutes : fin des abonnements Premium.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-expirer-abonnements';
    PERFORM cron.schedule('yona-expirer-abonnements', '*/5 * * * *',
      'select public.expire_subscriptions()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : expiration des abonnements par date seulement.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : expiration par date seulement.', SQLERRM;
END;
$cron$;

-- Chaque nuit : IP et appareils effacés du journal après 12 mois (RGPD).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-purge-journaux';
    PERFORM cron.schedule('yona-purge-journaux', '17 3 * * *', 'select public.purge_old_logs()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : purge des journaux à lancer par le serveur.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : purge à lancer par le serveur.', SQLERRM;
END;
$cron$;

-- Toutes les 15 minutes : images de vérification supprimées (tentatives abandonnées, délai écoulé).
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-verifications-fichiers';
    PERFORM cron.schedule('yona-verifications-fichiers', '*/15 * * * *', 'select public.purge_verification_files()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : nettoyage des vérifications à lancer par le serveur.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : nettoyage à lancer par le serveur.', SQLERRM;
END;
$cron$;

-- ============================================================================
-- 19. Données de départ : réglages (publicités, vérification d'identité) et fuseaux horaires
-- ============================================================================

-- Valeurs par défaut, modifiables ensuite dans /admin. Une ligne déjà présente
-- (réglages changés par l'administrateur) est gardée telle quelle.
INSERT INTO public.ad_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.verification_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.geo_timezones (tz, country_codes) VALUES
  ('Africa/Abidjan', ARRAY['BF', 'CI', 'GH', 'GM', 'GN', 'IS', 'ML', 'MR', 'SH', 'SL', 'SN', 'TG']),
  ('Africa/Accra', ARRAY['GH']),
  ('Africa/Addis_Ababa', ARRAY['ET']),
  ('Africa/Algiers', ARRAY['DZ']),
  ('Africa/Asmara', ARRAY['ER']),
  ('Africa/Asmera', ARRAY['ER']),
  ('Africa/Bamako', ARRAY['ML']),
  ('Africa/Bangui', ARRAY['CF']),
  ('Africa/Banjul', ARRAY['GM']),
  ('Africa/Bissau', ARRAY['GW']),
  ('Africa/Blantyre', ARRAY['MW']),
  ('Africa/Brazzaville', ARRAY['CG']),
  ('Africa/Bujumbura', ARRAY['BI']),
  ('Africa/Cairo', ARRAY['EG']),
  ('Africa/Casablanca', ARRAY['MA']),
  ('Africa/Ceuta', ARRAY['ES']),
  ('Africa/Conakry', ARRAY['GN']),
  ('Africa/Dakar', ARRAY['SN']),
  ('Africa/Dar_es_Salaam', ARRAY['TZ']),
  ('Africa/Djibouti', ARRAY['DJ']),
  ('Africa/Douala', ARRAY['CM']),
  ('Africa/El_Aaiun', ARRAY['EH']),
  ('Africa/Freetown', ARRAY['SL']),
  ('Africa/Gaborone', ARRAY['BW']),
  ('Africa/Harare', ARRAY['ZW']),
  ('Africa/Johannesburg', ARRAY['LS', 'SZ', 'ZA']),
  ('Africa/Juba', ARRAY['SS']),
  ('Africa/Kampala', ARRAY['UG']),
  ('Africa/Khartoum', ARRAY['SD']),
  ('Africa/Kigali', ARRAY['RW']),
  ('Africa/Kinshasa', ARRAY['CD']),
  ('Africa/Lagos', ARRAY['AO', 'BJ', 'CD', 'CF', 'CG', 'CM', 'GA', 'GQ', 'NE', 'NG']),
  ('Africa/Libreville', ARRAY['GA']),
  ('Africa/Lome', ARRAY['TG']),
  ('Africa/Luanda', ARRAY['AO']),
  ('Africa/Lubumbashi', ARRAY['CD']),
  ('Africa/Lusaka', ARRAY['ZM']),
  ('Africa/Malabo', ARRAY['GQ']),
  ('Africa/Maputo', ARRAY['BI', 'BW', 'CD', 'MW', 'MZ', 'RW', 'ZM', 'ZW']),
  ('Africa/Maseru', ARRAY['LS']),
  ('Africa/Mbabane', ARRAY['SZ']),
  ('Africa/Mogadishu', ARRAY['SO']),
  ('Africa/Monrovia', ARRAY['LR']),
  ('Africa/Nairobi', ARRAY['DJ', 'ER', 'ET', 'KE', 'KM', 'MG', 'SO', 'TZ', 'UG', 'YT']),
  ('Africa/Ndjamena', ARRAY['TD']),
  ('Africa/Niamey', ARRAY['NE']),
  ('Africa/Nouakchott', ARRAY['MR']),
  ('Africa/Ouagadougou', ARRAY['BF']),
  ('Africa/Porto-Novo', ARRAY['BJ']),
  ('Africa/Sao_Tome', ARRAY['ST']),
  ('Africa/Timbuktu', ARRAY['ML']),
  ('Africa/Tripoli', ARRAY['LY']),
  ('Africa/Tunis', ARRAY['TN']),
  ('Africa/Windhoek', ARRAY['NA']),
  ('America/Adak', ARRAY['US']),
  ('America/Anchorage', ARRAY['US']),
  ('America/Anguilla', ARRAY['AI']),
  ('America/Antigua', ARRAY['AG']),
  ('America/Araguaina', ARRAY['BR']),
  ('America/Argentina/Buenos_Aires', ARRAY['AR']),
  ('America/Argentina/Catamarca', ARRAY['AR']),
  ('America/Argentina/ComodRivadavia', ARRAY['AR']),
  ('America/Argentina/Cordoba', ARRAY['AR']),
  ('America/Argentina/Jujuy', ARRAY['AR']),
  ('America/Argentina/La_Rioja', ARRAY['AR']),
  ('America/Argentina/Mendoza', ARRAY['AR']),
  ('America/Argentina/Rio_Gallegos', ARRAY['AR']),
  ('America/Argentina/Salta', ARRAY['AR']),
  ('America/Argentina/San_Juan', ARRAY['AR']),
  ('America/Argentina/San_Luis', ARRAY['AR']),
  ('America/Argentina/Tucuman', ARRAY['AR']),
  ('America/Argentina/Ushuaia', ARRAY['AR']),
  ('America/Aruba', ARRAY['AW']),
  ('America/Asuncion', ARRAY['PY']),
  ('America/Atikokan', ARRAY['CA']),
  ('America/Atka', ARRAY['US']),
  ('America/Bahia', ARRAY['BR']),
  ('America/Bahia_Banderas', ARRAY['MX']),
  ('America/Barbados', ARRAY['BB']),
  ('America/Belem', ARRAY['BR']),
  ('America/Belize', ARRAY['BZ']),
  ('America/Blanc-Sablon', ARRAY['CA']),
  ('America/Boa_Vista', ARRAY['BR']),
  ('America/Bogota', ARRAY['CO']),
  ('America/Boise', ARRAY['US']),
  ('America/Buenos_Aires', ARRAY['AR']),
  ('America/Cambridge_Bay', ARRAY['CA']),
  ('America/Campo_Grande', ARRAY['BR']),
  ('America/Cancun', ARRAY['MX']),
  ('America/Caracas', ARRAY['VE']),
  ('America/Catamarca', ARRAY['AR']),
  ('America/Cayenne', ARRAY['GF']),
  ('America/Cayman', ARRAY['KY']),
  ('America/Chicago', ARRAY['US']),
  ('America/Chihuahua', ARRAY['MX']),
  ('America/Ciudad_Juarez', ARRAY['MX']),
  ('America/Coral_Harbour', ARRAY['CA']),
  ('America/Cordoba', ARRAY['AR']),
  ('America/Costa_Rica', ARRAY['CR']),
  ('America/Coyhaique', ARRAY['CL']),
  ('America/Creston', ARRAY['CA']),
  ('America/Cuiaba', ARRAY['BR']),
  ('America/Curacao', ARRAY['CW']),
  ('America/Danmarkshavn', ARRAY['GL']),
  ('America/Dawson', ARRAY['CA']),
  ('America/Dawson_Creek', ARRAY['CA']),
  ('America/Denver', ARRAY['US']),
  ('America/Detroit', ARRAY['US']),
  ('America/Dominica', ARRAY['DM']),
  ('America/Edmonton', ARRAY['CA']),
  ('America/Eirunepe', ARRAY['BR']),
  ('America/El_Salvador', ARRAY['SV']),
  ('America/Ensenada', ARRAY['MX']),
  ('America/Fort_Nelson', ARRAY['CA']),
  ('America/Fort_Wayne', ARRAY['US']),
  ('America/Fortaleza', ARRAY['BR']),
  ('America/Glace_Bay', ARRAY['CA']),
  ('America/Godthab', ARRAY['GL']),
  ('America/Goose_Bay', ARRAY['CA']),
  ('America/Grand_Turk', ARRAY['TC']),
  ('America/Grenada', ARRAY['GD']),
  ('America/Guadeloupe', ARRAY['GP']),
  ('America/Guatemala', ARRAY['GT']),
  ('America/Guayaquil', ARRAY['EC']),
  ('America/Guyana', ARRAY['GY']),
  ('America/Halifax', ARRAY['CA']),
  ('America/Havana', ARRAY['CU']),
  ('America/Hermosillo', ARRAY['MX']),
  ('America/Indiana/Indianapolis', ARRAY['US']),
  ('America/Indiana/Knox', ARRAY['US']),
  ('America/Indiana/Marengo', ARRAY['US']),
  ('America/Indiana/Petersburg', ARRAY['US']),
  ('America/Indiana/Tell_City', ARRAY['US']),
  ('America/Indiana/Vevay', ARRAY['US']),
  ('America/Indiana/Vincennes', ARRAY['US']),
  ('America/Indiana/Winamac', ARRAY['US']),
  ('America/Indianapolis', ARRAY['US']),
  ('America/Inuvik', ARRAY['CA']),
  ('America/Iqaluit', ARRAY['CA']),
  ('America/Jamaica', ARRAY['JM']),
  ('America/Jujuy', ARRAY['AR']),
  ('America/Juneau', ARRAY['US']),
  ('America/Kentucky/Louisville', ARRAY['US']),
  ('America/Kentucky/Monticello', ARRAY['US']),
  ('America/Knox_IN', ARRAY['US']),
  ('America/Kralendijk', ARRAY['BQ', 'CW']),
  ('America/La_Paz', ARRAY['BO']),
  ('America/Lima', ARRAY['PE']),
  ('America/Los_Angeles', ARRAY['US']),
  ('America/Louisville', ARRAY['US']),
  ('America/Lower_Princes', ARRAY['CW', 'SX']),
  ('America/Maceio', ARRAY['BR']),
  ('America/Managua', ARRAY['NI']),
  ('America/Manaus', ARRAY['BR']),
  ('America/Marigot', ARRAY['MF', 'TT']),
  ('America/Martinique', ARRAY['MQ']),
  ('America/Matamoros', ARRAY['MX']),
  ('America/Mazatlan', ARRAY['MX']),
  ('America/Mendoza', ARRAY['AR']),
  ('America/Menominee', ARRAY['US']),
  ('America/Merida', ARRAY['MX']),
  ('America/Metlakatla', ARRAY['US']),
  ('America/Mexico_City', ARRAY['MX']),
  ('America/Miquelon', ARRAY['PM']),
  ('America/Moncton', ARRAY['CA']),
  ('America/Monterrey', ARRAY['MX']),
  ('America/Montevideo', ARRAY['UY']),
  ('America/Montreal', ARRAY['BS', 'CA']),
  ('America/Montserrat', ARRAY['MS']),
  ('America/Nassau', ARRAY['BS']),
  ('America/New_York', ARRAY['US']),
  ('America/Nipigon', ARRAY['BS', 'CA']),
  ('America/Nome', ARRAY['US']),
  ('America/Noronha', ARRAY['BR']),
  ('America/North_Dakota/Beulah', ARRAY['US']),
  ('America/North_Dakota/Center', ARRAY['US']),
  ('America/North_Dakota/New_Salem', ARRAY['US']),
  ('America/Nuuk', ARRAY['GL']),
  ('America/Ojinaga', ARRAY['MX']),
  ('America/Panama', ARRAY['CA', 'KY', 'PA']),
  ('America/Pangnirtung', ARRAY['CA']),
  ('America/Paramaribo', ARRAY['SR']),
  ('America/Phoenix', ARRAY['CA', 'US']),
  ('America/Port_of_Spain', ARRAY['TT']),
  ('America/Port-au-Prince', ARRAY['HT']),
  ('America/Porto_Acre', ARRAY['BR']),
  ('America/Porto_Velho', ARRAY['BR']),
  ('America/Puerto_Rico', ARRAY['AG', 'AI', 'AW', 'BL', 'BQ', 'CA', 'CW', 'DM', 'GD', 'GP', 'KN', 'LC', 'MF', 'MS', 'PR', 'SX', 'TT', 'VC', 'VG', 'VI']),
  ('America/Punta_Arenas', ARRAY['CL']),
  ('America/Rainy_River', ARRAY['CA']),
  ('America/Rankin_Inlet', ARRAY['CA']),
  ('America/Recife', ARRAY['BR']),
  ('America/Regina', ARRAY['CA']),
  ('America/Resolute', ARRAY['CA']),
  ('America/Rio_Branco', ARRAY['BR']),
  ('America/Rosario', ARRAY['AR']),
  ('America/Santa_Isabel', ARRAY['MX']),
  ('America/Santarem', ARRAY['BR']),
  ('America/Santiago', ARRAY['CL']),
  ('America/Santo_Domingo', ARRAY['DO']),
  ('America/Sao_Paulo', ARRAY['BR']),
  ('America/Scoresbysund', ARRAY['GL']),
  ('America/Shiprock', ARRAY['US']),
  ('America/Sitka', ARRAY['US']),
  ('America/St_Barthelemy', ARRAY['BL', 'TT']),
  ('America/St_Johns', ARRAY['CA']),
  ('America/St_Kitts', ARRAY['KN']),
  ('America/St_Lucia', ARRAY['LC']),
  ('America/St_Thomas', ARRAY['VI']),
  ('America/St_Vincent', ARRAY['VC']),
  ('America/Swift_Current', ARRAY['CA']),
  ('America/Tegucigalpa', ARRAY['HN']),
  ('America/Thule', ARRAY['GL']),
  ('America/Thunder_Bay', ARRAY['BS', 'CA']),
  ('America/Tijuana', ARRAY['MX']),
  ('America/Toronto', ARRAY['BS', 'CA']),
  ('America/Tortola', ARRAY['VG']),
  ('America/Vancouver', ARRAY['CA']),
  ('America/Virgin', ARRAY['VI']),
  ('America/Whitehorse', ARRAY['CA']),
  ('America/Winnipeg', ARRAY['CA']),
  ('America/Yakutat', ARRAY['US']),
  ('America/Yellowknife', ARRAY['CA']),
  ('Antarctica/Casey', ARRAY['AQ']),
  ('Antarctica/Davis', ARRAY['AQ']),
  ('Antarctica/DumontDUrville', ARRAY['AQ']),
  ('Antarctica/Macquarie', ARRAY['AU']),
  ('Antarctica/Mawson', ARRAY['AQ']),
  ('Antarctica/McMurdo', ARRAY['AQ']),
  ('Antarctica/Palmer', ARRAY['AQ']),
  ('Antarctica/Rothera', ARRAY['AQ']),
  ('Antarctica/South_Pole', ARRAY['AQ']),
  ('Antarctica/Syowa', ARRAY['AQ']),
  ('Antarctica/Troll', ARRAY['AQ']),
  ('Antarctica/Vostok', ARRAY['AQ']),
  ('Arctic/Longyearbyen', ARRAY['NO', 'SJ']),
  ('Asia/Aden', ARRAY['YE']),
  ('Asia/Almaty', ARRAY['KZ']),
  ('Asia/Amman', ARRAY['JO']),
  ('Asia/Anadyr', ARRAY['RU']),
  ('Asia/Aqtau', ARRAY['KZ']),
  ('Asia/Aqtobe', ARRAY['KZ']),
  ('Asia/Ashgabat', ARRAY['TM']),
  ('Asia/Ashkhabad', ARRAY['TM']),
  ('Asia/Atyrau', ARRAY['KZ']),
  ('Asia/Baghdad', ARRAY['IQ']),
  ('Asia/Bahrain', ARRAY['BH']),
  ('Asia/Baku', ARRAY['AZ']),
  ('Asia/Bangkok', ARRAY['CX', 'KH', 'LA', 'TH', 'VN']),
  ('Asia/Barnaul', ARRAY['RU']),
  ('Asia/Beirut', ARRAY['LB']),
  ('Asia/Bishkek', ARRAY['KG']),
  ('Asia/Brunei', ARRAY['BN']),
  ('Asia/Calcutta', ARRAY['IN']),
  ('Asia/Chita', ARRAY['RU']),
  ('Asia/Choibalsan', ARRAY['MN']),
  ('Asia/Chongqing', ARRAY['CN']),
  ('Asia/Chungking', ARRAY['CN']),
  ('Asia/Colombo', ARRAY['LK']),
  ('Asia/Dacca', ARRAY['BD']),
  ('Asia/Damascus', ARRAY['SY']),
  ('Asia/Dhaka', ARRAY['BD']),
  ('Asia/Dili', ARRAY['TL']),
  ('Asia/Dubai', ARRAY['AE', 'OM', 'RE', 'SC', 'TF']),
  ('Asia/Dushanbe', ARRAY['TJ']),
  ('Asia/Famagusta', ARRAY['CY']),
  ('Asia/Gaza', ARRAY['PS']),
  ('Asia/Harbin', ARRAY['CN']),
  ('Asia/Hebron', ARRAY['PS']),
  ('Asia/Ho_Chi_Minh', ARRAY['VN']),
  ('Asia/Hong_Kong', ARRAY['HK']),
  ('Asia/Hovd', ARRAY['MN']),
  ('Asia/Irkutsk', ARRAY['RU']),
  ('Asia/Istanbul', ARRAY['TR']),
  ('Asia/Jakarta', ARRAY['ID']),
  ('Asia/Jayapura', ARRAY['ID']),
  ('Asia/Jerusalem', ARRAY['IL']),
  ('Asia/Kabul', ARRAY['AF']),
  ('Asia/Kamchatka', ARRAY['RU']),
  ('Asia/Karachi', ARRAY['PK']),
  ('Asia/Kashgar', ARRAY['CN']),
  ('Asia/Kathmandu', ARRAY['NP']),
  ('Asia/Katmandu', ARRAY['NP']),
  ('Asia/Khandyga', ARRAY['RU']),
  ('Asia/Kolkata', ARRAY['IN']),
  ('Asia/Krasnoyarsk', ARRAY['RU']),
  ('Asia/Kuala_Lumpur', ARRAY['MY']),
  ('Asia/Kuching', ARRAY['BN', 'MY']),
  ('Asia/Kuwait', ARRAY['KW']),
  ('Asia/Macao', ARRAY['MO']),
  ('Asia/Macau', ARRAY['MO']),
  ('Asia/Magadan', ARRAY['RU']),
  ('Asia/Makassar', ARRAY['ID']),
  ('Asia/Manila', ARRAY['PH']),
  ('Asia/Muscat', ARRAY['OM']),
  ('Asia/Nicosia', ARRAY['CY']),
  ('Asia/Novokuznetsk', ARRAY['RU']),
  ('Asia/Novosibirsk', ARRAY['RU']),
  ('Asia/Omsk', ARRAY['RU']),
  ('Asia/Oral', ARRAY['KZ']),
  ('Asia/Phnom_Penh', ARRAY['KH']),
  ('Asia/Pontianak', ARRAY['ID']),
  ('Asia/Pyongyang', ARRAY['KP']),
  ('Asia/Qatar', ARRAY['BH', 'QA']),
  ('Asia/Qostanay', ARRAY['KZ']),
  ('Asia/Qyzylorda', ARRAY['KZ']),
  ('Asia/Rangoon', ARRAY['CC', 'MM']),
  ('Asia/Riyadh', ARRAY['AQ', 'KW', 'SA', 'YE']),
  ('Asia/Saigon', ARRAY['VN']),
  ('Asia/Sakhalin', ARRAY['RU']),
  ('Asia/Samarkand', ARRAY['UZ']),
  ('Asia/Seoul', ARRAY['KR']),
  ('Asia/Shanghai', ARRAY['CN']),
  ('Asia/Singapore', ARRAY['AQ', 'MY', 'SG']),
  ('Asia/Srednekolymsk', ARRAY['RU']),
  ('Asia/Taipei', ARRAY['TW']),
  ('Asia/Tashkent', ARRAY['UZ']),
  ('Asia/Tbilisi', ARRAY['GE']),
  ('Asia/Tehran', ARRAY['IR']),
  ('Asia/Tel_Aviv', ARRAY['IL']),
  ('Asia/Thimbu', ARRAY['BT']),
  ('Asia/Thimphu', ARRAY['BT']),
  ('Asia/Tokyo', ARRAY['AU', 'JP']),
  ('Asia/Tomsk', ARRAY['RU']),
  ('Asia/Ujung_Pandang', ARRAY['ID']),
  ('Asia/Ulaanbaatar', ARRAY['MN']),
  ('Asia/Ulan_Bator', ARRAY['MN']),
  ('Asia/Urumqi', ARRAY['CN']),
  ('Asia/Ust-Nera', ARRAY['RU']),
  ('Asia/Vientiane', ARRAY['LA']),
  ('Asia/Vladivostok', ARRAY['RU']),
  ('Asia/Yakutsk', ARRAY['RU']),
  ('Asia/Yangon', ARRAY['CC', 'MM']),
  ('Asia/Yekaterinburg', ARRAY['RU']),
  ('Asia/Yerevan', ARRAY['AM']),
  ('Atlantic/Azores', ARRAY['PT']),
  ('Atlantic/Bermuda', ARRAY['BM']),
  ('Atlantic/Canary', ARRAY['ES']),
  ('Atlantic/Cape_Verde', ARRAY['CV']),
  ('Atlantic/Faeroe', ARRAY['FO']),
  ('Atlantic/Faroe', ARRAY['FO']),
  ('Atlantic/Jan_Mayen', ARRAY['NO']),
  ('Atlantic/Madeira', ARRAY['PT']),
  ('Atlantic/Reykjavik', ARRAY['IS']),
  ('Atlantic/South_Georgia', ARRAY['GS']),
  ('Atlantic/St_Helena', ARRAY['SH']),
  ('Atlantic/Stanley', ARRAY['FK']),
  ('Australia/ACT', ARRAY['AU']),
  ('Australia/Adelaide', ARRAY['AU']),
  ('Australia/Brisbane', ARRAY['AU']),
  ('Australia/Broken_Hill', ARRAY['AU']),
  ('Australia/Canberra', ARRAY['AU']),
  ('Australia/Currie', ARRAY['AU']),
  ('Australia/Darwin', ARRAY['AU']),
  ('Australia/Eucla', ARRAY['AU']),
  ('Australia/Hobart', ARRAY['AU']),
  ('Australia/LHI', ARRAY['AU']),
  ('Australia/Lindeman', ARRAY['AU']),
  ('Australia/Lord_Howe', ARRAY['AU']),
  ('Australia/Melbourne', ARRAY['AU']),
  ('Australia/North', ARRAY['AU']),
  ('Australia/NSW', ARRAY['AU']),
  ('Australia/Perth', ARRAY['AU']),
  ('Australia/Queensland', ARRAY['AU']),
  ('Australia/South', ARRAY['AU']),
  ('Australia/Sydney', ARRAY['AU']),
  ('Australia/Tasmania', ARRAY['AU']),
  ('Australia/Victoria', ARRAY['AU']),
  ('Australia/West', ARRAY['AU']),
  ('Australia/Yancowinna', ARRAY['AU']),
  ('Brazil/Acre', ARRAY['BR']),
  ('Brazil/DeNoronha', ARRAY['BR']),
  ('Brazil/East', ARRAY['BR']),
  ('Brazil/West', ARRAY['BR']),
  ('Canada/Atlantic', ARRAY['CA']),
  ('Canada/Central', ARRAY['CA']),
  ('Canada/Eastern', ARRAY['BS', 'CA']),
  ('Canada/Mountain', ARRAY['CA']),
  ('Canada/Newfoundland', ARRAY['CA']),
  ('Canada/Pacific', ARRAY['CA']),
  ('Canada/Saskatchewan', ARRAY['CA']),
  ('Canada/Yukon', ARRAY['CA']),
  ('Chile/Continental', ARRAY['CL']),
  ('Chile/EasterIsland', ARRAY['CL']),
  ('Cuba', ARRAY['CU']),
  ('Egypt', ARRAY['EG']),
  ('Eire', ARRAY['IE']),
  ('Europe/Amsterdam', ARRAY['NL']),
  ('Europe/Andorra', ARRAY['AD']),
  ('Europe/Astrakhan', ARRAY['RU']),
  ('Europe/Athens', ARRAY['GR']),
  ('Europe/Belfast', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Europe/Belgrade', ARRAY['BA', 'HR', 'ME', 'MK', 'RS', 'SI']),
  ('Europe/Berlin', ARRAY['DE', 'DK', 'NO', 'SE', 'SJ']),
  ('Europe/Bratislava', ARRAY['CZ', 'SK']),
  ('Europe/Brussels', ARRAY['BE', 'LU', 'NL']),
  ('Europe/Bucharest', ARRAY['RO']),
  ('Europe/Budapest', ARRAY['HU']),
  ('Europe/Busingen', ARRAY['CH', 'DE', 'LI']),
  ('Europe/Chisinau', ARRAY['MD']),
  ('Europe/Copenhagen', ARRAY['DK']),
  ('Europe/Dublin', ARRAY['IE']),
  ('Europe/Gibraltar', ARRAY['GI']),
  ('Europe/Guernsey', ARRAY['GG']),
  ('Europe/Helsinki', ARRAY['AX', 'FI']),
  ('Europe/Isle_of_Man', ARRAY['IM']),
  ('Europe/Istanbul', ARRAY['TR']),
  ('Europe/Jersey', ARRAY['JE']),
  ('Europe/Kaliningrad', ARRAY['RU']),
  ('Europe/Kiev', ARRAY['UA']),
  ('Europe/Kirov', ARRAY['RU']),
  ('Europe/Kyiv', ARRAY['UA']),
  ('Europe/Lisbon', ARRAY['PT']),
  ('Europe/Ljubljana', ARRAY['SI']),
  ('Europe/London', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Europe/Luxembourg', ARRAY['LU']),
  ('Europe/Madrid', ARRAY['ES']),
  ('Europe/Malta', ARRAY['MT']),
  ('Europe/Mariehamn', ARRAY['AX', 'FI']),
  ('Europe/Minsk', ARRAY['BY']),
  ('Europe/Monaco', ARRAY['MC']),
  ('Europe/Moscow', ARRAY['RU']),
  ('Europe/Nicosia', ARRAY['CY']),
  ('Europe/Oslo', ARRAY['NO']),
  ('Europe/Paris', ARRAY['FR', 'MC']),
  ('Europe/Podgorica', ARRAY['BA', 'HR', 'ME', 'MK', 'RS', 'SI']),
  ('Europe/Prague', ARRAY['CZ', 'SK']),
  ('Europe/Riga', ARRAY['LV']),
  ('Europe/Rome', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Samara', ARRAY['RU']),
  ('Europe/San_Marino', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Sarajevo', ARRAY['BA']),
  ('Europe/Saratov', ARRAY['RU']),
  ('Europe/Simferopol', ARRAY['RU', 'UA']),
  ('Europe/Skopje', ARRAY['MK']),
  ('Europe/Sofia', ARRAY['BG']),
  ('Europe/Stockholm', ARRAY['SE']),
  ('Europe/Tallinn', ARRAY['EE']),
  ('Europe/Tirane', ARRAY['AL']),
  ('Europe/Tiraspol', ARRAY['MD']),
  ('Europe/Ulyanovsk', ARRAY['RU']),
  ('Europe/Uzhgorod', ARRAY['UA']),
  ('Europe/Vaduz', ARRAY['LI']),
  ('Europe/Vatican', ARRAY['IT', 'SM', 'VA']),
  ('Europe/Vienna', ARRAY['AT']),
  ('Europe/Vilnius', ARRAY['LT']),
  ('Europe/Volgograd', ARRAY['RU']),
  ('Europe/Warsaw', ARRAY['PL']),
  ('Europe/Zagreb', ARRAY['HR']),
  ('Europe/Zaporozhye', ARRAY['UA']),
  ('Europe/Zurich', ARRAY['CH', 'DE', 'LI']),
  ('GB', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('GB-Eire', ARRAY['GB', 'GG', 'IM', 'JE']),
  ('Hongkong', ARRAY['HK']),
  ('Iceland', ARRAY['IS']),
  ('Indian/Antananarivo', ARRAY['MG']),
  ('Indian/Chagos', ARRAY['IO']),
  ('Indian/Christmas', ARRAY['CX']),
  ('Indian/Cocos', ARRAY['CC']),
  ('Indian/Comoro', ARRAY['KM']),
  ('Indian/Kerguelen', ARRAY['TF']),
  ('Indian/Mahe', ARRAY['SC']),
  ('Indian/Maldives', ARRAY['MV', 'TF']),
  ('Indian/Mauritius', ARRAY['MU']),
  ('Indian/Mayotte', ARRAY['YT']),
  ('Indian/Reunion', ARRAY['RE']),
  ('Iran', ARRAY['IR']),
  ('Israel', ARRAY['IL']),
  ('Jamaica', ARRAY['JM']),
  ('Japan', ARRAY['AU', 'JP']),
  ('Kwajalein', ARRAY['MH']),
  ('Libya', ARRAY['LY']),
  ('Mexico/BajaNorte', ARRAY['MX']),
  ('Mexico/BajaSur', ARRAY['MX']),
  ('Mexico/General', ARRAY['MX']),
  ('Navajo', ARRAY['US']),
  ('NZ', ARRAY['AQ', 'NZ']),
  ('NZ-CHAT', ARRAY['NZ']),
  ('Pacific/Apia', ARRAY['WS']),
  ('Pacific/Auckland', ARRAY['AQ', 'NZ']),
  ('Pacific/Bougainville', ARRAY['PG']),
  ('Pacific/Chatham', ARRAY['NZ']),
  ('Pacific/Chuuk', ARRAY['FM']),
  ('Pacific/Easter', ARRAY['CL']),
  ('Pacific/Efate', ARRAY['VU']),
  ('Pacific/Enderbury', ARRAY['KI']),
  ('Pacific/Fakaofo', ARRAY['TK']),
  ('Pacific/Fiji', ARRAY['FJ']),
  ('Pacific/Funafuti', ARRAY['TV']),
  ('Pacific/Galapagos', ARRAY['EC']),
  ('Pacific/Gambier', ARRAY['PF']),
  ('Pacific/Guadalcanal', ARRAY['FM', 'SB']),
  ('Pacific/Guam', ARRAY['GU', 'MP']),
  ('Pacific/Honolulu', ARRAY['US']),
  ('Pacific/Johnston', ARRAY['US']),
  ('Pacific/Kanton', ARRAY['KI']),
  ('Pacific/Kiritimati', ARRAY['KI']),
  ('Pacific/Kosrae', ARRAY['FM']),
  ('Pacific/Kwajalein', ARRAY['MH']),
  ('Pacific/Majuro', ARRAY['MH']),
  ('Pacific/Marquesas', ARRAY['PF']),
  ('Pacific/Midway', ARRAY['UM']),
  ('Pacific/Nauru', ARRAY['NR']),
  ('Pacific/Niue', ARRAY['NU']),
  ('Pacific/Norfolk', ARRAY['NF']),
  ('Pacific/Noumea', ARRAY['NC']),
  ('Pacific/Pago_Pago', ARRAY['AS', 'UM']),
  ('Pacific/Palau', ARRAY['PW']),
  ('Pacific/Pitcairn', ARRAY['PN']),
  ('Pacific/Pohnpei', ARRAY['FM']),
  ('Pacific/Ponape', ARRAY['FM']),
  ('Pacific/Port_Moresby', ARRAY['AQ', 'FM', 'PG']),
  ('Pacific/Rarotonga', ARRAY['CK']),
  ('Pacific/Saipan', ARRAY['MP']),
  ('Pacific/Samoa', ARRAY['AS', 'UM']),
  ('Pacific/Tahiti', ARRAY['PF']),
  ('Pacific/Tarawa', ARRAY['KI', 'MH', 'TV', 'UM', 'WF']),
  ('Pacific/Tongatapu', ARRAY['TO']),
  ('Pacific/Truk', ARRAY['FM']),
  ('Pacific/Wake', ARRAY['UM']),
  ('Pacific/Wallis', ARRAY['WF']),
  ('Pacific/Yap', ARRAY['FM']),
  ('Poland', ARRAY['PL']),
  ('Portugal', ARRAY['PT']),
  ('PRC', ARRAY['CN']),
  ('ROC', ARRAY['TW']),
  ('ROK', ARRAY['KR']),
  ('Singapore', ARRAY['AQ', 'MY', 'SG']),
  ('Turkey', ARRAY['TR']),
  ('US/Alaska', ARRAY['US']),
  ('US/Aleutian', ARRAY['US']),
  ('US/Arizona', ARRAY['CA', 'US']),
  ('US/Central', ARRAY['US']),
  ('US/East-Indiana', ARRAY['US']),
  ('US/Eastern', ARRAY['US']),
  ('US/Hawaii', ARRAY['US']),
  ('US/Indiana-Starke', ARRAY['US']),
  ('US/Michigan', ARRAY['US']),
  ('US/Mountain', ARRAY['US']),
  ('US/Pacific', ARRAY['US']),
  ('US/Samoa', ARRAY['AS', 'UM']),
  ('W-SU', ARRAY['RU'])
ON CONFLICT (tz) DO UPDATE SET country_codes = EXCLUDED.country_codes;

-- ============================================================================
-- 20. Données de départ : 247 pays (position, pour le pays le plus proche)
-- ============================================================================

INSERT INTO public.geo_countries (code, name, lat, lng) VALUES
  ('AF', 'Afghanistan', 34.64, 67.55),
  ('ZA', 'Afrique du Sud', -28.59, 27.24),
  ('AL', 'Albanie', 41.1, 20.01),
  ('DZ', 'Algérie', 34.84, 3.3),
  ('DE', 'Allemagne', 50.65, 10.18),
  ('AD', 'Andorre', 42.53, 1.55),
  ('AO', 'Angola', -10.9, 15.97),
  ('AI', 'Anguilla', 18.21, -63.06),
  ('AG', 'Antigua-et-Barbuda', 17.14, -61.8),
  ('SA', 'Arabie saoudite', 23.86, 44.13),
  ('AR', 'Argentine', -32.06, -62.61),
  ('AM', 'Arménie', 40.31, 44.57),
  ('AW', 'Aruba', 12.52, -70),
  ('AU', 'Australie', -32.28, 144.13),
  ('AT', 'Autriche', 47.62, 14.38),
  ('AZ', 'Azerbaïdjan', 40.35, 47.71),
  ('BS', 'Bahamas', 24.76, -76.52),
  ('BH', 'Bahreïn', 26.17, 50.55),
  ('BD', 'Bangladesh', 23.69, 90.26),
  ('BB', 'Barbade', 13.18, -59.57),
  ('BE', 'Belgique', 50.74, 4.52),
  ('BZ', 'Belize', 17.49, -88.58),
  ('BJ', 'Bénin', 8.09, 2.23),
  ('BM', 'Bermudes', 32.31, -64.77),
  ('BT', 'Bhoutan', 27.29, 90.27),
  ('BY', 'Biélorussie', 53.57, 27.82),
  ('BO', 'Bolivie', -17.52, -65.46),
  ('BA', 'Bosnie-Herzégovine', 44.36, 17.83),
  ('BW', 'Botswana', -22.93, 25.8),
  ('BR', 'Brésil', -16.49, -46.3),
  ('BN', 'Brunei', 4.85, 114.81),
  ('BG', 'Bulgarie', 42.8, 25.14),
  ('BF', 'Burkina Faso', 12.31, -1.63),
  ('BI', 'Burundi', -3.36, 29.78),
  ('KH', 'Cambodge', 12.18, 104.71),
  ('CM', 'Cameroun', 5.75, 11.54),
  ('CA', 'Canada', 48.24, -91.4),
  ('CV', 'Cap-Vert', 15.7, -23.9),
  ('CF', 'Centrafrique', 5.68, 18.99),
  ('CL', 'Chili', -35.27, -71.82),
  ('CN', 'Chine', 32.44, 110.25),
  ('CY', 'Chypre', 34.98, 33.24),
  ('CO', 'Colombie', 5.69, -74.76),
  ('KM', 'Comores', -11.95, 43.86),
  ('CG', 'Congo-Brazzaville', -1.98, 14.64),
  ('KP', 'Corée du Nord', 40.17, 127.23),
  ('KR', 'Corée du Sud', 36.1, 127.44),
  ('CR', 'Costa Rica', 9.96, -84.23),
  ('CI', 'Côte d''Ivoire', 7.22, -5.64),
  ('HR', 'Croatie', 45.14, 16.41),
  ('CU', 'Cuba', 22.07, -79.92),
  ('CW', 'Curaçao', 12.17, -68.97),
  ('DK', 'Danemark', 55.84, 10.68),
  ('DJ', 'Djibouti', 11.64, 42.78),
  ('DM', 'Dominique', 15.41, -61.36),
  ('EG', 'Égypte', 29.35, 31.43),
  ('AE', 'Émirats arabes unis', 25.1, 55.37),
  ('EC', 'Équateur', -1.48, -79.11),
  ('ER', 'Érythrée', 14.98, 38.87),
  ('ES', 'Espagne', 40.54, -3.23),
  ('EE', 'Estonie', 58.93, 25.4),
  ('SZ', 'Eswatini', -26.5, 31.43),
  ('VA', 'État de la Cité du Vatican', 41.9, 12.45),
  ('US', 'États-Unis', 38.34, -90.5),
  ('ET', 'Éthiopie', 9.17, 38.9),
  ('FJ', 'Fidji', -17.37, 155.86),
  ('FI', 'Finlande', 61.71, 24.77),
  ('FR', 'France', 46.99, 2.49),
  ('GA', 'Gabon', -0.84, 11.68),
  ('GM', 'Gambie', 13.42, -15.7),
  ('GE', 'Géorgie', 42.22, 42.92),
  ('GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', -54.28, -36.51),
  ('GH', 'Ghana', 6.69, -1.01),
  ('GI', 'Gibraltar', 36.13, -5.35),
  ('GR', 'Grèce', 38.82, 23.19),
  ('GD', 'Grenade', 12.18, -61.66),
  ('GL', 'Groenland', 65.86, -49.72),
  ('GP', 'Guadeloupe', 16.18, -61.56),
  ('GU', 'Guam', 13.44, 144.76),
  ('GT', 'Guatemala', 14.92, -90.85),
  ('GG', 'Guernesey', 49.48, -2.55),
  ('GN', 'Guinée', 10.61, -11.28),
  ('GQ', 'Guinée équatoriale', 1.75, 9.86),
  ('GW', 'Guinée-Bissau', 11.95, -15.35),
  ('GY', 'Guyana', 6.39, -58.13),
  ('GF', 'Guyane française', 4.91, -52.93),
  ('HT', 'Haïti', 18.99, -72.73),
  ('HN', 'Honduras', 14.79, -87.52),
  ('HU', 'Hongrie', 47.32, 19.53),
  ('CX', 'Île Christmas', -10.42, 105.68),
  ('IM', 'Île de Man', 54.22, -4.54),
  ('NF', 'Île Norfolk', -29.05, 167.97),
  ('AX', 'Îles Åland', 60.2, 20.18),
  ('KY', 'Îles Caïmans', 19.36, -81.13),
  ('CC', 'Îles Cocos', -12.16, 96.82),
  ('CK', 'Îles Cook', -21.22, -159.75),
  ('FO', 'Îles Féroé', 61.99, -6.82),
  ('FK', 'Îles Malouines', -51.69, -57.86),
  ('MP', 'Îles Mariannes du Nord', 15.15, 145.71),
  ('MH', 'Îles Marshall', 8.25, 168.99),
  ('UM', 'Îles mineures éloignées des États-Unis', 0, 0),
  ('PN', 'Îles Pitcairn', -25.07, -130.1),
  ('SB', 'Îles Salomon', -9.17, 159.79),
  ('TC', 'Îles Turques-et-Caïques', 21.76, -72.06),
  ('VG', 'Îles Vierges britanniques', 18.44, -64.53),
  ('VI', 'Îles Vierges des États-Unis', 18.14, -64.84),
  ('IN', 'Inde', 20.45, 79.18),
  ('ID', 'Indonésie', -3.81, 112.59),
  ('IQ', 'Irak', 34.29, 44.56),
  ('IR', 'Iran', 33.83, 51.72),
  ('IE', 'Irlande', 53.2, -7.38),
  ('IS', 'Islande', 64.61, -20.27),
  ('IL', 'Israël', 32.28, 35.06),
  ('IT', 'Italie', 43.43, 11.58),
  ('JM', 'Jamaïque', 18.15, -77.28),
  ('JP', 'Japon', 35.92, 137.14),
  ('JE', 'Jersey', 49.21, -2.1),
  ('JO', 'Jordanie', 31.87, 35.89),
  ('KZ', 'Kazakhstan', 48.34, 69.24),
  ('KE', 'Kenya', -0.61, 36.73),
  ('KG', 'Kirghizstan', 41.33, 73.35),
  ('KI', 'Kiribati', 1.77, 85.99),
  ('XK', 'Kosovo', 42.55, 20.78),
  ('KW', 'Koweït', 29.26, 48.03),
  ('RE', 'La Réunion', -21.12, 55.5),
  ('LA', 'Laos', 18.32, 103.84),
  ('LS', 'Lesotho', -29.56, 27.95),
  ('LV', 'Lettonie', 56.91, 24.5),
  ('LB', 'Liban', 33.78, 35.71),
  ('LR', 'Liberia', 6.47, -9.26),
  ('LY', 'Libye', 30.87, 16.01),
  ('LI', 'Liechtenstein', 47.17, 9.52),
  ('LT', 'Lituanie', 55.17, 23.84),
  ('LU', 'Luxembourg', 49.68, 6.11),
  ('MK', 'Macédoine du Nord', 41.68, 21.56),
  ('MG', 'Madagascar', -19.25, 47.33),
  ('MY', 'Malaisie', 3.84, 103.4),
  ('MW', 'Malawi', -14, 34.52),
  ('MV', 'Maldives', 3.16, 73.28),
  ('ML', 'Mali', 14.02, -5.45),
  ('MT', 'Malte', 35.92, 14.43),
  ('MA', 'Maroc', 32.85, -6.37),
  ('MQ', 'Martinique', 14.64, -60.99),
  ('MU', 'Maurice', -20.09, 57.71),
  ('MR', 'Mauritanie', 17.35, -12.56),
  ('YT', 'Mayotte', -12.81, 45.15),
  ('MX', 'Mexique', 20.19, -99.25),
  ('FM', 'Micronésie', 6.96, 151.76),
  ('MD', 'Moldavie', 47.09, 28.73),
  ('MC', 'Monaco', 43.74, 7.42),
  ('MN', 'Mongolie', 47.48, 102.55),
  ('ME', 'Monténégro', 42.56, 19.22),
  ('MS', 'Montserrat', 16.76, -62.21),
  ('MZ', 'Mozambique', -18.98, 35.72),
  ('MM', 'Myanmar (Birmanie)', 18.13, 96.22),
  ('NA', 'Namibie', -21.54, 17.09),
  ('NR', 'Nauru', -0.53, 166.93),
  ('NP', 'Népal', 27.85, 84.29),
  ('NI', 'Nicaragua', 12.6, -85.89),
  ('NE', 'Niger', 14.45, 6.31),
  ('NG', 'Nigeria', 8.74, 7.37),
  ('NU', 'Niue', -19.05, -169.92),
  ('NO', 'Norvège', 61.99, 10.26),
  ('NC', 'Nouvelle-Calédonie', -21.77, 166.05),
  ('NZ', 'Nouvelle-Zélande', -40.4, 173.32),
  ('OM', 'Oman', 23.06, 57.18),
  ('UG', 'Ouganda', 0.82, 32.07),
  ('UZ', 'Ouzbékistan', 40.6, 67.22),
  ('PK', 'Pakistan', 30.57, 71.27),
  ('PW', 'Palaos', 7.15, 134.26),
  ('PA', 'Panama', 8.46, -80.7),
  ('PG', 'Papouasie-Nouvelle-Guinée', -6.36, 146.97),
  ('PY', 'Paraguay', -25.26, -56.68),
  ('NL', 'Pays-Bas', 52.07, 5.46),
  ('BQ', 'Pays-Bas caribéens', 14.2, -66.36),
  ('PE', 'Pérou', -11.1, -75.29),
  ('PH', 'Philippines', 11.9, 122.73),
  ('PL', 'Pologne', 51.48, 19.43),
  ('PF', 'Polynésie française', -17.3, -148.48),
  ('PR', 'Porto Rico', 18.23, -66.38),
  ('PT', 'Portugal', 39.58, -9.75),
  ('QA', 'Qatar', 25.39, 51.43),
  ('HK', 'R.A.S. chinoise de Hong Kong', 22.32, 114.17),
  ('MO', 'R.A.S. chinoise de Macao', 22.16, 113.55),
  ('CD', 'RD Congo', -3.38, 23.52),
  ('DO', 'République dominicaine', 18.93, -70.55),
  ('RO', 'Roumanie', 45.8, 25.13),
  ('GB', 'Royaume-Uni', 52.85, -1.84),
  ('RU', 'Russie', 53.5, 57.2),
  ('RW', 'Rwanda', -2.05, 29.63),
  ('EH', 'Sahara occidental', 25.2, -13.8),
  ('BL', 'Saint-Barthélemy', 17.9, -62.85),
  ('KN', 'Saint-Christophe-et-Niévès', 17.29, -62.73),
  ('SM', 'Saint-Marin', 43.94, 12.46),
  ('MF', 'Saint-Martin', 18.07, -63.07),
  ('SX', 'Saint-Martin (partie néerlandaise)', 18.04, -63.05),
  ('PM', 'Saint-Pierre-et-Miquelon', 46.94, -56.28),
  ('VC', 'Saint-Vincent-et-les Grenadines', 13.19, -61.2),
  ('SH', 'Sainte-Hélène', -19.21, -9.54),
  ('LC', 'Sainte-Lucie', 13.92, -60.96),
  ('SV', 'Salvador', 13.69, -88.93),
  ('WS', 'Samoa', -13.81, -171.93),
  ('AS', 'Samoa américaines', -14.11, -170.55),
  ('ST', 'Sao Tomé-et-Principe', 0.35, 6.72),
  ('SN', 'Sénégal', 14.58, -15.51),
  ('RS', 'Serbie', 44.74, 20.41),
  ('SC', 'Seychelles', -4.61, 55.51),
  ('SL', 'Sierra Leone', 8.36, -11.8),
  ('SG', 'Singapour', 1.34, 103.83),
  ('SK', 'Slovaquie', 48.62, 18.7),
  ('SI', 'Slovénie', 46.22, 14.98),
  ('SO', 'Somalie', 6.03, 45.39),
  ('SD', 'Soudan', 14.38, 31.45),
  ('SS', 'Soudan du Sud', 7, 29.54),
  ('LK', 'Sri Lanka', 7.15, 80.46),
  ('SE', 'Suède', 58.97, 15.37),
  ('CH', 'Suisse', 47.06, 8.11),
  ('SR', 'Suriname', 5.73, -55.27),
  ('SJ', 'Svalbard et Jan Mayen', 74.57, 3.46),
  ('SY', 'Syrie', 34.91, 37.07),
  ('TJ', 'Tadjikistan', 38.76, 69.45),
  ('TW', 'Taïwan', 24.15, 120.67),
  ('TZ', 'Tanzanie', -5.81, 35.5),
  ('TD', 'Tchad', 12.03, 17.55),
  ('CZ', 'Tchéquie', 49.75, 15.71),
  ('TF', 'Terres australes françaises', -49.35, 70.22),
  ('IO', 'Territoire britannique de l''océan Indien', -7.26, 72.38),
  ('PS', 'Territoires palestiniens', 31.97, 35.12),
  ('TH', 'Thaïlande', 14.32, 101.19),
  ('TL', 'Timor oriental', -8.8, 125.73),
  ('TG', 'Togo', 8.23, 0.97),
  ('TK', 'Tokelau', -9.04, -171.87),
  ('TO', 'Tonga', -20.64, -174.94),
  ('TT', 'Trinité-et-Tobago', 10.47, -61.4),
  ('TN', 'Tunisie', 35.64, 10.02),
  ('TM', 'Turkménistan', 38.57, 59.47),
  ('TR', 'Turquie', 38.86, 34.4),
  ('TV', 'Tuvalu', -7.69, 178.29),
  ('UA', 'Ukraine', 48.43, 30.97),
  ('UY', 'Uruguay', -33.56, -56.18),
  ('VU', 'Vanuatu', -16.33, 167.83),
  ('VE', 'Venezuela', 9.4, -68.25),
  ('VN', 'Viêt Nam', 16.62, 106.32),
  ('WF', 'Wallis-et-Futuna', -13.96, -177.48),
  ('YE', 'Yémen', 14.9, 45.12),
  ('ZM', 'Zambie', -13.55, 28.12),
  ('ZW', 'Zimbabwe', -18.52, 30.34)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

-- ============================================================================
-- 21. Données de départ : 40 profils de démonstration (comptes sans mot de passe)
-- ============================================================================

DO $do$
DECLARE
  _seed jsonb := $seed$[
["demo.ga.01@profils-virtuels.yona.invalid","Vanessa","female","2003-08-09","Gabon","Ngounié","Mouila","Calme et joyeuse, je partage mon temps entre mon travail et la louange. J'aime méditer la Parole chaque matin. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Louange","Cinéma"],"Pentecôtiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","male",18,33,"/demo-profils/demo-ga-01.webp"],
["demo.ga.02@profils-virtuels.yona.invalid","Murielle","female","2004-08-27","Gabon","Estuaire","Ntoum","Je suis une femme simple, passionnée par la musique et la lecture. J'enseigne à l'école du dimanche. Je crois au mariage, à la fidélité et au respect.",["Lecture","Musique"],"Protestante (Église évangélique du Gabon)","Chaque semaine","Tous les jours","Très importante","Mariage","male",18,32,"/demo-profils/demo-ga-02.webp"],
["demo.ga.03@profils-virtuels.yona.invalid","Hervé","male","2002-07-05","Gabon","Haut-Ogooué","Franceville","Souriant et attentionné, j'aime la mode et la danse. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Danse","Mode","Bénévolat"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Mariage","female",18,34,"/demo-profils/demo-ga-03.webp"],
["demo.ga.04@profils-virtuels.yona.invalid","Christian","male","2003-03-06","Gabon","Nyanga","Tchibanga","Je suis un homme simple, passionné par le bénévolat et la mode. Je suis engagé dans le groupe de jeunes de ma paroisse. Je crois au mariage, à la fidélité et au respect.",["Danse","Mode","Bénévolat","Cuisine"],"Catholique","Plusieurs fois par semaine","Matin et soir","Essentielle","Mariage","female",18,33,"/demo-profils/demo-ga-04.webp"],
["demo.cm.01@profils-virtuels.yona.invalid","Pélagie","female","1992-08-25","Cameroun","North","Garoua","Douce mais déterminée, j'aime le sport, les voyages et les longues discussions. Ma foi guide chacune de mes décisions. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Sport"],"Évangélique","Deux à trois fois par mois","Tous les jours","Essentielle","Mariage","male",28,44,"/demo-profils/demo-cm-01.webp"],
["demo.cm.02@profils-virtuels.yona.invalid","Aïcha","female","1993-08-20","Cameroun","West","Dschang","Souriante et attentionnée, j'aime les balades dans la nature et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Lecture","Nature"],"Catholique","Plusieurs fois par semaine","Tous les jours","Essentielle","Faire connaissance d'abord","male",27,43,"/demo-profils/demo-cm-02.webp"],
["demo.cm.03@profils-virtuels.yona.invalid","Arnaud","male","2003-03-30","Cameroun","South","Ébolowa","Fils de Dieu avant tout, je trouve ma joie dans la louange et les voyages. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Photographie","Voyages","Sport","Louange"],"Baptiste","Deux à trois fois par mois","Tous les jours","Très importante","Relation sérieuse","female",18,33,"/demo-profils/demo-cm-03.webp"],
["demo.cm.04@profils-virtuels.yona.invalid","Franck","male","1998-05-24","Cameroun","Littoral","Douala","Souriant et attentionné, j'aime la lecture et la louange. Je sers à l'accueil de mon église le dimanche. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Louange","Lecture"],"Pentecôtiste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","female",22,38,"/demo-profils/demo-cm-04.webp"],
["demo.ci.01@profils-virtuels.yona.invalid","Amenan","female","2001-11-03","Côte d'Ivoire","Vallée du Bandama District","Bouaké","Calme et joyeuse, je partage mon temps entre mon travail et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Cinéma","Nature"],"Méthodiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","male",18,34,"/demo-profils/demo-ci-01.webp"],
["demo.ci.02@profils-virtuels.yona.invalid","Chantal","female","2004-03-13","Côte d'Ivoire","Abidjan Autonomous District","Abidjan","Fille de Dieu avant tout, je trouve ma joie dans la photographie et la musique. Je sers à l'accueil de mon église le dimanche. Je crois au mariage, à la fidélité et au respect.",["Musique","Photographie","Cinéma","Cuisine"],"Harriste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Relation sérieuse","male",18,32,"/demo-profils/demo-ci-02.webp"],
["demo.ci.03@profils-virtuels.yona.invalid","Kouassi","male","1991-06-29","Côte d'Ivoire","Abidjan Autonomous District","Bingerville","Chaque journée est un cadeau de Dieu : je la remplis de cinéma et de voyages. J'aide à l'organisation des sorties de l'église. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Voyages","Cinéma","Bénévolat","Louange"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Faire connaissance d'abord","female",29,45,"/demo-profils/demo-ci-03.webp"],
["demo.ci.04@profils-virtuels.yona.invalid","Hermann","male","2004-07-21","Côte d'Ivoire","Bas-Sassandra District","San-Pédro","Je suis un homme simple, passionné par la musique et la cuisine. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Cuisine","Musique"],"Catholique","Chaque semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","female",18,32,"/demo-profils/demo-ci-04.webp"],
["demo.cg.01@profils-virtuels.yona.invalid","Tendresse","female","1995-03-29","Congo-Brazzaville","Sangha","Ouesso","Souriante et attentionnée, j'aime les voyages et la photographie. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Voyages","Photographie","Mode"],"Salutiste (Armée du Salut)","Chaque semaine","Matin et soir","Très importante","Mariage","male",25,41,"/demo-profils/demo-cg-01.webp"],
["demo.cg.02@profils-virtuels.yona.invalid","Orphée","female","1999-09-08","Congo-Brazzaville","Bouenza","Madingou","Souriante et attentionnée, j'aime la lecture et la cuisine. J'enseigne à l'école du dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Bénévolat","Cuisine","Lecture","Louange"],"Salutiste (Armée du Salut)","Chaque semaine","Plusieurs fois par semaine","Essentielle","Mariage","male",21,37,"/demo-profils/demo-cg-02.webp"],
["demo.cg.03@profils-virtuels.yona.invalid","Christ","male","2004-07-06","Congo-Brazzaville","Niari","Dolisie","Souriant et attentionné, j'aime les voyages et le cinéma. Je suis engagé dans le groupe de jeunes de ma paroisse. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Voyages","Cinéma","Louange"],"Pentecôtiste","Chaque semaine","Matin et soir","Très importante","Relation sérieuse","female",18,32,"/demo-profils/demo-cg-03.webp"],
["demo.cg.04@profils-virtuels.yona.invalid","Ulrich","male","2000-10-24","Congo-Brazzaville","Plateaux","Gamboma","Dynamique et fidèle en amitié, je consacre mon temps libre à la louange. Je joue dans le groupe de louange de mon église. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Louange","Nature"],"Pentecôtiste","Chaque semaine","Tous les jours","Au centre de ma vie","Faire connaissance d'abord","female",19,35,"/demo-profils/demo-cg-04.webp"],
["demo.tg.01@profils-virtuels.yona.invalid","Ablavi","female","2001-12-30","Togo","Plateaux","Kpalimé","Fille de Dieu avant tout, je trouve ma joie dans les voyages et le sport. La prière rythme mes journées. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Sport","Mode","Cinéma","Voyages"],"Méthodiste","Deux à trois fois par mois","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",18,34,"/demo-profils/demo-tg-01.webp"],
["demo.tg.02@profils-virtuels.yona.invalid","Dédé","female","1998-10-25","Togo","Maritime","Aného","Douce mais déterminée, j'aime les balades dans la nature, la danse et les longues discussions. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Danse","Nature","Louange"],"Évangélique presbytérienne","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","male",21,37,"/demo-profils/demo-tg-02.webp"],
["demo.tg.03@profils-virtuels.yona.invalid","Yawo","male","1993-03-23","Togo","Maritime","Tsévié","Dynamique et fidèle en amitié, je consacre mon temps libre à la musique. Le Psaume 23 m'accompagne depuis toujours. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Photographie","Musique"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",27,43,"/demo-profils/demo-tg-03.webp"],
["demo.tg.04@profils-virtuels.yona.invalid","Dodji","male","2000-10-02","Togo","Centrale","Sokodé","Calme et joyeux, je partage mon temps entre mon travail et la musique. Ma foi guide chacune de mes décisions. Je crois au mariage, à la fidélité et au respect.",["Mode","Musique","Photographie","Cinéma"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",20,36,"/demo-profils/demo-tg-04.webp"],
["demo.bj.01@profils-virtuels.yona.invalid","Nadège","female","2003-08-18","Bénin","Atlantique","Abomey-Calavi","Douce mais déterminée, j'aime la lecture, la danse et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Danse","Lecture"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",18,33,null],
["demo.bj.02@profils-virtuels.yona.invalid","Fernande","female","1995-02-12","Bénin","Collines","Savalou","Calme et joyeuse, je partage mon temps entre mon travail et la danse. Je suis engagée dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Bénévolat","Photographie","Danse"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Au centre de ma vie","Mariage","male",25,41,"/demo-profils/demo-bj-02.webp"],
["demo.bj.03@profils-virtuels.yona.invalid","Narcisse","male","1993-10-22","Bénin","Atakora","Natitingou","Fils de Dieu avant tout, je trouve ma joie dans la lecture et les voyages. Je suis engagé dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Musique","Lecture","Voyages"],"Méthodiste","Chaque semaine","Tous les jours","Essentielle","Faire connaissance d'abord","female",26,42,"/demo-profils/demo-bj-03.webp"],
["demo.bj.04@profils-virtuels.yona.invalid","Romaric","male","1999-06-22","Bénin","Atlantique","Ouidah","Chaque journée est un cadeau de Dieu : je la remplis de sport et de lecture. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Musique","Lecture","Mode","Sport"],"Assemblées de Dieu","Chaque semaine","Tous les jours","Très importante","Mariage","female",21,37,"/demo-profils/demo-bj-04.webp"],
["demo.sn.01@profils-virtuels.yona.invalid","Joséphine","female","2002-01-22","Sénégal","Kolda","Kolda","Calme et joyeuse, je partage mon temps entre mon travail et la louange. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Louange","Photographie"],"Adventiste","Deux à trois fois par mois","Tous les jours","Très importante","Mariage","male",18,34,"/demo-profils/demo-sn-01.webp"],
["demo.sn.02@profils-virtuels.yona.invalid","Albertine","female","1994-04-30","Sénégal","Thies","Mbour","Calme et joyeuse, je partage mon temps entre mon travail et la musique. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Musique","Lecture","Bénévolat"],"Adventiste","Chaque semaine","Tous les jours","Très importante","Mariage","male",26,42,"/demo-profils/demo-sn-02.webp"],
["demo.sn.03@profils-virtuels.yona.invalid","Marcel","male","1994-10-08","Sénégal","Kaolack","Kaolack","Je suis un homme simple, passionné par la photographie et la danse. J'aide à l'organisation des sorties de l'église. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Photographie"],"Adventiste","Chaque semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","female",25,41,"/demo-profils/demo-sn-03.webp"],
["demo.sn.04@profils-virtuels.yona.invalid","Raphaël","male","1994-12-07","Sénégal","Ziguinchor","Bignona","Je suis un homme simple, passionné par la lecture et la cuisine. J'aime méditer la Parole chaque matin. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Bénévolat","Cinéma","Cuisine","Lecture"],"Catholique","Chaque semaine","Matin et soir","Très importante","Faire connaissance d'abord","female",25,41,"/demo-profils/demo-sn-04.webp"],
["demo.ml.01@profils-virtuels.yona.invalid","Marthe","female","2004-04-14","Mali","Sikasso","Koutiala","Douce mais déterminée, j'aime la mode, la danse et les longues discussions. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Mode"],"Catholique","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",18,32,"/demo-profils/demo-ml-01.webp"],
["demo.ml.02@profils-virtuels.yona.invalid","Béatrice","female","1993-05-29","Mali","Ségou","Ségou","Je suis une femme simple, passionnée par la mode et le sport. Je participe à un groupe de prière chaque semaine. Je cherche une relation sérieuse, en vue du mariage.",["Mode","Sport","Danse"],"Protestante (Église chrétienne évangélique)","Deux à trois fois par mois","Tous les jours","Très importante","Faire connaissance d'abord","male",27,43,"/demo-profils/demo-ml-02.webp"],
["demo.ml.03@profils-virtuels.yona.invalid","Emmanuel","male","2004-02-18","Mali","Kayes","Kayes","Chaque journée est un cadeau de Dieu : je la remplis de photographie et de cinéma. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Sport","Bénévolat","Cinéma","Photographie"],"Baptiste","Plusieurs fois par semaine","Tous les jours","Essentielle","Relation sérieuse","female",18,32,"/demo-profils/demo-ml-03.webp"],
["demo.ml.04@profils-virtuels.yona.invalid","André","male","1993-02-16","Mali","Ségou","San","Souriant et attentionné, j'aime le sport et la musique. La prière rythme mes journées. J'attends une femme de foi, douce et pleine de joie.",["Sport","Cinéma","Musique","Cuisine"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","female",27,43,"/demo-profils/demo-ml-04.webp"],
["demo.fr.01@profils-virtuels.yona.invalid","Émilie","female","1996-06-22","France","Occitanie","Montpellier","Souriante et attentionnée, j'aime la louange et le sport. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Louange","Photographie","Sport","Cuisine"],"Protestante réformée","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","male",24,40,"/demo-profils/demo-fr-01.webp"],
["demo.fr.02@profils-virtuels.yona.invalid","Juliette","female","2000-10-14","France","Centre-Val de Loire","Tours","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de louange. Je chante dans la chorale de mon église. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Louange","Nature","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Très importante","Mariage","male",19,35,"/demo-profils/demo-fr-02.webp"],
["demo.fr.03@profils-virtuels.yona.invalid","Sophie","female","2001-03-09","France","Grand Est","Strasbourg","Douce mais déterminée, j'aime la louange, la photographie et les longues discussions. Ma foi guide chacune de mes décisions. J'attends un homme de foi, doux et responsable.",["Louange","Photographie"],"Protestante réformée","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",19,35,"/demo-profils/demo-fr-03.webp"],
["demo.fr.04@profils-virtuels.yona.invalid","Lucie","female","1991-10-11","France","Pays de la Loire","Angers","Douce mais déterminée, j'aime la cuisine, la louange et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Louange","Cuisine"],"Catholique","Plusieurs fois par semaine","Tous les jours","Très importante","Mariage","male",28,44,"/demo-profils/demo-fr-04.webp"],
["demo.fr.05@profils-virtuels.yona.invalid","Mathilde","female","2000-06-21","France","Auvergne-Rhône-Alpes","Lyon","Souriante et attentionnée, j'aime la louange et le sport. Je participe à un groupe de prière chaque semaine. J'attends un homme de foi, doux et responsable.",["Louange","Sport"],"Évangélique","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",20,36,"/demo-profils/demo-fr-05.webp"],
["demo.fr.06@profils-virtuels.yona.invalid","Hugo","male","1990-12-25","France","Occitanie","Toulouse","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Photographie","Cuisine","Cinéma"],"Adventiste","Deux à trois fois par mois","Matin et soir","Essentielle","Faire connaissance d'abord","female",29,45,"/demo-profils/demo-fr-06.webp"],
["demo.fr.07@profils-virtuels.yona.invalid","Guillaume","male","2003-12-02","France","Auvergne-Rhône-Alpes","Grenoble","Souriant et attentionné, j'aime la louange et la lecture. Je participe à un groupe de prière chaque semaine. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Lecture","Louange","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","female",18,32,"/demo-profils/demo-fr-07.webp"],
["demo.fr.08@profils-virtuels.yona.invalid","Louis","male","1996-06-29","France","New Aquitaine","Bordeaux","Souriant et attentionné, j'aime la mode et le cinéma. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Mode","Photographie","Cinéma","Louange"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","female",24,40,"/demo-profils/demo-fr-08.webp"]
]$seed$;
  _col text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE NOTICE 'Profils déjà présents : profils de démonstration non ajoutés de nouveau.';
    RETURN;
  END IF;

  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    e ->> 0, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', e ->> 1, 'is_virtual', true),
    now(), now()
  FROM jsonb_array_elements(_seed) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e ->> 0);

  -- Colonnes texte du service d'authentification : jamais NULL (sinon l'écran des
  -- utilisateurs de Supabase peut échouer). Seules les colonnes présentes sont touchées.
  FOREACH _col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
    'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = _col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email LIKE %L',
        _col, _col, '%@profils-virtuels.yona.invalid'
      );
    END IF;
  END LOOP;

  -- 2. Profils complets, actifs et visibles, avec leur image générée quand elle est
  --    livrée avec le site ; un profil sans photo reste caché aux membres (un
  --    administrateur peut en ajouter une dans /admin → Profils de démo).
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 2)::public.gender,
      birth_date = (e ->> 3)::date,
      country = e ->> 4,
      region = e ->> 5,
      city = e ->> 6,
      bio = e ->> 7,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 8)),
      is_virtual = true,
      terms_accepted_at = coalesce(p.terms_accepted_at, now()),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible',
      demo_photo_path = coalesce(nullif(e ->> 17, ''), p.demo_photo_path),
      demo_photo_source = CASE WHEN nullif(e ->> 17, '') IS NOT NULL THEN 'generated'
                               ELSE p.demo_photo_source END
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 9,
      church_attendance = e ->> 10,
      prayer_practice = e ->> 11,
      faith_importance = e ->> 12
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 13,
      preferred_gender = (e ->> 14)::public.gender,
      min_age = (e ->> 15)::smallint,
      max_age = (e ->> 16)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;

-- ============================================================================
-- 22. Premier administrateur (à faire après votre inscription sur le site)
-- ============================================================================

-- Le premier administrateur ne peut pas être créé d'avance : il faut d'abord un compte.
--   1. Inscrivez-vous sur le site avec votre adresse e-mail (ou Google).
--   2. Revenez ici (SQL Editor), retirez les deux tirets « -- » au début des 3 lignes
--      ci-dessous, remplacez VOTRE-ADRESSE@exemple.com par votre adresse, puis exécutez
--      seulement ces 3 lignes (sélectionnez-les, puis Run).
--   3. Déconnectez-vous puis reconnectez-vous : le menu « Administration » apparaît.
-- Rejouable : si vous êtes déjà administrateur, rien ne change.
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = lower('VOTRE-ADRESSE@exemple.com')
-- ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================================
-- 23. Bilan
-- ============================================================================

-- Tâches automatiques : comptées à part (pg_cron peut être absent ou non lisible).
DO $$
BEGIN
  PERFORM pg_catalog.set_config('yona.taches',
    (SELECT count(*)::text FROM cron.job WHERE jobname LIKE 'yona-%'), false);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('yona.taches', 'pg_cron non activé', false);
END $$;

RESET client_min_messages;

SELECT b.element AS "Élément", b.trouve AS "Dans la base", b.attendu AS "Attendu",
       CASE WHEN b.trouve = b.attendu THEN '✅'
            WHEN b.facultatif THEN '⚠️ facultatif'
            -- Fichier rejoué après l'ouverture : chaque vrai membre a remplacé un profil
            -- de démonstration (ils ne sont pas remis).
            WHEN b.n = 11 AND b.trouve::int < b.attendu::int
                 AND EXISTS (SELECT 1 FROM public.profiles WHERE NOT is_virtual)
              THEN '✅ (les autres ont laissé la place à de vrais membres)'
            ELSE '❌' END AS "État"
FROM (VALUES
  (1, 'Tables', (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public')::text, '44', false),
  (2, 'Fonctions', (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace)::text, '169', false),
  (3, 'Règles d''accès des tables', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public')::text, '90', false),
  (4, 'Tables protégées (RLS)', (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity)::text, '44', false),
  (5, 'Profil créé à l''inscription', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created'), 'oui', false),
  (6, 'Espaces de fichiers', (SELECT count(*) FROM storage.buckets WHERE id IN ('ads', 'demo-profils', 'photos', 'verifications', 'voice-messages'))::text, '5', false),
  (7, 'Règles d''accès des fichiers', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND policyname IN ('ads_storage_delete_admin',
      'ads_storage_insert_admin',
      'ads_storage_select_admin',
      'ads_storage_update_admin',
      'demo_storage_delete_admin',
      'demo_storage_insert_admin',
      'demo_storage_select_admin',
      'demo_storage_update_admin',
      'photos_storage_delete_own',
      'photos_storage_insert_own',
      'photos_storage_select',
      'verifications_storage_delete',
      'verifications_storage_insert_own',
      'verifications_storage_select',
      'voice_storage_delete_own',
      'voice_storage_insert_premium',
      'voice_storage_select_participant'))::text, '17', false),
  (8, 'Messages en temps réel', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages'), 'oui', false),
  (9, 'Tâches automatiques', current_setting('yona.taches', true), '4', true),
  (10, 'Pays', (SELECT count(*) FROM public.geo_countries)::text, '247', false),
  (11, 'Profils de démonstration', (SELECT count(*) FROM public.profiles WHERE is_virtual)::text, '40', false)
) AS b(n, element, trouve, attendu, facultatif)
ORDER BY b.n;
