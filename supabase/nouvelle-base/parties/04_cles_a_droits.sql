-- YONA — base de données complète, partie 4 sur 5
-- Contenu :
--   8. Clés primaires et valeurs uniques (suite)
--   9. Index : recherches rapides
--   10. Déclencheurs : actions automatiques à chaque ajout ou modification
--   11. Liens entre les tables (clés étrangères)
--   12. Sécurité par ligne (RLS) : activée sur toutes les tables
--   13. Règles d'accès : qui peut lire ou modifier quelles lignes
--   14. Droits d'accès : écrits un par un (aucun droit automatique)
-- À exécuter dans l'ordre (01, 02, …), chaque partie en entier :
-- Supabase → SQL Editor → New query → coller la partie → Run.
-- Chaque partie peut être relancée sans danger (par exemple après une erreur).
-- Fichier généré par scripts/generate-base-complete.py. Ne pas modifier à la main.

SET client_min_messages = warning;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversations'::pg_catalog.regclass AND conname = 'conversations_match_id_key') THEN
    ALTER TABLE ONLY public.conversations
      ADD CONSTRAINT conversations_match_id_key UNIQUE (match_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversations'::pg_catalog.regclass AND conname = 'conversations_pkey') THEN
    ALTER TABLE ONLY public.conversations
      ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.favorites'::pg_catalog.regclass AND conname = 'favorites_pkey') THEN
    ALTER TABLE ONLY public.favorites
      ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.favorites'::pg_catalog.regclass AND conname = 'favorites_user_id_favorite_user_id_key') THEN
    ALTER TABLE ONLY public.favorites
      ADD CONSTRAINT favorites_user_id_favorite_user_id_key UNIQUE (user_id, favorite_user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.geo_countries'::pg_catalog.regclass AND conname = 'geo_countries_pkey') THEN
    ALTER TABLE ONLY public.geo_countries
      ADD CONSTRAINT geo_countries_pkey PRIMARY KEY (code);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.geo_timezones'::pg_catalog.regclass AND conname = 'geo_timezones_pkey') THEN
    ALTER TABLE ONLY public.geo_timezones
      ADD CONSTRAINT geo_timezones_pkey PRIMARY KEY (tz);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.likes'::pg_catalog.regclass AND conname = 'likes_pkey') THEN
    ALTER TABLE ONLY public.likes
      ADD CONSTRAINT likes_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.likes'::pg_catalog.regclass AND conname = 'likes_sender_id_receiver_id_key') THEN
    ALTER TABLE ONLY public.likes
      ADD CONSTRAINT likes_sender_id_receiver_id_key UNIQUE (sender_id, receiver_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.location_history'::pg_catalog.regclass AND conname = 'location_history_pkey') THEN
    ALTER TABLE ONLY public.location_history
      ADD CONSTRAINT location_history_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.matches'::pg_catalog.regclass AND conname = 'matches_pkey') THEN
    ALTER TABLE ONLY public.matches
      ADD CONSTRAINT matches_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.matches'::pg_catalog.regclass AND conname = 'matches_user_1_id_user_2_id_key') THEN
    ALTER TABLE ONLY public.matches
      ADD CONSTRAINT matches_user_1_id_user_2_id_key UNIQUE (user_1_id, user_2_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.messages'::pg_catalog.regclass AND conname = 'messages_pkey') THEN
    ALTER TABLE ONLY public.messages
      ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.moderation_actions'::pg_catalog.regclass AND conname = 'moderation_actions_pkey') THEN
    ALTER TABLE ONLY public.moderation_actions
      ADD CONSTRAINT moderation_actions_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.notifications'::pg_catalog.regclass AND conname = 'notifications_pkey') THEN
    ALTER TABLE ONLY public.notifications
      ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.payment_events'::pg_catalog.regclass AND conname = 'payment_events_pkey') THEN
    ALTER TABLE ONLY public.payment_events
      ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.payments'::pg_catalog.regclass AND conname = 'payments_pkey') THEN
    ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.photos'::pg_catalog.regclass AND conname = 'photos_pkey') THEN
    ALTER TABLE ONLY public.photos
      ADD CONSTRAINT photos_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.photos'::pg_catalog.regclass AND conname = 'photos_user_id_storage_path_key') THEN
    ALTER TABLE ONLY public.photos
      ADD CONSTRAINT photos_user_id_storage_path_key UNIQUE (user_id, storage_path);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.preferences'::pg_catalog.regclass AND conname = 'preferences_pkey') THEN
    ALTER TABLE ONLY public.preferences
      ADD CONSTRAINT preferences_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_boosts'::pg_catalog.regclass AND conname = 'profile_boosts_pkey') THEN
    ALTER TABLE ONLY public.profile_boosts
      ADD CONSTRAINT profile_boosts_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_locations'::pg_catalog.regclass AND conname = 'profile_locations_pkey') THEN
    ALTER TABLE ONLY public.profile_locations
      ADD CONSTRAINT profile_locations_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_verifications'::pg_catalog.regclass AND conname = 'profile_verifications_pkey') THEN
    ALTER TABLE ONLY public.profile_verifications
      ADD CONSTRAINT profile_verifications_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_visits'::pg_catalog.regclass AND conname = 'profile_visits_pkey') THEN
    ALTER TABLE ONLY public.profile_visits
      ADD CONSTRAINT profile_visits_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profiles'::pg_catalog.regclass AND conname = 'profiles_pkey') THEN
    ALTER TABLE ONLY public.profiles
      ADD CONSTRAINT profiles_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reports'::pg_catalog.regclass AND conname = 'reports_pkey') THEN
    ALTER TABLE ONLY public.reports
      ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.server_errors'::pg_catalog.regclass AND conname = 'server_errors_pkey') THEN
    ALTER TABLE ONLY public.server_errors
      ADD CONSTRAINT server_errors_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.signup_events'::pg_catalog.regclass AND conname = 'signup_events_once') THEN
    ALTER TABLE ONLY public.signup_events
      ADD CONSTRAINT signup_events_once UNIQUE (user_id, step);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.signup_events'::pg_catalog.regclass AND conname = 'signup_events_pkey') THEN
    ALTER TABLE ONLY public.signup_events
      ADD CONSTRAINT signup_events_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.storage_cleanup_queue'::pg_catalog.regclass AND conname = 'storage_cleanup_queue_pkey') THEN
    ALTER TABLE ONLY public.storage_cleanup_queue
      ADD CONSTRAINT storage_cleanup_queue_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.subscriptions'::pg_catalog.regclass AND conname = 'subscriptions_pkey') THEN
    ALTER TABLE ONLY public.subscriptions
      ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.support_tickets'::pg_catalog.regclass AND conname = 'support_tickets_pkey') THEN
    ALTER TABLE ONLY public.support_tickets
      ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_activity'::pg_catalog.regclass AND conname = 'user_activity_pkey') THEN
    ALTER TABLE ONLY public.user_activity
      ADD CONSTRAINT user_activity_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_roles'::pg_catalog.regclass AND conname = 'user_roles_pkey') THEN
    ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_roles'::pg_catalog.regclass AND conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_settings'::pg_catalog.regclass AND conname = 'user_settings_pkey') THEN
    ALTER TABLE ONLY public.user_settings
      ADD CONSTRAINT user_settings_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.users'::pg_catalog.regclass AND conname = 'users_email_key') THEN
    ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_email_key UNIQUE (email);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.users'::pg_catalog.regclass AND conname = 'users_pkey') THEN
    ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.verification_settings'::pg_catalog.regclass AND conname = 'verification_settings_pkey') THEN
    ALTER TABLE ONLY public.verification_settings
      ADD CONSTRAINT verification_settings_pkey PRIMARY KEY (id);
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.virtual_profile_removals'::pg_catalog.regclass AND conname = 'virtual_profile_removals_pkey') THEN
    ALTER TABLE ONLY public.virtual_profile_removals
      ADD CONSTRAINT virtual_profile_removals_pkey PRIMARY KEY (user_id);
  END IF;
END
$contrainte$;

-- ============================================================================
-- 9. Index : recherches rapides
-- ============================================================================

CREATE INDEX IF NOT EXISTS activity_events_created_idx ON public.activity_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_event_idx ON public.activity_events USING btree (event, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_events_user_idx ON public.activity_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_ad_idx ON public.ad_events USING btree (ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_created_idx ON public.ad_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS ad_events_user_idx ON public.ad_events USING btree (user_id, ad_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS ads_live_idx ON public.ads USING btree (status, starts_at) WHERE (status = 'active'::text);
CREATE INDEX IF NOT EXISTS ai_usage_feature_date_idx ON public.ai_usage USING btree (feature, usage_date);
CREATE INDEX IF NOT EXISTS ai_usage_user_idx ON public.ai_usage USING btree (user_id);
CREATE INDEX IF NOT EXISTS auth_events_created_idx ON public.auth_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS auth_events_ip_failed_idx ON public.auth_events USING btree (ip, created_at) WHERE (event = 'login_failed'::text);
CREATE INDEX IF NOT EXISTS auth_events_user_idx ON public.auth_events USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks USING btree (blocked_id);
CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_one_pending ON public.contact_requests USING btree (sender_id, receiver_id) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS contact_requests_receiver_idx ON public.contact_requests USING btree (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_requests_sender_day_idx ON public.contact_requests USING btree (sender_id, created_at);
CREATE INDEX IF NOT EXISTS contact_requests_sender_idx ON public.contact_requests USING btree (sender_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_unlocks_payment_unique ON public.conversation_unlocks USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS conversation_user_usage_conversation_idx ON public.conversation_user_usage USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS conversation_user_usage_user_idx ON public.conversation_user_usage USING btree (user_id);
CREATE INDEX IF NOT EXISTS conversations_user_1_idx ON public.conversations USING btree (user_1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_2_idx ON public.conversations USING btree (user_2_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS favorites_favorite_user_idx ON public.favorites USING btree (favorite_user_id);
CREATE INDEX IF NOT EXISTS favorites_user_idx ON public.favorites USING btree (user_id);
CREATE INDEX IF NOT EXISTS geo_countries_name_idx ON public.geo_countries USING btree (lower(name));
CREATE INDEX IF NOT EXISTS likes_receiver_idx ON public.likes USING btree (receiver_id, kind, status);
CREATE INDEX IF NOT EXISTS location_history_created_idx ON public.location_history USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS location_history_user_idx ON public.location_history USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS matches_user_2_idx ON public.matches USING btree (user_2_id);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON public.moderation_actions USING btree (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications USING btree (user_id) WHERE (read_at IS NULL);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_created_idx ON public.payment_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS payment_events_payment_idx ON public.payment_events USING btree (payment_id);
CREATE INDEX IF NOT EXISTS payment_events_user_idx ON public.payment_events USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS payments_provider_tx_idx ON public.payments USING btree (provider, provider_transaction_id) WHERE (provider_transaction_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments USING btree (user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS photos_one_primary_idx ON public.photos USING btree (user_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS photos_user_idx ON public.photos USING btree (user_id, "position");
CREATE INDEX IF NOT EXISTS profile_boosts_user_idx ON public.profile_boosts USING btree (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS profile_locations_inconsistent_idx ON public.profile_locations USING btree (checked_at DESC) WHERE inconsistent;
CREATE INDEX IF NOT EXISTS profile_verifications_pending_idx ON public.profile_verifications USING btree (created_at) WHERE (status = 'pending'::text);
CREATE INDEX IF NOT EXISTS profile_verifications_status_idx ON public.profile_verifications USING btree (status, created_at) WHERE (status = ANY (ARRAY['processing'::text, 'pending'::text]));
CREATE INDEX IF NOT EXISTS profile_verifications_user_created_idx ON public.profile_verifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_verifications_user_idx ON public.profile_verifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_visits_pair_recent_idx ON public.profile_visits USING btree (visitor_id, visited_user_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS profile_visits_visited_at_idx ON public.profile_visits USING btree (visited_at DESC);
CREATE INDEX IF NOT EXISTS profile_visits_visited_idx ON public.profile_visits USING btree (visited_user_id);
CREATE INDEX IF NOT EXISTS profile_visits_visitor_idx ON public.profile_visits USING btree (visitor_id);
CREATE INDEX IF NOT EXISTS profiles_discovery_idx ON public.profiles USING btree (status, visibility, gender, city);
CREATE INDEX IF NOT EXISTS profiles_virtual_country_idx ON public.profiles USING btree (lower(btrim(country))) WHERE is_virtual;
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports USING btree (status, created_at DESC);
CREATE INDEX IF NOT EXISTS server_errors_created_idx ON public.server_errors USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS signup_events_created_idx ON public.signup_events USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS storage_cleanup_queue_pending_idx ON public.storage_cleanup_queue USING btree (created_at) WHERE (done_at IS NULL);
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_unique ON public.subscriptions USING btree (payment_id) WHERE (payment_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions USING btree (user_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx ON public.support_tickets USING btree (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS unlocks_conversation_idx ON public.conversation_unlocks USING btree (conversation_id, status, expires_at DESC);

-- ============================================================================
-- 10. Déclencheurs : actions automatiques à chaque ajout ou modification
-- ============================================================================

CREATE OR REPLACE TRIGGER ad_settings_audit_admin AFTER UPDATE ON public.ad_settings FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER ad_settings_set_updated_at BEFORE UPDATE ON public.ad_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER ads_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER ads_queue_media_cleanup AFTER DELETE OR UPDATE OF media_path, poster_path ON public.ads FOR EACH ROW EXECUTE FUNCTION public.queue_ad_media_cleanup();
CREATE OR REPLACE TRIGGER ads_set_updated_at BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER ai_usage_updated_at BEFORE UPDATE ON public.ai_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER auth_events_count_login AFTER INSERT ON public.auth_events FOR EACH ROW WHEN (((new.event = 'login'::text) AND (new.user_id IS NOT NULL))) EXECUTE FUNCTION public.count_member_login();
CREATE OR REPLACE TRIGGER blocks_log_activity AFTER INSERT ON public.blocks FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER christian_profiles_updated_at BEFORE UPDATE ON public.christian_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER contact_requests_log_activity AFTER INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER contact_requests_notify AFTER INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();
CREATE OR REPLACE TRIGGER contact_requests_refuse_demo BEFORE INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.refuse_contact_to_demo_profile();
CREATE OR REPLACE TRIGGER contact_requests_require_verified BEFORE INSERT ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.require_verified_sender();
CREATE OR REPLACE TRIGGER conversation_user_usage_updated_at BEFORE UPDATE ON public.conversation_user_usage FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER conversations_init_usage AFTER INSERT ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.init_conversation_usage();
CREATE OR REPLACE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER favorites_log_activity AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER favorites_notify AFTER INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.notify_favorite();
CREATE OR REPLACE TRIGGER favorites_refuse_blocked BEFORE INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
CREATE OR REPLACE TRIGGER favorites_set_created_at BEFORE INSERT ON public.favorites FOR EACH ROW EXECUTE FUNCTION public.set_favorite_created_at();
CREATE OR REPLACE TRIGGER likes_create_match AFTER INSERT OR UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();
CREATE OR REPLACE TRIGGER likes_log_activity AFTER INSERT OR UPDATE OF kind, status ON public.likes FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER likes_notify AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.notify_like();
CREATE OR REPLACE TRIGGER likes_protect_parties BEFORE UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.protect_like_parties();
CREATE OR REPLACE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
CREATE OR REPLACE TRIGGER likes_set_created_at BEFORE INSERT OR UPDATE ON public.likes FOR EACH ROW EXECUTE FUNCTION public.set_like_created_at();
CREATE OR REPLACE TRIGGER matches_create_conversation AFTER INSERT OR UPDATE OF status ON public.matches FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_match();
CREATE OR REPLACE TRIGGER matches_log_activity AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER matches_notify AFTER INSERT ON public.matches FOR EACH ROW EXECUTE FUNCTION public.notify_match();
CREATE OR REPLACE TRIGGER messages_block_phone_numbers BEFORE INSERT OR UPDATE OF content, status, contains_phone_number ON public.messages FOR EACH ROW EXECUTE FUNCTION public.messages_block_phone_numbers();
CREATE OR REPLACE TRIGGER messages_log_activity AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_message();
CREATE OR REPLACE TRIGGER messages_require_verified BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.require_verified_sender();
CREATE OR REPLACE TRIGGER moderation_actions_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.moderation_actions FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER payments_activate_conversation_unlock AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.activate_conversation_unlock();
CREATE OR REPLACE TRIGGER payments_activate_premium AFTER UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.activate_premium_subscription();
CREATE OR REPLACE TRIGGER payments_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER payments_log AFTER INSERT OR UPDATE OF status ON public.payments FOR EACH ROW EXECUTE FUNCTION public.log_payment_change();
CREATE OR REPLACE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER photos_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER photos_enforce_limit BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION public.enforce_photo_limit();
CREATE OR REPLACE TRIGGER photos_promote_primary_on_delete AFTER DELETE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.photos_after_delete();
CREATE OR REPLACE TRIGGER photos_protect_status BEFORE INSERT OR UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.protect_photo_status();
CREATE OR REPLACE TRIGGER photos_set_primary_on_insert BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION public.photos_before_insert();
CREATE OR REPLACE TRIGGER preferences_updated_at BEFORE UPDATE ON public.preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER profile_verifications_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.profile_verifications FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER profile_verifications_log_signup AFTER INSERT OR UPDATE OF status ON public.profile_verifications FOR EACH ROW EXECUTE FUNCTION public.log_signup_milestone();
CREATE OR REPLACE TRIGGER profile_visits_log_activity AFTER INSERT ON public.profile_visits FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER profile_visits_notify AFTER INSERT ON public.profile_visits FOR EACH ROW EXECUTE FUNCTION public.notify_visit();
CREATE OR REPLACE TRIGGER profile_visits_refuse_blocked BEFORE INSERT ON public.profile_visits FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
CREATE OR REPLACE TRIGGER profiles_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER profiles_check_personal_info BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_personal_info();
CREATE OR REPLACE TRIGGER profiles_check_visibility BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.check_profile_visibility();
CREATE OR REPLACE TRIGGER profiles_log_signup AFTER UPDATE OF onboarding_completed_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_signup_milestone();
CREATE OR REPLACE TRIGGER profiles_no_coordinates BEFORE INSERT OR UPDATE OF latitude, longitude ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.clear_profile_coordinates();
CREATE OR REPLACE TRIGGER profiles_protect_server_fields BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_server_profile_fields();
CREATE OR REPLACE TRIGGER profiles_protect_status BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();
CREATE OR REPLACE TRIGGER profiles_protect_terms BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_terms_accepted_at();
CREATE OR REPLACE TRIGGER profiles_replace_virtual AFTER UPDATE OF verified_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.replace_virtual_profile_on_signup();
CREATE OR REPLACE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER reports_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER reports_log_activity AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.log_member_action();
CREATE OR REPLACE TRIGGER subscriptions_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER support_tickets_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER user_activity_updated_at BEFORE UPDATE ON public.user_activity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER user_roles_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER users_audit_admin AFTER INSERT OR DELETE OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER users_log_account AFTER DELETE OR UPDATE OF status ON public.users FOR EACH ROW EXECUTE FUNCTION public.log_account_change();
CREATE OR REPLACE TRIGGER users_protect_columns BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();
CREATE OR REPLACE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE OR REPLACE TRIGGER verification_settings_audit_admin AFTER UPDATE ON public.verification_settings FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();
CREATE OR REPLACE TRIGGER verification_settings_set_updated_at BEFORE UPDATE ON public.verification_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 11. Liens entre les tables (clés étrangères)
-- ============================================================================

DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ad_events'::pg_catalog.regclass AND conname = 'ad_events_ad_id_fkey') THEN
    ALTER TABLE ONLY public.ad_events
      ADD CONSTRAINT ad_events_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.ads(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ad_events'::pg_catalog.regclass AND conname = 'ad_events_user_id_fkey') THEN
    ALTER TABLE ONLY public.ad_events
      ADD CONSTRAINT ad_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ads'::pg_catalog.regclass AND conname = 'ads_created_by_fkey') THEN
    ALTER TABLE ONLY public.ads
      ADD CONSTRAINT ads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.ai_usage'::pg_catalog.regclass AND conname = 'ai_usage_user_id_fkey') THEN
    ALTER TABLE ONLY public.ai_usage
      ADD CONSTRAINT ai_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.blocks'::pg_catalog.regclass AND conname = 'blocks_blocked_id_fkey') THEN
    ALTER TABLE ONLY public.blocks
      ADD CONSTRAINT blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.blocks'::pg_catalog.regclass AND conname = 'blocks_blocker_id_fkey') THEN
    ALTER TABLE ONLY public.blocks
      ADD CONSTRAINT blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.christian_profiles'::pg_catalog.regclass AND conname = 'christian_profiles_user_id_fkey') THEN
    ALTER TABLE ONLY public.christian_profiles
      ADD CONSTRAINT christian_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.contact_requests'::pg_catalog.regclass AND conname = 'contact_requests_receiver_id_fkey') THEN
    ALTER TABLE ONLY public.contact_requests
      ADD CONSTRAINT contact_requests_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.contact_requests'::pg_catalog.regclass AND conname = 'contact_requests_sender_id_fkey') THEN
    ALTER TABLE ONLY public.contact_requests
      ADD CONSTRAINT contact_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_reads'::pg_catalog.regclass AND conname = 'conversation_reads_conversation_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_reads
      ADD CONSTRAINT conversation_reads_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_reads'::pg_catalog.regclass AND conname = 'conversation_reads_user_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_reads
      ADD CONSTRAINT conversation_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_unlocks'::pg_catalog.regclass AND conname = 'conversation_unlocks_conversation_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_unlocks
      ADD CONSTRAINT conversation_unlocks_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_unlocks'::pg_catalog.regclass AND conname = 'conversation_unlocks_paid_by_user_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_unlocks
      ADD CONSTRAINT conversation_unlocks_paid_by_user_id_fkey FOREIGN KEY (paid_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_unlocks'::pg_catalog.regclass AND conname = 'conversation_unlocks_payment_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_unlocks
      ADD CONSTRAINT conversation_unlocks_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_user_usage'::pg_catalog.regclass AND conname = 'conversation_user_usage_conversation_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_user_usage
      ADD CONSTRAINT conversation_user_usage_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversation_user_usage'::pg_catalog.regclass AND conname = 'conversation_user_usage_user_id_fkey') THEN
    ALTER TABLE ONLY public.conversation_user_usage
      ADD CONSTRAINT conversation_user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversations'::pg_catalog.regclass AND conname = 'conversations_match_id_fkey') THEN
    ALTER TABLE ONLY public.conversations
      ADD CONSTRAINT conversations_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversations'::pg_catalog.regclass AND conname = 'conversations_user_1_id_fkey') THEN
    ALTER TABLE ONLY public.conversations
      ADD CONSTRAINT conversations_user_1_id_fkey FOREIGN KEY (user_1_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.conversations'::pg_catalog.regclass AND conname = 'conversations_user_2_id_fkey') THEN
    ALTER TABLE ONLY public.conversations
      ADD CONSTRAINT conversations_user_2_id_fkey FOREIGN KEY (user_2_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.favorites'::pg_catalog.regclass AND conname = 'favorites_favorite_user_id_fkey') THEN
    ALTER TABLE ONLY public.favorites
      ADD CONSTRAINT favorites_favorite_user_id_fkey FOREIGN KEY (favorite_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.favorites'::pg_catalog.regclass AND conname = 'favorites_user_id_fkey') THEN
    ALTER TABLE ONLY public.favorites
      ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.likes'::pg_catalog.regclass AND conname = 'likes_receiver_id_fkey') THEN
    ALTER TABLE ONLY public.likes
      ADD CONSTRAINT likes_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.likes'::pg_catalog.regclass AND conname = 'likes_sender_id_fkey') THEN
    ALTER TABLE ONLY public.likes
      ADD CONSTRAINT likes_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.location_history'::pg_catalog.regclass AND conname = 'location_history_user_id_fkey') THEN
    ALTER TABLE ONLY public.location_history
      ADD CONSTRAINT location_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.matches'::pg_catalog.regclass AND conname = 'matches_user_1_id_fkey') THEN
    ALTER TABLE ONLY public.matches
      ADD CONSTRAINT matches_user_1_id_fkey FOREIGN KEY (user_1_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.matches'::pg_catalog.regclass AND conname = 'matches_user_2_id_fkey') THEN
    ALTER TABLE ONLY public.matches
      ADD CONSTRAINT matches_user_2_id_fkey FOREIGN KEY (user_2_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.messages'::pg_catalog.regclass AND conname = 'messages_conversation_id_fkey') THEN
    ALTER TABLE ONLY public.messages
      ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.messages'::pg_catalog.regclass AND conname = 'messages_sender_id_fkey') THEN
    ALTER TABLE ONLY public.messages
      ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.moderation_actions'::pg_catalog.regclass AND conname = 'moderation_actions_admin_id_fkey') THEN
    ALTER TABLE ONLY public.moderation_actions
      ADD CONSTRAINT moderation_actions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.moderation_actions'::pg_catalog.regclass AND conname = 'moderation_actions_target_user_id_fkey') THEN
    ALTER TABLE ONLY public.moderation_actions
      ADD CONSTRAINT moderation_actions_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.notifications'::pg_catalog.regclass AND conname = 'notifications_actor_id_fkey') THEN
    ALTER TABLE ONLY public.notifications
      ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.notifications'::pg_catalog.regclass AND conname = 'notifications_user_id_fkey') THEN
    ALTER TABLE ONLY public.notifications
      ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.payments'::pg_catalog.regclass AND conname = 'payments_user_id_fkey') THEN
    ALTER TABLE ONLY public.payments
      ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.photos'::pg_catalog.regclass AND conname = 'photos_user_id_fkey') THEN
    ALTER TABLE ONLY public.photos
      ADD CONSTRAINT photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.preferences'::pg_catalog.regclass AND conname = 'preferences_user_id_fkey') THEN
    ALTER TABLE ONLY public.preferences
      ADD CONSTRAINT preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_boosts'::pg_catalog.regclass AND conname = 'profile_boosts_user_id_fkey') THEN
    ALTER TABLE ONLY public.profile_boosts
      ADD CONSTRAINT profile_boosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_locations'::pg_catalog.regclass AND conname = 'profile_locations_user_id_fkey') THEN
    ALTER TABLE ONLY public.profile_locations
      ADD CONSTRAINT profile_locations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_verifications'::pg_catalog.regclass AND conname = 'profile_verifications_reviewed_by_fkey') THEN
    ALTER TABLE ONLY public.profile_verifications
      ADD CONSTRAINT profile_verifications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_verifications'::pg_catalog.regclass AND conname = 'profile_verifications_user_id_fkey') THEN
    ALTER TABLE ONLY public.profile_verifications
      ADD CONSTRAINT profile_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_visits'::pg_catalog.regclass AND conname = 'profile_visits_visited_user_id_fkey') THEN
    ALTER TABLE ONLY public.profile_visits
      ADD CONSTRAINT profile_visits_visited_user_id_fkey FOREIGN KEY (visited_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profile_visits'::pg_catalog.regclass AND conname = 'profile_visits_visitor_id_fkey') THEN
    ALTER TABLE ONLY public.profile_visits
      ADD CONSTRAINT profile_visits_visitor_id_fkey FOREIGN KEY (visitor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.profiles'::pg_catalog.regclass AND conname = 'profiles_user_id_fkey') THEN
    ALTER TABLE ONLY public.profiles
      ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reports'::pg_catalog.regclass AND conname = 'reports_conversation_id_fkey') THEN
    ALTER TABLE ONLY public.reports
      ADD CONSTRAINT reports_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reports'::pg_catalog.regclass AND conname = 'reports_message_id_fkey') THEN
    ALTER TABLE ONLY public.reports
      ADD CONSTRAINT reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reports'::pg_catalog.regclass AND conname = 'reports_reported_user_id_fkey') THEN
    ALTER TABLE ONLY public.reports
      ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.reports'::pg_catalog.regclass AND conname = 'reports_reporter_id_fkey') THEN
    ALTER TABLE ONLY public.reports
      ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.subscriptions'::pg_catalog.regclass AND conname = 'subscriptions_payment_id_fkey') THEN
    ALTER TABLE ONLY public.subscriptions
      ADD CONSTRAINT subscriptions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.subscriptions'::pg_catalog.regclass AND conname = 'subscriptions_user_id_fkey') THEN
    ALTER TABLE ONLY public.subscriptions
      ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.support_tickets'::pg_catalog.regclass AND conname = 'support_tickets_user_id_fkey') THEN
    ALTER TABLE ONLY public.support_tickets
      ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_activity'::pg_catalog.regclass AND conname = 'user_activity_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_activity
      ADD CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_roles'::pg_catalog.regclass AND conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.user_settings'::pg_catalog.regclass AND conname = 'user_settings_user_id_fkey') THEN
    ALTER TABLE ONLY public.user_settings
      ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.users'::pg_catalog.regclass AND conname = 'users_id_auth_fkey') THEN
    ALTER TABLE ONLY public.users
      ADD CONSTRAINT users_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;
DO $contrainte$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
                 WHERE conrelid = 'public.virtual_profile_removals'::pg_catalog.regclass AND conname = 'virtual_profile_removals_user_id_fkey') THEN
    ALTER TABLE ONLY public.virtual_profile_removals
      ADD CONSTRAINT virtual_profile_removals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END
$contrainte$;

-- ============================================================================
-- 12. Sécurité par ligne (RLS) : activée sur toutes les tables
-- ============================================================================

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.christian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_timezones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signup_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.virtual_profile_removals ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 13. Règles d'accès : qui peut lire ou modifier quelles lignes
-- ============================================================================

-- Chaque règle est d'abord retirée puis recréée : le fichier peut être rejoué.
-- activity_events
DROP POLICY IF EXISTS activity_events_select_admin ON public.activity_events;
CREATE POLICY activity_events_select_admin ON public.activity_events FOR SELECT TO authenticated USING (public.is_admin());
-- ad_events
DROP POLICY IF EXISTS ad_events_admin_select ON public.ad_events;
CREATE POLICY ad_events_admin_select ON public.ad_events FOR SELECT TO authenticated USING (public.is_admin());
-- ad_settings
DROP POLICY IF EXISTS ad_settings_admin_select ON public.ad_settings;
CREATE POLICY ad_settings_admin_select ON public.ad_settings FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS ad_settings_admin_update ON public.ad_settings;
CREATE POLICY ad_settings_admin_update ON public.ad_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- admin_audit_log
DROP POLICY IF EXISTS admin_audit_log_select_admin ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_admin ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin());
-- ads
DROP POLICY IF EXISTS ads_admin_delete ON public.ads;
CREATE POLICY ads_admin_delete ON public.ads FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS ads_admin_insert ON public.ads;
CREATE POLICY ads_admin_insert ON public.ads FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS ads_admin_select ON public.ads;
CREATE POLICY ads_admin_select ON public.ads FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS ads_admin_update ON public.ads;
CREATE POLICY ads_admin_update ON public.ads FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- ai_usage
DROP POLICY IF EXISTS ai_usage_select_admin ON public.ai_usage;
CREATE POLICY ai_usage_select_admin ON public.ai_usage FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS ai_usage_select_own ON public.ai_usage;
CREATE POLICY ai_usage_select_own ON public.ai_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- auth_events
DROP POLICY IF EXISTS auth_events_select_admin ON public.auth_events;
CREATE POLICY auth_events_select_admin ON public.auth_events FOR SELECT TO authenticated USING (public.is_admin());
-- blocks
DROP POLICY IF EXISTS blocks_delete_own ON public.blocks;
CREATE POLICY blocks_delete_own ON public.blocks FOR DELETE TO authenticated USING ((blocker_id = auth.uid()));

DROP POLICY IF EXISTS blocks_insert_own ON public.blocks;
CREATE POLICY blocks_insert_own ON public.blocks FOR INSERT TO authenticated WITH CHECK ((blocker_id = auth.uid()));

DROP POLICY IF EXISTS blocks_select_admin ON public.blocks;
CREATE POLICY blocks_select_admin ON public.blocks FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks FOR SELECT TO authenticated USING ((blocker_id = auth.uid()));
-- christian_profiles
DROP POLICY IF EXISTS christian_select_admin ON public.christian_profiles;
CREATE POLICY christian_select_admin ON public.christian_profiles FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS christian_select_own ON public.christian_profiles;
CREATE POLICY christian_select_own ON public.christian_profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS christian_select_visible ON public.christian_profiles;
CREATE POLICY christian_select_visible ON public.christian_profiles FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_discoverable_profile(user_id)));

DROP POLICY IF EXISTS christian_update_own ON public.christian_profiles;
CREATE POLICY christian_update_own ON public.christian_profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- contact_requests
DROP POLICY IF EXISTS contact_requests_select_parties ON public.contact_requests;
CREATE POLICY contact_requests_select_parties ON public.contact_requests FOR SELECT TO authenticated USING (((sender_id = auth.uid()) OR (receiver_id = auth.uid())));
-- conversation_reads
DROP POLICY IF EXISTS conversation_reads_select_own ON public.conversation_reads;
CREATE POLICY conversation_reads_select_own ON public.conversation_reads FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- conversation_unlocks
DROP POLICY IF EXISTS unlocks_select_admin ON public.conversation_unlocks;
CREATE POLICY unlocks_select_admin ON public.conversation_unlocks FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS unlocks_select_participant ON public.conversation_unlocks;
CREATE POLICY unlocks_select_participant ON public.conversation_unlocks FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id, auth.uid()));
-- conversation_user_usage
DROP POLICY IF EXISTS cuu_select_admin ON public.conversation_user_usage;
CREATE POLICY cuu_select_admin ON public.conversation_user_usage FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS cuu_select_own ON public.conversation_user_usage;
CREATE POLICY cuu_select_own ON public.conversation_user_usage FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- conversations
DROP POLICY IF EXISTS conversations_select_admin ON public.conversations;
CREATE POLICY conversations_select_admin ON public.conversations FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS conversations_select_participant ON public.conversations;
CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT TO authenticated USING (((auth.uid() = user_1_id) OR (auth.uid() = user_2_id)));
-- favorites
DROP POLICY IF EXISTS favorites_delete_own ON public.favorites;
CREATE POLICY favorites_delete_own ON public.favorites FOR DELETE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
CREATE POLICY favorites_insert_own ON public.favorites FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND (user_id <> favorite_user_id) AND (NOT public.is_blocked_between(user_id, favorite_user_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(favorite_user_id)));

DROP POLICY IF EXISTS favorites_select_admin ON public.favorites;
CREATE POLICY favorites_select_admin ON public.favorites FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS favorites_select_own ON public.favorites;
CREATE POLICY favorites_select_own ON public.favorites FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- likes
DROP POLICY IF EXISTS likes_insert_own ON public.likes;
CREATE POLICY likes_insert_own ON public.likes FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND (sender_id <> receiver_id) AND (NOT public.is_blocked_between(sender_id, receiver_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(receiver_id)));

DROP POLICY IF EXISTS likes_select_admin ON public.likes;
CREATE POLICY likes_select_admin ON public.likes FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS likes_select_sent ON public.likes;
CREATE POLICY likes_select_sent ON public.likes FOR SELECT TO authenticated USING ((sender_id = auth.uid()));

DROP POLICY IF EXISTS likes_update_own ON public.likes;
CREATE POLICY likes_update_own ON public.likes FOR UPDATE TO authenticated USING ((sender_id = auth.uid())) WITH CHECK (((sender_id = auth.uid()) AND ((status = 'withdrawn'::public.like_status) OR ((NOT public.is_blocked_between(sender_id, receiver_id)) AND public.can_browse_profiles() AND public.is_discoverable_profile(receiver_id)))));
-- location_history
DROP POLICY IF EXISTS location_history_admin_select ON public.location_history;
CREATE POLICY location_history_admin_select ON public.location_history FOR SELECT TO authenticated USING (public.is_admin());
-- matches
DROP POLICY IF EXISTS matches_select_admin ON public.matches;
CREATE POLICY matches_select_admin ON public.matches FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS matches_select_participant ON public.matches;
CREATE POLICY matches_select_participant ON public.matches FOR SELECT TO authenticated USING (((auth.uid() = user_1_id) OR (auth.uid() = user_2_id)));
-- messages
DROP POLICY IF EXISTS messages_select_admin ON public.messages;
CREATE POLICY messages_select_admin ON public.messages FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS messages_select_own_blocked ON public.messages;
CREATE POLICY messages_select_own_blocked ON public.messages FOR SELECT TO authenticated USING ((sender_id = auth.uid()));

DROP POLICY IF EXISTS messages_select_participant ON public.messages;
CREATE POLICY messages_select_participant ON public.messages FOR SELECT TO authenticated USING (((status = 'delivered'::public.message_status) AND public.is_conversation_participant(conversation_id, auth.uid())));
-- moderation_actions
DROP POLICY IF EXISTS moderation_insert_admin ON public.moderation_actions;
CREATE POLICY moderation_insert_admin ON public.moderation_actions FOR INSERT TO authenticated WITH CHECK ((public.is_admin() AND (admin_id = auth.uid())));

DROP POLICY IF EXISTS moderation_select_admin ON public.moderation_actions;
CREATE POLICY moderation_select_admin ON public.moderation_actions FOR SELECT TO authenticated USING (public.is_admin());
-- notifications
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- payment_events
DROP POLICY IF EXISTS payment_events_select_admin ON public.payment_events;
CREATE POLICY payment_events_select_admin ON public.payment_events FOR SELECT TO authenticated USING (public.is_admin());
-- payments
DROP POLICY IF EXISTS payments_select_admin ON public.payments;
CREATE POLICY payments_select_admin ON public.payments FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_own ON public.payments FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- photos
DROP POLICY IF EXISTS photos_delete_admin ON public.photos;
CREATE POLICY photos_delete_admin ON public.photos FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS photos_delete_own ON public.photos;
CREATE POLICY photos_delete_own ON public.photos FOR DELETE TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS photos_insert_own ON public.photos;
CREATE POLICY photos_insert_own ON public.photos FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS photos_select_admin ON public.photos;
CREATE POLICY photos_select_admin ON public.photos FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS photos_select_own ON public.photos;
CREATE POLICY photos_select_own ON public.photos FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS photos_select_visible ON public.photos;
CREATE POLICY photos_select_visible ON public.photos FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND (status = 'approved'::public.photo_status) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_discoverable_profile(user_id)));

DROP POLICY IF EXISTS photos_update_admin ON public.photos;
CREATE POLICY photos_update_admin ON public.photos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS photos_update_own ON public.photos;
CREATE POLICY photos_update_own ON public.photos FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- preferences
DROP POLICY IF EXISTS preferences_select_admin ON public.preferences;
CREATE POLICY preferences_select_admin ON public.preferences FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS preferences_select_own ON public.preferences;
CREATE POLICY preferences_select_own ON public.preferences FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS preferences_update_own ON public.preferences;
CREATE POLICY preferences_update_own ON public.preferences FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- profile_boosts
DROP POLICY IF EXISTS profile_boosts_select_own ON public.profile_boosts;
CREATE POLICY profile_boosts_select_own ON public.profile_boosts FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));
-- profile_locations
DROP POLICY IF EXISTS profile_locations_select_own ON public.profile_locations;
CREATE POLICY profile_locations_select_own ON public.profile_locations FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- profile_verifications
DROP POLICY IF EXISTS verifications_select_own ON public.profile_verifications;
CREATE POLICY verifications_select_own ON public.profile_verifications FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- profile_visits
DROP POLICY IF EXISTS profile_visits_select_admin ON public.profile_visits;
CREATE POLICY profile_visits_select_admin ON public.profile_visits FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS profile_visits_select_own_visits ON public.profile_visits;
CREATE POLICY profile_visits_select_own_visits ON public.profile_visits FOR SELECT TO authenticated USING ((visitor_id = auth.uid()));
-- profiles
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS profiles_select_visible ON public.profiles;
CREATE POLICY profiles_select_visible ON public.profiles FOR SELECT TO authenticated USING (((user_id <> auth.uid()) AND (status = 'active'::public.profile_status) AND (visibility = 'visible'::public.profile_visibility) AND ((NOT is_virtual) OR (demo_photo_path IS NOT NULL)) AND public.can_browse_profiles() AND (NOT public.is_blocked_between(auth.uid(), user_id)) AND public.is_active_account(user_id)));

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- reports
DROP POLICY IF EXISTS reports_select_admin ON public.reports;
CREATE POLICY reports_select_admin ON public.reports FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS reports_select_own ON public.reports;
CREATE POLICY reports_select_own ON public.reports FOR SELECT TO authenticated USING ((reporter_id = auth.uid()));

DROP POLICY IF EXISTS reports_update_admin ON public.reports;
CREATE POLICY reports_update_admin ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
-- server_errors
DROP POLICY IF EXISTS server_errors_select_admin ON public.server_errors;
CREATE POLICY server_errors_select_admin ON public.server_errors FOR SELECT TO authenticated USING (public.is_admin());
-- signup_events
DROP POLICY IF EXISTS signup_events_select_admin ON public.signup_events;
CREATE POLICY signup_events_select_admin ON public.signup_events FOR SELECT TO authenticated USING (public.is_admin());
-- subscriptions
DROP POLICY IF EXISTS subscriptions_select_admin ON public.subscriptions;
CREATE POLICY subscriptions_select_admin ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- support_tickets
DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own ON public.support_tickets FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));
-- user_activity
DROP POLICY IF EXISTS activity_select_admin ON public.user_activity;
CREATE POLICY activity_select_admin ON public.user_activity FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS activity_select_own ON public.user_activity;
CREATE POLICY activity_select_own ON public.user_activity FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- user_roles
DROP POLICY IF EXISTS user_roles_select_admin ON public.user_roles;
CREATE POLICY user_roles_select_admin ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()));
-- user_settings
DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
CREATE POLICY user_settings_insert_own ON public.user_settings FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings FOR SELECT TO authenticated USING ((user_id = auth.uid()));

DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
CREATE POLICY user_settings_update_own ON public.user_settings FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));
-- users
DROP POLICY IF EXISTS users_select_admin ON public.users;
CREATE POLICY users_select_admin ON public.users FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));

DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));
-- verification_settings
DROP POLICY IF EXISTS verification_settings_admin_select ON public.verification_settings;
CREATE POLICY verification_settings_admin_select ON public.verification_settings FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS verification_settings_admin_update ON public.verification_settings;
CREATE POLICY verification_settings_admin_update ON public.verification_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 14. Droits d'accès : écrits un par un (aucun droit automatique)
-- ============================================================================

-- Chaque objet reçoit exactement les droits voulus. Les tables restent en plus
-- filtrées ligne par ligne par les règles d'accès ci-dessus.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 18 tables — membres connectés : lecture · serveur du site : tout
REVOKE ALL ON TABLE
  public.activity_events,
  public.admin_audit_log,
  public.auth_events,
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payment_events,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.server_errors,
  public.signup_events,
  public.user_activity
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.activity_events,
  public.admin_audit_log,
  public.auth_events,
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payment_events,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.server_errors,
  public.signup_events,
  public.user_activity
TO service_role;
GRANT SELECT ON TABLE
  public.activity_events,
  public.admin_audit_log,
  public.auth_events,
  public.contact_requests,
  public.conversation_reads,
  public.conversation_unlocks,
  public.conversation_user_usage,
  public.conversations,
  public.matches,
  public.messages,
  public.payment_events,
  public.payments,
  public.profile_locations,
  public.profile_visits,
  public.reports,
  public.server_errors,
  public.signup_events,
  public.user_activity
TO authenticated;

-- 11 tables — membres connectés : lecture, ajout, modification, suppression · serveur du site : tout
REVOKE ALL ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.ai_usage,
  public.blocks,
  public.christian_profiles,
  public.likes,
  public.moderation_actions,
  public.photos,
  public.preferences,
  public.profiles,
  public.subscriptions,
  public.user_roles,
  public.users
TO authenticated;

-- 9 compteurs — serveur du site : tout
REVOKE ALL ON SEQUENCE
  public.activity_events_id_seq,
  public.ad_events_id_seq,
  public.admin_audit_log_id_seq,
  public.auth_events_id_seq,
  public.location_history_id_seq,
  public.payment_events_id_seq,
  public.server_errors_id_seq,
  public.signup_events_id_seq,
  public.storage_cleanup_queue_id_seq
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON SEQUENCE
  public.activity_events_id_seq,
  public.ad_events_id_seq,
  public.admin_audit_log_id_seq,
  public.auth_events_id_seq,
  public.location_history_id_seq,
  public.payment_events_id_seq,
  public.server_errors_id_seq,
  public.signup_events_id_seq,
  public.storage_cleanup_queue_id_seq
TO service_role;

-- 5 tables — membres connectés : tout · serveur du site : tout
REVOKE ALL ON TABLE
  public.ad_events,
  public.ad_settings,
  public.ads,
  public.location_history,
  public.verification_settings
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.ad_events,
  public.ad_settings,
  public.ads,
  public.location_history,
  public.verification_settings
TO authenticated, service_role;

-- 4 tables — serveur du site : tout
REVOKE ALL ON TABLE
  public.geo_countries,
  public.geo_timezones,
  public.storage_cleanup_queue,
  public.virtual_profile_removals
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.geo_countries,
  public.geo_timezones,
  public.storage_cleanup_queue,
  public.virtual_profile_removals
TO service_role;

-- 3 tables — visiteurs : lecture, vidage, références, déclencheurs · membres connectés : lecture, vidage, références, déclencheurs · serveur du site : tout
REVOKE ALL ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
TO service_role;
GRANT SELECT, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.notifications,
  public.profile_boosts,
  public.support_tickets
TO anon, authenticated;

-- 1 tables — visiteurs : tout · membres connectés : lecture, modification, suppression, vidage, références, déclencheurs · serveur du site : tout
REVOKE ALL ON TABLE
  public.profile_verifications
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.profile_verifications
TO anon, service_role;
GRANT SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.profile_verifications
TO authenticated;

-- 1 tables — visiteurs : lecture, ajout, modification, vidage, références, déclencheurs · membres connectés : lecture, ajout, modification, vidage, références, déclencheurs · serveur du site : tout
REVOKE ALL ON TABLE
  public.user_settings
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.user_settings
TO service_role;
GRANT SELECT, INSERT, UPDATE, TRUNCATE, REFERENCES, TRIGGER ON TABLE
  public.user_settings
TO anon, authenticated;

-- 1 tables — membres connectés : lecture, ajout, suppression · serveur du site : tout
REVOKE ALL ON TABLE
  public.favorites
FROM PUBLIC, anon, authenticated, service_role;
GRANT ALL ON TABLE
  public.favorites
TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE
  public.favorites
TO authenticated;

-- Fin de la structure : retour aux réglages habituels de la session.
RESET search_path;
RESET check_function_bodies;
