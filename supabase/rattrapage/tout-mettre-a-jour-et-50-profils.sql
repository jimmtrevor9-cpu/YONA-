-- ============================================================
-- YONA — TOUT METTRE À JOUR AUTOMATIQUEMENT + 50 PROFILS VIRTUELS
--
-- À coller EN ENTIER dans Supabase → SQL Editor, puis « Run ».
-- (Si Supabase affiche « Potential issue detected », confirmer avec « Run this query ».)
--
-- 1. La base cherche elle-même la première mise à jour (migration) qui lui manque, puis
--    applique automatiquement, dans l'ordre, cette mise à jour et toutes les suivantes.
--    Mises à jour embarquées : de 20260929110000_phase12_creer_demande à la dernière.
--    Si une mise à jour plus ancienne manquait, rien n'est modifié et un message
--    l'indique (envoyer alors une capture d'écran).
-- 2. Ajoute les 50 profils virtuels (5 par pays : Gabon, Cameroun, Côte d'Ivoire,
--    Congo-Brazzaville, Togo, Bénin, Sénégal, Mali ; 10 en France).
-- 3. Affiche le bilan : « Tout est à jour » et « → Profils virtuels dans la base : 50 ».
--
-- En cas d'erreur, Supabase annule tout : rien n'est enregistré à moitié.
-- Généré par scripts/generate-check-migrations.py.
-- ============================================================

-- ############################################################
-- PARTIE 1 : mises à jour manquantes (automatique)
-- ############################################################
DO $auto$
DECLARE
  _first text;
  _detail text;
BEGIN
  WITH attendu(migration, nature, a, b) AS (VALUES
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'blocks_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'conversations_ordered_pair', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'likes_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'matches_ordered_pair', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'messages_content_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'payments_amount_positive', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'preferences_age_range', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'profiles_bio_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'profiles_first_name_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'reports_description_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'reports_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'subscriptions_period', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'unlocks_period', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'get_presence'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'handle_new_user'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'has_role'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_admin'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_blocked_between'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_conversation_participant'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_premium'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_photo_status'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_profile_status'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_user_columns'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'set_updated_at'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'blocks_blocked_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'conversations_user_1_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'conversations_user_2_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'likes_receiver_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'matches_user_2_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'messages_conversation_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'moderation_actions_target_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'payments_provider_tx_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'payments_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'photos_one_primary_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'photos_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'profiles_discovery_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'reports_status_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'subscriptions_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'unlocks_conversation_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'activity_select_admin', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'activity_select_own', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_delete_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_insert_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_select_admin', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_select_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_select_admin', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_select_own', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_update_own', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'conversations_select_admin', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'conversations_select_participant', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'likes_select_admin', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'likes_select_sent', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'matches_select_admin', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'matches_select_participant', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_admin', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_own_blocked', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_participant', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'moderation_insert_admin', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'moderation_select_admin', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'payments_select_admin', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'payments_select_own', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_delete_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_delete_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_insert_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_select_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_select_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_update_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_update_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_select_admin', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_select_own', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_update_own', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_select_admin', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_select_own', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_update_admin', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_update_own', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_select_admin', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_select_own', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_update_admin', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'subscriptions_select_admin', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'subscriptions_select_own', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'unlocks_select_admin', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'unlocks_select_participant', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'user_roles_select_admin', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'user_roles_select_own', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_select_admin', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_select_own', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_update_admin', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_update_own', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'christian_profiles_updated_at', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'conversations_updated_at', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'on_auth_user_created', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'payments_updated_at', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'photos_protect_status', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'preferences_updated_at', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'profiles_protect_status', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'profiles_updated_at', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'subscriptions_updated_at', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'user_activity_updated_at', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'users_protect_columns', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'users_updated_at', 'users'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'ai_usage_count_positive', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'conversation_user_usage_range', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'favorites_no_self', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'profile_visits_no_self', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'consume_ai_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'consume_free_message'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'enforce_photo_limit'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'get_ai_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'get_conversation_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'has_active_conversation_unlock'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'ai_usage_feature_date_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'ai_usage_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'conversation_user_usage_conversation_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'conversation_user_usage_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'favorites_favorite_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'favorites_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visited_at_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visited_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visitor_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'ai_usage_select_admin', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'ai_usage_select_own', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'cuu_select_admin', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'cuu_select_own', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_delete_own', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_select_admin', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_select_own', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'profile_visits_select_admin', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'profile_visits_select_own_visits', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'ai_usage_updated_at', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'conversation_user_usage_updated_at', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'photos_enforce_limit', 'photos'),
  ('20260925120000_phase0_rattrapage_schema', 'bucket', 'photos', ''),
  ('20260925120000_phase0_rattrapage_schema', 'policy', 'photos_storage_delete_own', 'objects'),
  ('20260925120000_phase0_rattrapage_schema', 'policy', 'photos_storage_insert_own', 'objects'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'is_active_account'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'is_discoverable_profile'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'protect_like_parties'),
  ('20260925130000_phase0_corrections_rls', 'trigger', 'likes_protect_parties', 'likes'),
  ('20260926100000_phase1_infos_personnelles', 'function', 'public', 'check_profile_personal_info'),
  ('20260926100000_phase1_infos_personnelles', 'trigger', 'profiles_check_personal_info', 'profiles'),
  ('20260926110000_phase1_infos_chretiennes', 'function', 'public', 'text_items_max_length'),
  ('20260926130000_phase1_photos', 'function', 'public', 'photos_after_delete'),
  ('20260926130000_phase1_photos', 'function', 'public', 'photos_before_insert'),
  ('20260926130000_phase1_photos', 'function', 'public', 'set_primary_photo'),
  ('20260926130000_phase1_photos', 'trigger', 'photos_promote_primary_on_delete', 'photos'),
  ('20260926130000_phase1_photos', 'trigger', 'photos_set_primary_on_insert', 'photos'),
  ('20260926140000_phase1_visibilite_profil', 'function', 'public', 'check_profile_visibility'),
  ('20260926140000_phase1_visibilite_profil', 'trigger', 'profiles_check_visibility', 'profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'function', 'public', 'can_browse_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'function', 'public', 'discover_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'christian_select_visible', 'christian_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'photos_select_visible', 'photos'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'photos_storage_select', 'objects'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'profiles_select_visible', 'profiles'),
  ('20260926160000_phase2_enregistrer_like', 'function', 'public', 'set_like_created_at'),
  ('20260926160000_phase2_enregistrer_like', 'policy', 'likes_insert_own', 'likes'),
  ('20260926160000_phase2_enregistrer_like', 'trigger', 'likes_set_created_at', 'likes'),
  ('20260926180000_phase2_blocages_decouverte', 'policy', 'likes_update_own', 'likes'),
  ('20260926190000_phase3_like_reciproque', 'function', 'public', 'has_mutual_like'),
  ('20260926200000_phase3_creer_match', 'function', 'public', 'create_match_on_mutual_like'),
  ('20260926200000_phase3_creer_match', 'trigger', 'likes_create_match', 'likes'),
  ('20260926220000_phase4_conversation_auto', 'function', 'public', 'create_conversation_for_match'),
  ('20260926220000_phase4_conversation_auto', 'trigger', 'matches_create_conversation', 'matches'),
  ('20260927100000_phase4_enregistrer_message', 'function', 'public', 'send_message'),
  ('20260927120000_phase4_messages_non_lus', 'function', 'public', 'get_unread_counts'),
  ('20260927120000_phase4_messages_non_lus', 'function', 'public', 'mark_conversation_read'),
  ('20260927120000_phase4_messages_non_lus', 'policy', 'conversation_reads_select_own', 'conversation_reads'),
  ('20260927120000_phase4_messages_non_lus', 'table', 'public', 'conversation_reads'),
  ('20260927140000_phase5_compteur_individuel', 'function', 'public', 'init_conversation_usage'),
  ('20260927140000_phase5_compteur_individuel', 'trigger', 'conversations_init_usage', 'conversations'),
  ('20260927180000_phase6_numeros_classiques', 'function', 'public', 'contains_phone_number'),
  ('20260928010000_phase6_empecher_stockage', 'function', 'public', 'messages_block_phone_numbers'),
  ('20260928010000_phase6_empecher_stockage', 'trigger', 'messages_block_phone_numbers', 'messages'),
  ('20260928020000_phase6_enforcement_serveur', 'constraint', 'messages_no_phone_number_delivered', ''),
  ('20260928040000_phase7_ecran_paiement', 'function', 'public', 'start_conversation_unlock_payment'),
  ('20260928050000_phase7_paiement_confirme', 'function', 'public', 'confirm_payment'),
  ('20260928060000_phase7_activer_deblocage', 'function', 'public', 'activate_conversation_unlock'),
  ('20260928060000_phase7_activer_deblocage', 'index', 'conversation_unlocks_payment_unique', ''),
  ('20260928060000_phase7_activer_deblocage', 'trigger', 'payments_activate_conversation_unlock', 'payments'),
  ('20260928090000_phase7_expirer_deblocage', 'function', 'public', 'expire_conversation_unlocks'),
  ('20260928110000_phase8_enregistrer_favori', 'function', 'public', 'set_favorite_created_at'),
  ('20260928110000_phase8_enregistrer_favori', 'policy', 'favorites_insert_own', 'favorites'),
  ('20260928110000_phase8_enregistrer_favori', 'trigger', 'favorites_set_created_at', 'favorites'),
  ('20260928120000_phase8_qui_ma_favorise', 'function', 'public', 'get_favorited_by'),
  ('20260928140000_phase9_enregistrer_visite', 'function', 'public', 'record_profile_visit'),
  ('20260928150000_phase9_limiter_visites', 'index', 'profile_visits_pair_recent_idx', ''),
  ('20260928160000_phase9_visiteurs_premium', 'function', 'public', 'get_profile_visitors'),
  ('20260928180000_phase10_derniere_activite', 'function', 'public', 'touch_activity'),
  ('20260928200000_phase10_statut_en_ligne', 'function', 'public', 'mark_offline'),
  ('20260928220000_phase11_filtre_age', 'function', 'public', 'search_profiles'),
  ('20260928235000_phase11_filtre_pays', 'function', 'public', 'list_search_countries'),
  ('20260928235000_phase11_filtre_pays', 'function', 'public', 'normalize_place'),
  ('20260929000000_phase11_filtre_ville', 'function', 'public', 'list_search_cities'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'clear_my_location'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'clear_profile_coordinates'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'distance_km'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'set_my_location'),
  ('20260929010000_phase11_filtre_distance', 'policy', 'profile_locations_select_own', 'profile_locations'),
  ('20260929010000_phase11_filtre_distance', 'table', 'public', 'profile_locations'),
  ('20260929010000_phase11_filtre_distance', 'trigger', 'profiles_no_coordinates', 'profiles'),
  ('20260929020000_phase11_filtre_situation', 'constraint', 'profiles_marital_status_check', ''),
  ('20260929030000_phase11_filtre_enfants', 'constraint', 'profiles_children_check', ''),
  ('20260929040000_phase11_filtre_denomination', 'function', 'public', 'list_search_values'),
  ('20260929080000_phase11_filtre_interets', 'constraint', 'profiles_interests_count', ''),
  ('20260929080000_phase11_filtre_interets', 'constraint', 'profiles_interests_item_length', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_message_length', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_no_self', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_status_check', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_one_pending', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_receiver_idx', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_sender_idx', ''),
  ('20260929110000_phase12_creer_demande', 'policy', 'contact_requests_select_parties', 'contact_requests'),
  ('20260929110000_phase12_creer_demande', 'table', 'public', 'contact_requests'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'cancel_contact_request'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'get_contact_request_quota'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'respond_contact_request'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'utc_day_start'),
  ('20260930100000_phase12_repondre_quota_demandes', 'index', 'contact_requests_sender_day_idx', ''),
  ('20260930110000_phase13_roi_salomon', 'function', 'public', 'ai_usage_day'),
  ('20260930110000_phase13_roi_salomon', 'function', 'public', 'refund_ai_quota'),
  ('20260930120000_phase14_premium', 'function', 'public', 'activate_premium_subscription'),
  ('20260930120000_phase14_premium', 'function', 'public', 'expire_subscriptions'),
  ('20260930120000_phase14_premium', 'function', 'public', 'get_my_premium'),
  ('20260930120000_phase14_premium', 'function', 'public', 'get_premium_badges'),
  ('20260930120000_phase14_premium', 'function', 'public', 'premium_plan_amount'),
  ('20260930120000_phase14_premium', 'function', 'public', 'start_premium_payment'),
  ('20260930120000_phase14_premium', 'index', 'subscriptions_payment_unique', ''),
  ('20260930120000_phase14_premium', 'trigger', 'payments_activate_premium', 'payments'),
  ('20260930130000_phase15_avantages_premium', 'bucket', 'voice-messages', ''),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'audio_duration_seconds'),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'audio_path'),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'kind'),
  ('20260930130000_phase15_avantages_premium', 'constraint', 'messages_kind_valid', ''),
  ('20260930130000_phase15_avantages_premium', 'constraint', 'profile_boosts_period', ''),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'activate_profile_boost'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'create_support_ticket'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'get_message_quota'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'get_my_boost'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'is_boosted'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'is_conversation_folder_participant'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'lock_conversation_for_sending'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'send_voice_message'),
  ('20260930130000_phase15_avantages_premium', 'index', 'profile_boosts_user_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'index', 'support_tickets_queue_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'index', 'support_tickets_user_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'policy', 'profile_boosts_select_own', 'profile_boosts'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'support_tickets_select_own', 'support_tickets'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_delete_own', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_insert_premium', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_select_participant', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'table', 'public', 'profile_boosts'),
  ('20260930130000_phase15_avantages_premium', 'table', 'public', 'support_tickets'),
  ('20260930150000_phase17_message_flash', 'column', 'contact_requests', 'is_flash'),
  ('20260930150000_phase17_message_flash', 'function', 'public', 'list_contact_requests'),
  ('20260930150000_phase17_message_flash', 'function', 'public', 'send_contact_request'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'can_view_profile'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'compatibility_breakdown'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'get_compatibility'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'get_compatibility_scores'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'create_notification'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'get_unread_notification_count'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'list_notifications'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'mark_all_notifications_read'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'mark_notification_read'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_contact_request'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_favorite'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_like'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_match'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_message'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_visit'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'wants_notification'),
  ('20260930170000_phase19_notifications', 'index', 'notifications_unread_idx', ''),
  ('20260930170000_phase19_notifications', 'index', 'notifications_user_idx', ''),
  ('20260930170000_phase19_notifications', 'policy', 'notifications_select_own', 'notifications'),
  ('20260930170000_phase19_notifications', 'table', 'public', 'notifications'),
  ('20260930170000_phase19_notifications', 'trigger', 'contact_requests_notify', 'contact_requests'),
  ('20260930170000_phase19_notifications', 'trigger', 'favorites_notify', 'favorites'),
  ('20260930170000_phase19_notifications', 'trigger', 'likes_notify', 'likes'),
  ('20260930170000_phase19_notifications', 'trigger', 'matches_notify', 'matches'),
  ('20260930170000_phase19_notifications', 'trigger', 'messages_notify', 'messages'),
  ('20260930170000_phase19_notifications', 'trigger', 'profile_visits_notify', 'profile_visits'),
  ('20260930180000_phase20_parametres', 'function', 'public', 'is_activity_visible'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_insert_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_select_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_update_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'table', 'public', 'user_settings'),
  ('20260930180000_phase20_parametres', 'trigger', 'user_settings_updated_at', 'user_settings'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'block_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'list_blocked_users'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'refuse_blocked_interaction'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'report_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'unblock_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'favorites_refuse_blocked', 'favorites'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'likes_refuse_blocked', 'likes'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'profile_visits_refuse_blocked', 'profile_visits'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_payments'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_pending_photos'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_reports'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_subscriptions'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_support_tickets'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_unlocks'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_users'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_moderate_photo'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_reply_support_ticket'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_resolve_report'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_set_user_status'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_stats'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_user_detail'),
  ('20260930200000_phase23_administration', 'function', 'public', 'assert_admin'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'origin'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'region'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'terms_accepted_at'),
  ('20261001090000_inscription_fluide', 'column', 'user_settings', 'marketing_emails'),
  ('20261001090000_inscription_fluide', 'constraint', 'profiles_origin_length', ''),
  ('20261001090000_inscription_fluide', 'constraint', 'profiles_region_length', ''),
  ('20261001090000_inscription_fluide', 'function', 'public', 'protect_terms_accepted_at'),
  ('20261001090000_inscription_fluide', 'function', 'public', 'recent_signups'),
  ('20261001090000_inscription_fluide', 'trigger', 'profiles_protect_terms', 'profiles'),
  ('20261002100000_profils_virtuels_et_verification', 'bucket', 'verifications', ''),
  ('20261002100000_profils_virtuels_et_verification', 'column', 'profiles', 'is_virtual'),
  ('20261002100000_profils_virtuels_et_verification', 'column', 'profiles', 'verified_at'),
  ('20261002100000_profils_virtuels_et_verification', 'constraint', 'profile_verifications_path_owner', ''),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'admin_list_pending_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'admin_review_verification'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'protect_server_profile_fields'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'remove_one_virtual_profile'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'replace_virtual_profile_on_signup'),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'geo_countries_name_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profile_verifications_pending_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profile_verifications_user_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profiles_virtual_country_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_insert_own', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_select_own', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_delete', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_insert_own', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_select', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'geo_countries'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'virtual_profile_removals'),
  ('20261002100000_profils_virtuels_et_verification', 'trigger', 'profiles_protect_server_fields', 'profiles'),
  ('20261002100000_profils_virtuels_et_verification', 'trigger', 'profiles_replace_virtual', 'profiles')
),
controle AS (
  SELECT migration, nature, a, b,
    CASE nature
      WHEN 'table' THEN to_regclass(quote_ident(a) || '.' || quote_ident(b)) IS NOT NULL
      WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                   WHERE n.nspname = a AND p.proname = b)
      WHEN 'column' THEN EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema IN ('public', 'storage') AND table_name = a AND column_name = b)
      WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                                  WHERE t.tgname = a AND c.relname = b)
      WHEN 'policy' THEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = a AND tablename = b)
      WHEN 'index' THEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = a)
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = a)
      WHEN 'bucket' THEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = a)
    END AS present
  FROM attendu
),
  premiere AS (SELECT min(migration) AS f FROM controle WHERE NOT present)
  SELECT p.f,
         (SELECT string_agg(c.nature || ' ' || c.a || CASE WHEN c.b <> '' THEN '.' || c.b ELSE '' END, ', ')
            FROM controle c WHERE c.migration = p.f AND NOT c.present)
    INTO _first, _detail
    FROM premiere p;

  IF _first IS NULL THEN
    RAISE NOTICE 'Aucune mise à jour manquante.';
    RETURN;
  END IF;

  IF _first < '20260929110000_phase12_creer_demande' THEN
    RAISE EXCEPTION 'Mise à jour ancienne manquante : % (%). Rien n''a été modifié : envoie une capture de ce message.',
      _first, left(_detail, 300);
  END IF;

  RAISE NOTICE 'Rattrapage à partir de : %', _first;
  IF '20260929110000_phase12_creer_demande' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260929110000_phase12_creer_demande';
    EXECUTE $m001$
-- Phase 12 / Étape 12.1 — Créer une demande de contact.
-- Une demande de contact est envoyée par un membre à un autre membre avec qui il n'a pas
-- encore de Match, avec un court message facultatif. Le destinataire pourra l'accepter
-- ou la refuser (étape 12.2).
-- - Table `contact_requests` : lisible uniquement par l'expéditeur et le destinataire ;
--   aucune écriture directe (tout passe par les fonctions serveur) ; date fixée par le
--   serveur ; une seule demande en attente par couple expéditeur → destinataire.
-- - `send_contact_request(_receiver_id, _message)` : membre connecté pouvant consulter
--   les profils, destinataire visible et actif, jamais soi-même, aucun blocage, pas de
--   Match actif entre eux ; message facultatif de 300 caractères au plus, sans numéro de
--   téléphone. Renvoie `{ "id", "status": "sent" | "already_pending" }`.
--   Refus : `not_authenticated`, `profile_unavailable`, `self_request`, `already_matched`,
--   `message_too_long`, `phone_number_detected`.

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT contact_requests_no_self CHECK (sender_id <> receiver_id),
  CONSTRAINT contact_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  CONSTRAINT contact_requests_message_length
    CHECK (message IS NULL OR char_length(message) BETWEEN 1 AND 300)
);

CREATE UNIQUE INDEX IF NOT EXISTS contact_requests_one_pending
  ON public.contact_requests (sender_id, receiver_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS contact_requests_receiver_idx
  ON public.contact_requests (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_requests_sender_idx
  ON public.contact_requests (sender_id, created_at DESC);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.contact_requests TO authenticated;
GRANT ALL ON public.contact_requests TO service_role;

DROP POLICY IF EXISTS contact_requests_select_parties ON public.contact_requests;
CREATE POLICY contact_requests_select_parties ON public.contact_requests
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE OR REPLACE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_message, '')), '');
  _existing uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _receiver_id IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _receiver_id = _me THEN
    RAISE EXCEPTION 'self_request' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_receiver_id)
     OR public.is_blocked_between(_me, _receiver_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.status = 'active'
      AND m.user_1_id = least(_me, _receiver_id)
      AND m.user_2_id = greatest(_me, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_matched' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 300 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = '22023';
  END IF;

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
  END IF;

  INSERT INTO public.contact_requests (sender_id, receiver_id, message)
  VALUES (_me, _receiver_id, _text)
  ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT r.id INTO _id FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
    RETURN jsonb_build_object('id', _id, 'status', 'already_pending');
  END IF;
  RETURN jsonb_build_object('id', _id, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION public.send_contact_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid, text) TO authenticated, service_role;

$m001$;
  END IF;
  IF '20260930100000_phase12_repondre_quota_demandes' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930100000_phase12_repondre_quota_demandes';
    EXECUTE $m002$
-- Phase 12 / Étapes 12.2 à 12.6 — Demandes de contact : enregistrement, réponse et quota.
--
-- 12.2 — Enregistrer la demande : la demande créée à l'étape 12.1 a maintenant un cycle
--        de vie complet, entièrement contrôlé par le serveur :
--        - `respond_contact_request(_request_id, _accept)` : seul le destinataire répond ;
--          accepter crée le Match (et donc la conversation, par le déclencheur existant),
--          refuser clôt la demande ;
--        - `cancel_contact_request(_request_id)` : seul l'expéditeur annule sa demande ;
--        - `list_contact_requests(_direction)` : demandes reçues ou envoyées, avec le
--          prénom, l'âge et la ville de l'autre membre (profils encore visibles, sans
--          blocage) ;
--        - après un refus, l'expéditeur ne peut pas relancer la même personne pendant
--          30 jours (`recently_declined`).
-- 12.3 — Limite gratuite : 5 demandes envoyées par jour (jour calendaire UTC). Une
--        demande compte dès son envoi, même annulée ou refusée ensuite ; une demande
--        « déjà en attente » ne compte pas. Refus : `daily_limit_reached`.
-- 12.4 — `get_contact_request_quota()` : demandes utilisées, limite, restantes et heure de
--        remise à zéro, pour l'affichage.
-- 12.5 — Premium : aucune limite (abonnement vérifié par `is_premium`).
-- 12.6 — Protection serveur : le quota est compté dans la fonction serveur, sous un verrou
--        par membre (des envois simultanés ne peuvent pas dépasser la limite) ; aucune
--        écriture directe sur la table n'est possible (étape 12.1).

-- Début du jour UTC courant (base du quota journalier).
CREATE OR REPLACE FUNCTION public.utc_day_start()
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT date_trunc('day', now(), 'UTC')
$$;

CREATE INDEX IF NOT EXISTS contact_requests_sender_day_idx
  ON public.contact_requests (sender_id, created_at);

-- Quota de demandes de contact de la personne connectée (lecture seule).
CREATE OR REPLACE FUNCTION public.get_contact_request_quota()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_contact_request_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_request_quota() TO authenticated, service_role;

-- Envoi d'une demande (étape 12.1) + quota journalier (12.3, 12.5, 12.6) + délai après refus.
CREATE OR REPLACE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_message, '')), '');
  _existing uuid;
  _id uuid;
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _receiver_id IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _receiver_id = _me THEN
    RAISE EXCEPTION 'self_request' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_receiver_id)
     OR public.is_blocked_between(_me, _receiver_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.status = 'active'
      AND m.user_1_id = least(_me, _receiver_id)
      AND m.user_2_id = greatest(_me, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_matched' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 300 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = '22023';
  END IF;

  -- 12.6 : un seul envoi à la fois par membre (le comptage ci-dessous reste exact même
  -- avec des envois simultanés).
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_request:' || _me::text, 0));

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
  END IF;

  -- Respect d'un refus récent : pas de relance pendant 30 jours.
  IF EXISTS (
    SELECT 1 FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'declined'
      AND r.responded_at > now() - interval '30 days'
  ) THEN
    RAISE EXCEPTION 'recently_declined' USING ERRCODE = 'P0001';
  END IF;

  -- 12.3 / 12.5 : 5 demandes par jour en gratuit, illimité en Premium.
  _premium := public.is_premium(_me);
  IF NOT _premium THEN
    SELECT count(*)::integer INTO _used FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
    IF _used >= 5 THEN
      RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.contact_requests (sender_id, receiver_id, message)
  VALUES (_me, _receiver_id, _text)
  ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT r.id INTO _id FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
    RETURN jsonb_build_object('id', _id, 'status', 'already_pending');
  END IF;
  RETURN jsonb_build_object('id', _id, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION public.send_contact_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid, text) TO authenticated, service_role;

-- 12.2 : réponse du destinataire. Accepter crée le Match (la conversation suit).
CREATE OR REPLACE FUNCTION public.respond_contact_request(_request_id uuid, _accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _r public.contact_requests%ROWTYPE;
  _a uuid;
  _b uuid;
  _match uuid;
  _conversation uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _accept IS NULL THEN
    RAISE EXCEPTION 'invalid_response' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _r FROM public.contact_requests r WHERE r.id = _request_id FOR UPDATE;
  IF NOT FOUND OR _r.receiver_id <> _me THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _r.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;

  IF NOT _accept THEN
    UPDATE public.contact_requests SET status = 'declined', responded_at = now()
    WHERE id = _r.id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_r.sender_id)
     OR public.is_blocked_between(_me, _r.sender_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;

  _a := least(_me, _r.sender_id);
  _b := greatest(_me, _r.sender_id);
  -- Même verrou que la création d'un Match par Like réciproque (pas de doublon).
  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  INSERT INTO public.matches (user_1_id, user_2_id)
  VALUES (_a, _b)
  ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
    WHERE public.matches.status = 'unmatched';

  SELECT m.id INTO _match FROM public.matches m
  WHERE m.user_1_id = _a AND m.user_2_id = _b AND m.status = 'active';
  IF _match IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  SELECT c.id INTO _conversation FROM public.conversations c WHERE c.match_id = _match;

  -- Les demandes en attente entre les deux membres (dans les deux sens) sont acceptées.
  UPDATE public.contact_requests r SET status = 'accepted', responded_at = now()
  WHERE r.status = 'pending'
    AND ((r.sender_id = _r.sender_id AND r.receiver_id = _me)
      OR (r.sender_id = _me AND r.receiver_id = _r.sender_id));

  RETURN jsonb_build_object('status', 'accepted', 'match_id', _match,
    'conversation_id', _conversation);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_contact_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_contact_request(uuid, boolean) TO authenticated, service_role;

-- 12.2 : annulation par l'expéditeur (la demande reste comptée dans le quota du jour).
CREATE OR REPLACE FUNCTION public.cancel_contact_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _r public.contact_requests%ROWTYPE;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _r FROM public.contact_requests r WHERE r.id = _request_id FOR UPDATE;
  IF NOT FOUND OR _r.sender_id <> _me THEN
    RAISE EXCEPTION 'request_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _r.status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contact_requests SET status = 'cancelled', responded_at = now()
  WHERE id = _r.id;
  RETURN jsonb_build_object('status', 'cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_contact_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_contact_request(uuid) TO authenticated, service_role;

-- 12.2 : demandes reçues (`received`) ou envoyées (`sent`), les plus récentes d'abord.
-- Seules les demandes dont l'autre membre est encore visible et sans blocage sont listées.
CREATE OR REPLACE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received')
RETURNS TABLE (
  id uuid,
  other_user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
         r.status, r.created_at, r.responded_at
  FROM public.contact_requests r
  JOIN public.profiles o
    ON o.user_id = CASE WHEN _direction = 'received' THEN r.sender_id ELSE r.receiver_id END
  WHERE (CASE WHEN _direction = 'received' THEN r.receiver_id ELSE r.sender_id END) = _me
    AND public.is_discoverable_profile(o.user_id)
    AND NOT public.is_blocked_between(_me, o.user_id)
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.list_contact_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contact_requests(text) TO authenticated, service_role;

$m002$;
  END IF;
  IF '20260930110000_phase13_roi_salomon' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930110000_phase13_roi_salomon';
    EXECUTE $m003$
-- Phase 13 — Roi Salomon (assistant IA).
--
-- Le quota IA existait déjà (Phase 2 : table `ai_usage`, `consume_ai_quota`, `get_ai_quota`,
-- 3 questions/jour en gratuit, illimité en Premium). Cette migration le complète :
-- 13.4 / 13.8 — Les fonctionnalités IA acceptées sont limitées à une liste connue
--        (`roi_salomon`, `ice_breaker`) : impossible d'inventer une fonctionnalité pour
--        obtenir un quota neuf. Le quota se compte par jour calendaire UTC, sous verrou.
-- 13.9 — `refund_ai_quota(_user_id, _feature)` : si le fournisseur IA échoue après la
--        consommation d'une question, le serveur rend la question (rôle service
--        uniquement, jamais appelable depuis le navigateur).

CREATE OR REPLACE FUNCTION public.ai_usage_day()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'UTC')::date
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(_feature text DEFAULT 'roi_salomon')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := public.ai_usage_day();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF _feature IS NULL OR _feature NOT IN ('roi_salomon', 'ice_breaker') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_feature');
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'account_inactive');
  END IF;
  _premium := public.is_premium(_uid);
  INSERT INTO public.ai_usage (user_id, feature, usage_date, usage_count)
  VALUES (_uid, _feature, _day, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;
  -- Verrou de la ligne du jour : des questions simultanées sont comptées une par une.
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  FOR UPDATE;
  IF NOT _premium AND _used >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'used', _used,
      'limit', 3, 'remaining', 0, 'unlimited', false);
  END IF;
  UPDATE public.ai_usage SET usage_count = usage_count + 1
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  RETURNING usage_count INTO _used;
  RETURN jsonb_build_object('allowed', true, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_quota(_feature text DEFAULT 'roi_salomon')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.consume_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota(text) TO authenticated, service_role;

-- 13.9 : question rendue si le fournisseur IA a échoué (serveur uniquement).
CREATE OR REPLACE FUNCTION public.refund_ai_quota(_user_id uuid, _feature text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_usage SET usage_count = usage_count - 1
  WHERE user_id = _user_id AND feature = _feature AND usage_date = public.ai_usage_day()
    AND usage_count > 0
$$;

REVOKE ALL ON FUNCTION public.refund_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota(uuid, text) TO service_role;

-- La détection des numéros de téléphone (phase 6) est aussi appliquée aux questions posées
-- à l'IA : la fonction serveur de Roi Salomon l'appelle au nom de la personne connectée.
GRANT EXECUTE ON FUNCTION public.contains_phone_number(text) TO authenticated;

$m003$;
  END IF;
  IF '20260930120000_phase14_premium' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930120000_phase14_premium';
    EXECUTE $m004$
-- Phase 14 — Premium : paiement mensuel / annuel, activation, badge, expiration.
--
-- La table `subscriptions` et `is_premium` existent depuis la Phase 2. Cette migration ajoute :
-- 14.6 à 14.9 — `start_premium_payment(_plan, _provider)` : crée (ou réutilise) un paiement
--        « en attente » de type abonnement. Le montant est fixé ici par le serveur :
--        5 USD (500 cents) par mois, 35 USD (3 500 cents) par an. Jamais par le navigateur.
-- 14.10 / 14.11 — `activate_premium_subscription()` : quand un paiement d'abonnement passe
--        à « réussi » (fonction `confirm_payment`, rôle service, déjà existante), l'abonnement
--        est créé actif. S'il reste du temps sur un abonnement en cours, la nouvelle période
--        commence à sa fin (aucun jour perdu). Un paiement ne crée qu'un seul abonnement.
-- 14.12 — `get_premium_badges(_user_ids)` : parmi des membres visibles, lesquels ont le badge
--        Premium (abonnement actif). N'expose rien d'autre (ni formule, ni dates).
-- 14.13 — Expiration : `is_premium` compare déjà les dates (expiration exacte, automatique).
--        `expire_subscriptions()` met aussi le statut « expiré » (historique, admin), toutes
--        les 5 minutes via pg_cron quand il est disponible.
--        `get_my_premium()` renvoie l'état de la personne connectée (formule, date de fin
--        de la période continue) pour l'affichage.
-- Paiement : le prestataire `stripe` est accepté en plus de `test` (voir
-- src/features/payments/stripe.server.ts) pour les abonnements et les déblocages.

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_payment_unique
  ON public.subscriptions (payment_id) WHERE payment_id IS NOT NULL;

-- Montant d'une formule, en cents USD (source de vérité serveur).
CREATE OR REPLACE FUNCTION public.premium_plan_amount(_plan public.subscription_plan)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _plan WHEN 'premium_monthly' THEN 500 WHEN 'premium_yearly' THEN 3500 END
$$;

CREATE OR REPLACE FUNCTION public.start_premium_payment(_plan public.subscription_plan, _provider text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'invalid_plan' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;

  -- Un paiement en attente récent pour la même formule est réutilisé (double clic).
  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid AND p.type = 'subscription' AND p.status = 'pending'
    AND p.provider = _provider AND p.metadata->>'plan' = _plan::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (_uid, 'subscription', public.premium_plan_amount(_plan), 'USD', _provider, 'pending',
      jsonb_build_object('plan', _plan))
    RETURNING id INTO _payment;
  END IF;
  RETURN _payment;
END;
$$;

REVOKE ALL ON FUNCTION public.start_premium_payment(public.subscription_plan, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_premium_payment(public.subscription_plan, text) TO authenticated, service_role;

-- Activation de l'abonnement après paiement confirmé.
CREATE OR REPLACE FUNCTION public.activate_premium_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan public.subscription_plan;
  _start timestamptz;
BEGIN
  IF NEW.type <> 'subscription' OR NEW.status <> 'succeeded' OR OLD.status = 'succeeded' THEN
    RETURN NEW;
  END IF;
  BEGIN
    _plan := (NEW.metadata->>'plan')::public.subscription_plan;
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;
  IF _plan IS NULL OR NEW.amount <> public.premium_plan_amount(_plan) THEN
    RETURN NEW;
  END IF;

  -- Verrou par membre : deux activations simultanées se suivent.
  PERFORM pg_advisory_xact_lock(hashtextextended('premium:' || NEW.user_id::text, 0));

  SELECT greatest(now(), coalesce(max(s.expires_at), now())) INTO _start
  FROM public.subscriptions s
  WHERE s.user_id = NEW.user_id AND s.status = 'active' AND s.expires_at > now();

  INSERT INTO public.subscriptions
    (user_id, plan, amount, currency, status, starts_at, expires_at, payment_id)
  VALUES
    (NEW.user_id, _plan, NEW.amount, NEW.currency, 'active', _start,
     _start + CASE WHEN _plan = 'premium_yearly' THEN interval '1 year' ELSE interval '1 month' END,
     NEW.id)
  ON CONFLICT (payment_id) WHERE payment_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_activate_premium ON public.payments;
CREATE TRIGGER payments_activate_premium
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.activate_premium_subscription();

-- is_premium : une période qui commence plus tard (renouvellement anticipé) ne compte
-- qu'à partir de son début ; inchangé sinon.
CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  )
$$;

-- État Premium de la personne connectée (affichage de la page /premium).
CREATE OR REPLACE FUNCTION public.get_my_premium()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_my_premium() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_premium() TO authenticated, service_role;

-- 14.12 : badge Premium des membres visibles (ou de soi-même).
CREATE OR REPLACE FUNCTION public.get_premium_badges(_user_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.get_premium_badges(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_premium_badges(uuid[]) TO authenticated, service_role;

-- 14.13 : statut « expiré » pour l'historique.
CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
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

REVOKE EXECUTE ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_subscriptions() TO service_role;

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

-- Déblocage de conversation : le prestataire `stripe` est aussi accepté.
CREATE OR REPLACE FUNCTION public.start_conversation_unlock_payment(_conversation_id uuid, _provider text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv public.conversations%ROWTYPE;
  _payment uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF _provider IS NULL OR _provider NOT IN ('test', 'stripe') THEN
    RAISE EXCEPTION 'payment_provider_unavailable' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _conv FROM public.conversations c WHERE c.id = _conversation_id FOR UPDATE;
  IF NOT FOUND OR _uid NOT IN (_conv.user_1_id, _conv.user_2_id)
     OR _conv.status <> 'open'
     OR NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.id = _conv.match_id AND m.status = 'active')
  THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  IF public.has_active_conversation_unlock(_conv.id) THEN
    RAISE EXCEPTION 'unlock_already_active' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id INTO _payment
  FROM public.payments p
  WHERE p.user_id = _uid
    AND p.type = 'conversation_unlock'
    AND p.status = 'pending'
    AND p.provider = _provider
    AND p.metadata->>'conversation_id' = _conv.id::text
    AND p.created_at > now() - interval '1 hour'
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF _payment IS NULL THEN
    INSERT INTO public.payments (user_id, type, amount, currency, provider, status, metadata)
    VALUES (
      _uid, 'conversation_unlock', 100, 'USD', _provider, 'pending',
      jsonb_build_object('conversation_id', _conv.id, 'duration_days', 3)
    )
    RETURNING id INTO _payment;
  END IF;

  RETURN _payment;
END;
$$;

$m004$;
  END IF;
  IF '20260930130000_phase15_avantages_premium' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930130000_phase15_avantages_premium';
    EXECUTE $m005$
-- Phase 15 — Avantages Premium.
--
-- Déjà en place (vérifié, rien à refaire) :
--   15.1 demandes illimitées (phase 12), 15.2 Roi Salomon illimité (phase 13),
--   15.3 favoris entrants (phase 8), 15.4 visiteurs (phase 9), 15.8 présence (phase 10),
--   15.13 filtres avancés (phase 11), 15.15 badge (phase 14).
--   15.9, 15.10 et 15.11 sont réalisées dans les phases 16, 17 et 18.
-- Cette migration ajoute :
--   15.5  10 photos + HD : verrou contre les ajouts simultanés ; en gratuit, photo de
--         2 Mo au plus (l'application la réduit à 1 280 px) ; en Premium, jusqu'à 5 Mo.
--   15.6  Messagerie illimitée : `send_message` ne décompte plus rien pour un Premium ;
--         `get_message_quota` renvoie `premium`.
--   15.7  Messages vocaux : colonnes `kind`, `audio_path`, `audio_duration_seconds`,
--         stockage privé « voice-messages », `send_voice_message` (Premium uniquement).
--   15.12 Meilleur classement : profils boostés, puis Premium, en tête de Découvrir et
--         de la Recherche.
--   15.14 Boosts : table `profile_boosts`, `activate_profile_boost` (1 heure, une fois
--         tous les 7 jours, Premium), `get_my_boost`.
--   15.16 Support prioritaire : table `support_tickets`, `create_support_ticket`
--         (priorité « prioritaire » pour les Premium).

-- Correction : la détection de numéro reste réservée au serveur (règle de la phase 6).
-- Les fonctions serveur de l'IA l'appellent avec le rôle service.
REVOKE EXECUTE ON FUNCTION public.contains_phone_number(text) FROM authenticated;

-- ============================================================
-- 15.5 — Photos : limite 3 / 10 et HD
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_photo_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Un fichier déjà enregistré ne peut plus être remplacé (l'application ne le fait
-- jamais) : sinon une photo validée pourrait être échangée contre une autre.
DROP POLICY IF EXISTS photos_storage_update_own ON storage.objects;

-- ============================================================
-- 15.14 — Boosts de profil
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_boosts_period CHECK (expires_at > starts_at)
);
CREATE INDEX IF NOT EXISTS profile_boosts_user_idx ON public.profile_boosts (user_id, expires_at DESC);
ALTER TABLE public.profile_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profile_boosts_select_own ON public.profile_boosts;
CREATE POLICY profile_boosts_select_own ON public.profile_boosts
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.profile_boosts FROM anon, authenticated;
GRANT SELECT ON public.profile_boosts TO authenticated;

CREATE OR REPLACE FUNCTION public.is_boosted(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _user_id AND b.starts_at <= now() AND b.expires_at > now()
  ) AND public.is_premium(_user_id)
$$;
REVOKE ALL ON FUNCTION public.is_boosted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_boosted(uuid) TO authenticated, service_role;

-- État du boost de la personne connectée : actif jusqu'à, prochain boost possible le.
CREATE OR REPLACE FUNCTION public.get_my_boost()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.get_my_boost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_boost() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_profile_boost()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _end timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('boost:' || _uid::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.profile_boosts b
    WHERE b.user_id = _uid AND b.starts_at > now() - interval '7 days'
  ) THEN
    RAISE EXCEPTION 'boost_cooldown' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.profile_boosts (user_id, starts_at, expires_at)
  VALUES (_uid, now(), now() + interval '1 hour')
  RETURNING expires_at INTO _end;
  RETURN _end;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_profile_boost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_profile_boost() TO authenticated, service_role;

-- ============================================================
-- 15.12 — Meilleur classement (Découvrir)
-- ============================================================
CREATE OR REPLACE FUNCTION public.discover_profiles(_limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  bio text,
  gender public.gender,
  interests text[]
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p.user_id, p.first_name, p.birth_date, p.city, p.country, p.bio, p.gender, p.interests
  FROM public.profiles p
  LEFT JOIN public.preferences pr ON pr.user_id = auth.uid()
  WHERE p.user_id <> auth.uid()
    AND p.status = 'active' AND p.visibility = 'visible'
    AND (pr.preferred_gender IS NULL OR p.gender = pr.preferred_gender)
    AND (
      pr.user_id IS NULL OR (
        p.birth_date <= (current_date - make_interval(years => pr.min_age))::date
        AND p.birth_date > (current_date - make_interval(years => pr.max_age + 1))::date
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.likes l
      WHERE l.sender_id = auth.uid() AND l.receiver_id = p.user_id AND l.status = 'active'
    )
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;
REVOKE EXECUTE ON FUNCTION public.discover_profiles(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer) TO authenticated, service_role;

-- 15.12 — Meilleur classement (Recherche) : même fonction qu'en phase 11, seul l'ordre change.
CREATE OR REPLACE FUNCTION public.search_profiles(_filters jsonb DEFAULT '{}'::jsonb, _limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  bio text,
  gender public.gender,
  interests text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _f jsonb := coalesce(_filters, '{}'::jsonb);
  _key text;
  _min int;
  _max int;
  _gender public.gender;
  _country text;
  _city text;
  _distance int;
  _my_lat double precision;
  _my_lng double precision;
  _marital text[];
  _children boolean;
  _denomination text;
  _commitment text;
  _goal text;
  _family text;
  _interests text[];
  _active_days int;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city', 'max_distance_km', 'marital_status', 'has_children',
                    'denomination', 'faith_commitment', 'relationship_goal', 'family_project',
                    'interests', 'active_within_days') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = _key;
    END IF;
  END LOOP;

  -- Âge
  IF _f ? 'min_age' THEN
    IF jsonb_typeof(_f->'min_age') <> 'number' OR (_f->>'min_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'min_age';
    END IF;
    _min := (_f->>'min_age')::int;
  END IF;
  IF _f ? 'max_age' THEN
    IF jsonb_typeof(_f->'max_age') <> 'number' OR (_f->>'max_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_age';
    END IF;
    _max := (_f->>'max_age')::int;
  END IF;
  IF (_min IS NOT NULL AND (_min < 18 OR _min > 99))
     OR (_max IS NOT NULL AND (_max < 18 OR _max > 99))
     OR (_min IS NOT NULL AND _max IS NOT NULL AND _min > _max) THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'age';
  END IF;

  -- Sexe : « female » ou « male » (texte) ; absent = indifférent.
  IF _f ? 'gender' THEN
    IF jsonb_typeof(_f->'gender') <> 'string' OR (_f->>'gender') NOT IN ('female', 'male') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'gender';
    END IF;
    _gender := (_f->>'gender')::public.gender;
  END IF;

  -- Pays : texte de 1 à 100 caractères ; comparaison exacte sans tenir compte des
  -- majuscules, accents, tirets, apostrophes ni espaces multiples.
  IF _f ? 'country' THEN
    IF jsonb_typeof(_f->'country') <> 'string'
       OR char_length(btrim(_f->>'country')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'country';
    END IF;
    _country := public.normalize_place(_f->>'country');
  END IF;

  -- Ville : texte de 1 à 100 caractères ; la ville du profil doit contenir le texte
  -- cherché, sans tenir compte des majuscules, accents, tirets, apostrophes ni espaces
  -- multiples (« yaounde » trouve « Yaoundé », « Douala 5e » est trouvé par « douala »).
  -- Les caractères spéciaux (%, _) sont du texte ordinaire.
  IF _f ? 'city' THEN
    IF jsonb_typeof(_f->'city') <> 'string'
       OR char_length(btrim(_f->>'city')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'city';
    END IF;
    _city := public.normalize_place(_f->>'city');
  END IF;

  -- Distance : rayon au choix parmi 5, 10, 25, 50, 100, 250 et 500 km, autour de la
  -- position enregistrée de la personne connectée (obligatoire : sinon refus
  -- `location_required`). Les profils sans position ne correspondent jamais.
  IF _f ? 'max_distance_km' THEN
    IF jsonb_typeof(_f->'max_distance_km') <> 'number'
       OR (_f->>'max_distance_km') NOT IN ('5', '10', '25', '50', '100', '250', '500') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_distance_km';
    END IF;
    _distance := (_f->>'max_distance_km')::int;
    SELECT l.latitude, l.longitude INTO _my_lat, _my_lng
    FROM public.profile_locations l WHERE l.user_id = _me;
    IF _my_lat IS NULL THEN
      RAISE EXCEPTION 'location_required' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Situation matrimoniale : liste (1 à 3 valeurs distinctes) parmi « never_married »,
  -- « divorced », « widowed » ; le profil doit avoir l'une d'elles.
  IF _f ? 'marital_status' THEN
    IF jsonb_typeof(_f->'marital_status') <> 'array'
       OR jsonb_array_length(_f->'marital_status') NOT BETWEEN 1 AND 3
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'marital_status') e
         WHERE jsonb_typeof(e) <> 'string' OR e #>> '{}' NOT IN ('never_married', 'divorced', 'widowed')
       )
       OR (SELECT count(DISTINCT e #>> '{}') FROM jsonb_array_elements(_f->'marital_status') e)
          <> jsonb_array_length(_f->'marital_status') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'marital_status';
    END IF;
    SELECT array_agg(e #>> '{}') INTO _marital FROM jsonb_array_elements(_f->'marital_status') e;
  END IF;

  -- Enfants : true (a des enfants) ou false (sans enfant) ; les profils non précisés ne
  -- correspondent jamais.
  IF _f ? 'has_children' THEN
    IF jsonb_typeof(_f->'has_children') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'has_children';
    END IF;
    _children := (_f->>'has_children')::boolean;
  END IF;

  -- Dénomination : texte de 1 à 100 caractères ; la dénomination du profil doit le
  -- contenir (forme normalisée : sans majuscules, accents, tirets ni apostrophes).
  IF _f ? 'denomination' THEN
    IF jsonb_typeof(_f->'denomination') <> 'string'
       OR char_length(btrim(_f->>'denomination')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'denomination';
    END IF;
    _denomination := public.normalize_place(_f->>'denomination');
  END IF;

  -- Engagement chrétien (« Votre pratique chrétienne » du profil) : même règle que la
  -- dénomination (texte de 1 à 100 caractères, contenu, forme normalisée).
  IF _f ? 'faith_commitment' THEN
    IF jsonb_typeof(_f->'faith_commitment') <> 'string'
       OR char_length(btrim(_f->>'faith_commitment')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'faith_commitment';
    END IF;
    _commitment := public.normalize_place(_f->>'faith_commitment');
  END IF;

  -- Objectif relationnel (« Ce que vous recherchez », préférences du membre) : texte de
  -- 1 à 100 caractères ; l'objectif du profil doit le contenir (forme normalisée).
  IF _f ? 'relationship_goal' THEN
    IF jsonb_typeof(_f->'relationship_goal') <> 'string'
       OR char_length(btrim(_f->>'relationship_goal')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'relationship_goal';
    END IF;
    _goal := public.normalize_place(_f->>'relationship_goal');
  END IF;

  -- Projet familial (préférences du membre) : texte de 1 à 200 caractères ; le projet du
  -- profil doit le contenir (forme normalisée).
  IF _f ? 'family_project' THEN
    IF jsonb_typeof(_f->'family_project') <> 'string'
       OR char_length(btrim(_f->>'family_project')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'family_project';
    END IF;
    _family := public.normalize_place(_f->>'family_project');
  END IF;

  -- Centres d'intérêt : liste de 1 à 5 textes (1 à 40 caractères chacun) ; le profil doit
  -- avoir au moins l'un d'eux (comparaison exacte sur la forme normalisée).
  IF _f ? 'interests' THEN
    IF jsonb_typeof(_f->'interests') <> 'array'
       OR jsonb_array_length(_f->'interests') NOT BETWEEN 1 AND 5
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'interests') e
         WHERE jsonb_typeof(e) <> 'string' OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 40
       ) THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'interests';
    END IF;
    SELECT array_agg(DISTINCT public.normalize_place(e #>> '{}')) INTO _interests
    FROM jsonb_array_elements(_f->'interests') e;
  END IF;

  -- Filtre avancé (Premium) « Actif récemment » : dernière activité il y a moins de 1, 7
  -- ou 30 jours.
  IF _f ? 'active_within_days' THEN
    IF jsonb_typeof(_f->'active_within_days') <> 'number'
       OR (_f->>'active_within_days') NOT IN ('1', '7', '30') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'active_within_days';
    END IF;
    _active_days := (_f->>'active_within_days')::int;
  END IF;

  -- Filtres avancés : réservés aux membres Premium (abonnement actif). Le refus arrive
  -- après la validation des valeurs et avant toute lecture de profil.
  IF _active_days IS NOT NULL AND NOT public.is_premium(_me) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501', DETAIL = 'active_within_days';
  END IF;

  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.birth_date, p.city, p.country, p.bio, p.gender, p.interests
  FROM public.profiles p
  WHERE p.user_id <> _me
    AND public.is_discoverable_profile(p.user_id)
    AND NOT public.is_blocked_between(_me, p.user_id)
    AND (_min IS NULL OR p.birth_date <= (current_date - make_interval(years => _min))::date)
    AND (_max IS NULL OR p.birth_date > (current_date - make_interval(years => _max + 1))::date)
    AND (_gender IS NULL OR p.gender = _gender)
    AND (_country IS NULL OR public.normalize_place(p.country) = _country)
    AND (_city IS NULL OR strpos(coalesce(public.normalize_place(p.city), ''), _city) > 0)
    AND (_marital IS NULL OR p.marital_status = ANY (_marital))
    AND (_children IS NULL OR p.has_children = _children)
    AND (_denomination IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.denomination), ''), _denomination) > 0
    ))
    AND (_commitment IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.faith_commitment), ''), _commitment) > 0
    ))
    AND (_goal IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.relationship_goal), ''), _goal) > 0
    ))
    AND (_family IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.family_project), ''), _family) > 0
    ))
    AND (_active_days IS NULL OR EXISTS (
      SELECT 1 FROM public.user_activity a
      WHERE a.user_id = p.user_id
        AND a.last_seen_at > now() - make_interval(days => _active_days)
    ))
    AND (_interests IS NULL OR EXISTS (
      SELECT 1 FROM unnest(p.interests) i WHERE public.normalize_place(i) = ANY (_interests)
    ))
    AND (_distance IS NULL OR EXISTS (
      SELECT 1 FROM public.profile_locations l
      WHERE l.user_id = p.user_id
        AND public.distance_km(_my_lat, _my_lng, l.latitude, l.longitude) <= _distance
    ))
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;

-- ============================================================
-- 15.6 / 15.7 — Messagerie illimitée et messages vocaux
-- ============================================================
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS audio_path text,
  ADD COLUMN IF NOT EXISTS audio_duration_seconds integer;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_kind_valid;
ALTER TABLE public.messages ADD CONSTRAINT messages_kind_valid CHECK (
  (kind = 'text' AND audio_path IS NULL AND audio_duration_seconds IS NULL)
  OR (kind = 'voice' AND audio_path IS NOT NULL
      AND audio_duration_seconds BETWEEN 1 AND 120)
);

-- Stockage privé des messages vocaux : dossier « conversation / expéditeur / fichier ».
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('voice-messages', 'voice-messages', false, 2097152,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 2097152,
    allowed_mime_types = ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

-- Participant d'une conversation désignée par le texte de son identifiant (dossier).
CREATE OR REPLACE FUNCTION public.is_conversation_folder_participant(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = _folder AND auth.uid() IN (c.user_1_id, c.user_2_id)
  )
$$;
REVOKE ALL ON FUNCTION public.is_conversation_folder_participant(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_folder_participant(text) TO authenticated, service_role;

DROP POLICY IF EXISTS voice_storage_insert_premium ON storage.objects;
CREATE POLICY voice_storage_insert_premium ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND public.is_conversation_folder_participant((storage.foldername(name))[1])
    AND public.is_premium(auth.uid())
  );
DROP POLICY IF EXISTS voice_storage_select_participant ON storage.objects;
CREATE POLICY voice_storage_select_participant ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND (public.is_conversation_folder_participant((storage.foldername(name))[1]) OR public.is_admin())
  );
DROP POLICY IF EXISTS voice_storage_delete_own ON storage.objects;
CREATE POLICY voice_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-messages' AND (storage.foldername(name))[2] = auth.uid()::text);

-- Contrôles communs à l'envoi d'un message (texte ou vocal). Verrouille la conversation.
CREATE OR REPLACE FUNCTION public.lock_conversation_for_sending(_uid uuid, _conversation_id uuid)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.lock_conversation_for_sending(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_message(_conversation_id uuid, _content text)
 RETURNS TABLE(id uuid, conversation_id uuid, sender_id uuid, content text, status message_status, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _text text;
  _conv public.conversations%ROWTYPE;
  _msg public.messages%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  _text := regexp_replace(coalesce(_content, ''), '^\s+|\s+$', '', 'g');
  IF char_length(_text) = 0 THEN
    RAISE EXCEPTION 'message_empty' USING ERRCODE = '22023';
  END IF;
  IF char_length(_text) > 4000 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;

  -- Étape 6.7 : un message contenant un numéro de téléphone est refusé avant toute
  -- écriture : rien n'est enregistré, le quota de messages gratuits n'est pas consommé.
  IF public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = 'P0001';
  END IF;

  -- Participant, conversation ouverte, Match actif, blocage, profils (verrou inclus).
  _conv := public.lock_conversation_for_sending(_uid, _conversation_id);

  -- Étape 7.9 : déblocage en cours = illimité. Étape 15.6 : Premium = illimité.
  -- Dans ces deux cas, le quota gratuit n'est ni vérifié ni consommé.
  IF NOT public.has_active_conversation_unlock(_conv.id) AND NOT public.is_premium(_uid) THEN
    INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
    VALUES (_conv.id, _uid, 0)
    ON CONFLICT ON CONSTRAINT conversation_user_usage_conversation_id_user_id_key DO NOTHING;
    -- Étape 5.5 : au-delà de 3 messages dans cette conversation, l'envoi est refusé.
    UPDATE public.conversation_user_usage u
       SET free_messages_used = u.free_messages_used + 1
     WHERE u.conversation_id = _conv.id AND u.user_id = _uid
       AND u.free_messages_used < 3;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'free_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content, status, created_at)
  VALUES (_conv.id, _uid, _text, 'delivered', clock_timestamp())
  RETURNING * INTO _msg;

  UPDATE public.conversations c
     SET last_message_at = greatest(coalesce(c.last_message_at, _msg.created_at), _msg.created_at)
   WHERE c.id = _conv.id;

  RETURN QUERY SELECT _msg.id, _msg.conversation_id, _msg.sender_id, _msg.content, _msg.status, _msg.created_at;
END;
$function$;

-- 15.7 : message vocal (Premium). Le fichier est d'abord déposé dans le stockage privé
-- (règles ci-dessus), puis enregistré ici comme message de la conversation.
CREATE OR REPLACE FUNCTION public.send_voice_message(
  _conversation_id uuid,
  _audio_path text,
  _duration_seconds integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _conv public.conversations%ROWTYPE;
  _id uuid;
  _at timestamptz := clock_timestamp();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_premium(_uid) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;
  IF _duration_seconds IS NULL OR _duration_seconds < 1 OR _duration_seconds > 120 THEN
    RAISE EXCEPTION 'voice_invalid_duration' USING ERRCODE = '22023';
  END IF;
  -- Le fichier doit être celui de l'expéditeur, dans le dossier de cette conversation.
  IF _audio_path IS NULL
     OR _audio_path NOT LIKE _conversation_id::text || '/' || _uid::text || '/%'
     OR NOT EXISTS (
       SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'voice-messages' AND o.name = _audio_path
     )
     OR EXISTS (SELECT 1 FROM public.messages m WHERE m.audio_path = _audio_path)
  THEN
    RAISE EXCEPTION 'voice_file_invalid' USING ERRCODE = '22023';
  END IF;

  _conv := public.lock_conversation_for_sending(_uid, _conversation_id);

  INSERT INTO public.messages
    (conversation_id, sender_id, content, status, created_at, kind, audio_path, audio_duration_seconds)
  VALUES (_conv.id, _uid, 'Message vocal', 'delivered', _at, 'voice', _audio_path, _duration_seconds)
  RETURNING id INTO _id;

  UPDATE public.conversations c
     SET last_message_at = greatest(coalesce(c.last_message_at, _at), _at)
   WHERE c.id = _conv.id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_voice_message(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_voice_message(uuid, text, integer) TO authenticated, service_role;

-- 15.6 : le quota indique si la personne est Premium (messages illimités).
DROP FUNCTION IF EXISTS public.get_message_quota(uuid);

CREATE FUNCTION public.get_message_quota(_conversation_id uuid)
 RETURNS TABLE(used integer, quota_limit integer, remaining integer, exhausted boolean, unlocked boolean, unlocked_by uuid, unlock_expires_at timestamp with time zone, last_unlock_expired_at timestamp with time zone, premium boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_message_quota(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_message_quota(uuid) TO authenticated, service_role;

-- ============================================================
-- 15.16 — Support prioritaire
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 3 AND 120),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 4000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'priority')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  admin_reply text CHECK (admin_reply IS NULL OR char_length(admin_reply) <= 4000),
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_queue_idx
  ON public.support_tickets (status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS support_tickets_select_own ON public.support_tickets;
CREATE POLICY support_tickets_select_own ON public.support_tickets
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.support_tickets FROM anon, authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;

CREATE OR REPLACE FUNCTION public.create_support_ticket(_subject text, _message text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.create_support_ticket(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text) TO authenticated, service_role;

$m005$;
  END IF;
  IF '20260930150000_phase17_message_flash' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930150000_phase17_message_flash';
    EXECUTE $m006$
-- Phase 17 — Message Flash.
-- 17.1 — Un Flash est une demande de contact mise en avant : colonne `is_flash`.
-- 17.2 / 17.3 — `send_contact_request(_receiver_id, _message, _flash)` : le Flash est
--        réservé au Premium (vérifié ici) et demande un message (300 caractères au plus,
--        protection téléphone). Toutes les autres règles de la phase 12 s'appliquent.
-- 17.4 — `list_contact_requests` renvoie `is_flash` ; les Flash en attente sont en tête.

ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS is_flash boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.send_contact_request(uuid, text);
CREATE FUNCTION public.send_contact_request(_receiver_id uuid, _message text DEFAULT NULL, _flash boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_message, '')), '');
  _existing uuid;
  _id uuid;
  _premium boolean;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _receiver_id IS NULL THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '22023';
  END IF;
  IF _receiver_id = _me THEN
    RAISE EXCEPTION 'self_request' USING ERRCODE = '22023';
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_receiver_id)
     OR public.is_blocked_between(_me, _receiver_id) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.status = 'active'
      AND m.user_1_id = least(_me, _receiver_id)
      AND m.user_2_id = greatest(_me, _receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_matched' USING ERRCODE = '22023';
  END IF;
  -- 17.3 : Message Flash réservé au Premium, avec un message obligatoire.
  IF coalesce(_flash, false) THEN
    IF NOT public.is_premium(_me) THEN
      RAISE EXCEPTION 'flash_premium_required' USING ERRCODE = '42501';
    END IF;
    IF _text IS NULL THEN
      RAISE EXCEPTION 'flash_message_required' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 300 THEN
    RAISE EXCEPTION 'message_too_long' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND public.contains_phone_number(_text) THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = '22023';
  END IF;

  -- 12.6 : un seul envoi à la fois par membre (le comptage ci-dessous reste exact même
  -- avec des envois simultanés).
  PERFORM pg_advisory_xact_lock(hashtextextended('contact_request:' || _me::text, 0));

  SELECT r.id INTO _existing FROM public.contact_requests r
  WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
  IF _existing IS NOT NULL THEN
    RETURN jsonb_build_object('id', _existing, 'status', 'already_pending');
  END IF;

  -- Respect d'un refus récent : pas de relance pendant 30 jours.
  IF EXISTS (
    SELECT 1 FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'declined'
      AND r.responded_at > now() - interval '30 days'
  ) THEN
    RAISE EXCEPTION 'recently_declined' USING ERRCODE = 'P0001';
  END IF;

  -- 12.3 / 12.5 : 5 demandes par jour en gratuit, illimité en Premium.
  _premium := public.is_premium(_me);
  IF NOT _premium THEN
    SELECT count(*)::integer INTO _used FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.created_at >= public.utc_day_start();
    IF _used >= 5 THEN
      RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.contact_requests (sender_id, receiver_id, message, is_flash)
  VALUES (_me, _receiver_id, _text, coalesce(_flash, false))
  ON CONFLICT (sender_id, receiver_id) WHERE status = 'pending' DO NOTHING
  RETURNING id INTO _id;
  IF _id IS NULL THEN
    SELECT r.id INTO _id FROM public.contact_requests r
    WHERE r.sender_id = _me AND r.receiver_id = _receiver_id AND r.status = 'pending';
    RETURN jsonb_build_object('id', _id, 'status', 'already_pending');
  END IF;
  RETURN jsonb_build_object('id', _id, 'status', 'sent');
END;
$$;

REVOKE ALL ON FUNCTION public.send_contact_request(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid, text, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.list_contact_requests(text);
CREATE FUNCTION public.list_contact_requests(_direction text DEFAULT 'received')
RETURNS TABLE (
  id uuid,
  other_user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  message text,
  status text,
  created_at timestamptz,
  responded_at timestamptz,
  is_flash boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.list_contact_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_contact_requests(text) TO authenticated, service_role;

$m006$;
  END IF;
  IF '20260930160000_phase18_compatibilite' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930160000_phase18_compatibilite';
    EXECUTE $m007$
-- Phase 18 — Compatibilité.
-- 18.1 — Données utilisées (déjà saisies dans le profil) : dénomination, importance de la
--        foi, fréquentation de l'église, prière, valeurs chrétiennes, intérêts, objectif
--        relationnel, projet familial, âges recherchés, pays.
-- 18.2 — `compatibility_breakdown(_me, _other)` (interne) : chaque critère renseigné des
--        deux côtés rapporte des points ; le score est le pourcentage obtenu sur les
--        critères comparables. Aucun critère comparable : pas de score.
--        Choix : calcul par règles explicables, dans la base (instantané, gratuit, sans
--        envoyer de données personnelles à un service d'IA).
-- 18.3 / 18.4 — `get_compatibility(_other)` : score, niveau et explication courte pour tous.
-- 18.5 — Le détail critère par critère n'est renvoyé qu'aux membres Premium.
--        `get_compatibility_scores(_user_ids)` : scores seuls, pour les listes de profils.

CREATE OR REPLACE FUNCTION public.compatibility_breakdown(_me uuid, _other uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p1 public.profiles%ROWTYPE;
  p2 public.profiles%ROWTYPE;
  c1 public.christian_profiles%ROWTYPE;
  c2 public.christian_profiles%ROWTYPE;
  f1 public.preferences%ROWTYPE;
  f2 public.preferences%ROWTYPE;
  _details jsonb := '[]'::jsonb;
  _points numeric := 0;
  _max numeric := 0;
  _common text[];
  _age1 integer;
  _age2 integer;
  _pts numeric;
  _score integer;
BEGIN
  SELECT * INTO p1 FROM public.profiles WHERE user_id = _me;
  SELECT * INTO p2 FROM public.profiles WHERE user_id = _other;
  SELECT * INTO c1 FROM public.christian_profiles WHERE user_id = _me;
  SELECT * INTO c2 FROM public.christian_profiles WHERE user_id = _other;
  SELECT * INTO f1 FROM public.preferences WHERE user_id = _me;
  SELECT * INTO f2 FROM public.preferences WHERE user_id = _other;

  -- Critère « même réponse » : ajoute une ligne de détail et les points.
  -- (répété pour chaque champ texte comparable)
  IF nullif(btrim(c1.denomination), '') IS NOT NULL AND nullif(btrim(c2.denomination), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.denomination)) = lower(btrim(c2.denomination)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'denomination', 'label', 'Dénomination',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même dénomination : ' || c2.denomination
                   ELSE 'Dénominations différentes' END);
  END IF;
  IF nullif(btrim(c1.faith_importance), '') IS NOT NULL AND nullif(btrim(c2.faith_importance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.faith_importance)) = lower(btrim(c2.faith_importance)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'faith_importance', 'label', 'Place de la foi',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'La foi a la même place dans vos vies'
                   ELSE 'La foi n''a pas tout à fait la même place' END);
  END IF;
  IF nullif(btrim(c1.church_attendance), '') IS NOT NULL AND nullif(btrim(c2.church_attendance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.church_attendance)) = lower(btrim(c2.church_attendance)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'church_attendance', 'label', 'Église',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même rythme de fréquentation de l''église'
                   ELSE 'Rythmes de fréquentation de l''église différents' END);
  END IF;
  IF nullif(btrim(c1.prayer_practice), '') IS NOT NULL AND nullif(btrim(c2.prayer_practice), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.prayer_practice)) = lower(btrim(c2.prayer_practice)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'prayer', 'label', 'Prière',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pratique de la prière'
                   ELSE 'Pratiques de la prière différentes' END);
  END IF;

  -- Valeurs chrétiennes et intérêts : points selon le nombre d'éléments en commun (3 = maximum).
  IF cardinality(c1.christian_values) > 0 AND cardinality(c2.christian_values) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(c2.christian_values) v
    WHERE lower(v) IN (SELECT lower(x) FROM unnest(c1.christian_values) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'values', 'label', 'Valeurs chrétiennes',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' valeur(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Aucune valeur en commun indiquée' END);
  END IF;
  IF cardinality(p1.interests) > 0 AND cardinality(p2.interests) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(p2.interests) v
    WHERE public.normalize_place(v) IN (SELECT public.normalize_place(x) FROM unnest(p1.interests) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'interests', 'label', 'Centres d''intérêt',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' intérêt(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Pas d''intérêt en commun' END);
  END IF;

  IF nullif(btrim(f1.relationship_goal), '') IS NOT NULL AND nullif(btrim(f2.relationship_goal), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.relationship_goal)) = lower(btrim(f2.relationship_goal)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'goal', 'label', 'Objectif',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Vous cherchez le même type de relation'
                   ELSE 'Objectifs de relation différents' END);
  END IF;
  IF nullif(btrim(f1.family_project), '') IS NOT NULL AND nullif(btrim(f2.family_project), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.family_project)) = lower(btrim(f2.family_project)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'family', 'label', 'Projet familial',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même projet familial'
                   ELSE 'Projets familiaux différents' END);
  END IF;

  -- Âges : chacun est-il dans la tranche d'âge recherchée par l'autre ?
  IF f1.user_id IS NOT NULL AND f2.user_id IS NOT NULL
     AND p1.birth_date IS NOT NULL AND p2.birth_date IS NOT NULL THEN
    _age1 := extract(year FROM age(p1.birth_date))::integer;
    _age2 := extract(year FROM age(p2.birth_date))::integer;
    _pts := (CASE WHEN _age2 BETWEEN f1.min_age AND f1.max_age THEN 5 ELSE 0 END)
          + (CASE WHEN _age1 BETWEEN f2.min_age AND f2.max_age THEN 5 ELSE 0 END);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'age', 'label', 'Âges recherchés',
      'points', _pts, 'max', 10, 'matched', _pts = 10,
      'note', CASE WHEN _pts = 10 THEN 'Chacun correspond à l''âge recherché par l''autre'
                   WHEN _pts = 5 THEN 'Un seul de vous correspond à l''âge recherché par l''autre'
                   ELSE 'Vos âges ne correspondent pas aux tranches recherchées' END);
  END IF;

  IF nullif(p1.country, '') IS NOT NULL AND nullif(p2.country, '') IS NOT NULL THEN
    _pts := CASE WHEN public.normalize_place(p1.country) = public.normalize_place(p2.country) THEN 5 ELSE 0 END;
    _points := _points + _pts; _max := _max + 5;
    _details := _details || jsonb_build_object('key', 'country', 'label', 'Pays',
      'points', _pts, 'max', 5, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pays : ' || p2.country ELSE 'Pays différents' END);
  END IF;

  IF _max = 0 THEN
    RETURN jsonb_build_object('score', NULL, 'details', '[]'::jsonb);
  END IF;
  _score := round(100 * _points / _max);
  RETURN jsonb_build_object('score', _score, 'details', _details);
END;
$$;
REVOKE ALL ON FUNCTION public.compatibility_breakdown(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Profil qu'un membre a le droit de voir (hors lui-même).
CREATE OR REPLACE FUNCTION public.can_view_profile(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND _other IS NOT NULL AND _other <> auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(_other)
    AND NOT public.is_blocked_between(auth.uid(), _other)
$$;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_compatibility(_other uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.get_compatibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compatibility(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_compatibility_scores(_user_ids uuid[])
RETURNS TABLE (user_id uuid, score integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u, (public.compatibility_breakdown(auth.uid(), u)->>'score')::integer
  FROM (SELECT DISTINCT unnest(_user_ids[1:60]) AS u) ids
  WHERE public.can_view_profile(u)
$$;
REVOKE ALL ON FUNCTION public.get_compatibility_scores(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compatibility_scores(uuid[]) TO authenticated, service_role;

$m007$;
  END IF;
  IF '20260930170000_phase19_notifications' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930170000_phase19_notifications';
    EXECUTE $m008$
-- Phase 19 — Notifications.
-- 19.1 — Table `notifications` (destinataire, type, auteur, données), lecture limitée au
--        destinataire, aucune écriture directe. `create_notification` (interne) crée ou
--        regroupe une notification ; elle ignore les membres bloqués entre eux.
-- 19.2 à 19.7 — Déclencheurs : Like reçu, Match (les deux membres), nouveau message
--        (regroupé par conversation tant qu'il n'est pas lu), ajout en favori, visite du
--        profil, demande de contact (Flash compris).
-- 19.8 — `get_unread_notification_count()`.
-- 19.9 — `mark_notification_read(_id)` et `mark_all_notifications_read()`.
-- Confidentialité : pour « favori » et « visite », l'auteur n'est révélé qu'aux membres
-- Premium (même règle que les pages Favoris et Visiteurs) — `list_notifications`.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'match', 'message', 'favorite', 'visit', 'contact_request')),
  actor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx ON public.notifications (user_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.notifications FROM anon, authenticated;
GRANT SELECT ON public.notifications TO authenticated;

-- Préférence de notification (remplacée en phase 20 par les réglages du membre).
CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- Crée une notification ; `_group_key` : une notification non lue de même type et même
-- clé est rafraîchie (compteur + date) au lieu d'en créer une nouvelle.
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid, _type text, _actor_id uuid, _data jsonb, _group_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.create_notification(uuid, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;

-- 19.2 — Like reçu (pas les « Pass »).
CREATE OR REPLACE FUNCTION public.notify_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'like' AND NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.receiver_id, 'like', NEW.sender_id, '{}'::jsonb,
      'like:' || NEW.sender_id::text);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS likes_notify ON public.likes;
CREATE TRIGGER likes_notify AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_like();

-- 19.3 — Match : les deux membres sont prévenus.
CREATE OR REPLACE FUNCTION public.notify_match()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM public.create_notification(NEW.user_1_id, 'match', NEW.user_2_id,
      jsonb_build_object('match_id', NEW.id));
    PERFORM public.create_notification(NEW.user_2_id, 'match', NEW.user_1_id,
      jsonb_build_object('match_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS matches_notify ON public.matches;
CREATE TRIGGER matches_notify AFTER INSERT ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.notify_match();

-- 19.4 — Nouveau message livré (regroupé par conversation).
CREATE OR REPLACE FUNCTION public.notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
DROP TRIGGER IF EXISTS messages_notify ON public.messages;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_message();

-- 19.5 — Ajout en favori.
CREATE OR REPLACE FUNCTION public.notify_favorite()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.favorite_user_id, 'favorite', NEW.user_id, '{}'::jsonb,
    'favorite:' || NEW.user_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS favorites_notify ON public.favorites;
CREATE TRIGGER favorites_notify AFTER INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.notify_favorite();

-- 19.6 — Visite du profil (les visites sont déjà limitées contre le spam).
CREATE OR REPLACE FUNCTION public.notify_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.visited_user_id, 'visit', NEW.visitor_id, '{}'::jsonb,
    'visit:' || NEW.visitor_id::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_visits_notify ON public.profile_visits;
CREATE TRIGGER profile_visits_notify AFTER INSERT ON public.profile_visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_visit();

-- 19.7 — Demande de contact (et Message Flash).
CREATE OR REPLACE FUNCTION public.notify_contact_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(NEW.receiver_id, 'contact_request', NEW.sender_id,
    jsonb_build_object('request_id', NEW.id, 'is_flash', NEW.is_flash));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contact_requests_notify ON public.contact_requests;
CREATE TRIGGER contact_requests_notify AFTER INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_request();

REVOKE ALL ON FUNCTION public.notify_like(), public.notify_match(), public.notify_message(),
  public.notify_favorite(), public.notify_visit(), public.notify_contact_request()
  FROM PUBLIC, anon, authenticated;

-- Liste des notifications de la personne connectée (auteur masqué si nécessaire).
CREATE OR REPLACE FUNCTION public.list_notifications(_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  type text,
  actor_id uuid,
  actor_first_name text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.list_notifications(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_notifications(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.notifications n
  WHERE n.user_id = auth.uid() AND n.read_at IS NULL
    AND (n.actor_id IS NULL OR NOT public.is_blocked_between(auth.uid(), n.actor_id))
$$;
REVOKE ALL ON FUNCTION public.get_unread_notification_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_read(_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.mark_notification_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;

$m008$;
  END IF;
  IF '20260930180000_phase20_parametres' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930180000_phase20_parametres';
    EXECUTE $m009$
-- Phase 20 — Paramètres (/settings).
-- 20.1 — Table `user_settings` (une ligne par membre, créée au premier enregistrement ;
--        sans ligne, les valeurs par défaut s'appliquent). Lecture et écriture par le
--        membre lui-même uniquement.
-- 20.2 — Visibilité du profil : colonne existante `profiles.visibility` (phase 1).
-- 20.3 — Visibilité de l'activité : si elle est masquée, `get_presence` renvoie
--        « inconnu » aux autres et le filtre « actif depuis » de la Recherche l'ignore.
-- 20.4 à 20.7 — Préférences de notifications : e-mail (enregistrée ; l'envoi d'e-mails
--        demande un service d'e-mail non configuré), messages, Match, Like.
--        `wants_notification` les applique aux notifications de la phase 19.
-- 20.8 / 20.9 — Mot de passe et suppression du compte : dans l'application (Supabase Auth
--        et fonction serveur avec le rôle service).

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  activity_visible boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT true,
  notify_messages boolean NOT NULL DEFAULT true,
  notify_matches boolean NOT NULL DEFAULT true,
  notify_likes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_insert_own ON public.user_settings;
CREATE POLICY user_settings_insert_own ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS user_settings_update_own ON public.user_settings;
CREATE POLICY user_settings_update_own ON public.user_settings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE DELETE ON public.user_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
DROP TRIGGER IF EXISTS user_settings_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_activity_visible(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT s.activity_visible FROM public.user_settings s WHERE s.user_id = _user_id), true)
$$;
REVOKE ALL ON FUNCTION public.is_activity_visible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_activity_visible(uuid) TO authenticated, service_role;

-- 20.5 à 20.7 : préférences appliquées aux notifications (favori, visite et demande de
-- contact restent toujours actives : elles n'ont pas de réglage dans le cahier des charges).
CREATE OR REPLACE FUNCTION public.wants_notification(_user_id uuid, _type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE _type
    WHEN 'message' THEN coalesce(s.notify_messages, true)
    WHEN 'match' THEN coalesce(s.notify_matches, true)
    WHEN 'like' THEN coalesce(s.notify_likes, true)
    ELSE true
  END
  FROM (SELECT 1) one
  LEFT JOIN public.user_settings s ON s.user_id = _user_id
$$;
REVOKE ALL ON FUNCTION public.wants_notification(uuid, text) FROM PUBLIC, anon, authenticated;

-- 20.3 : présence masquée si le membre cache son activité.
CREATE OR REPLACE FUNCTION public.get_presence(_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 20.3 : Recherche — même fonction qu'en phase 15, filtre « actif depuis » ajusté.
CREATE OR REPLACE FUNCTION public.search_profiles(_filters jsonb DEFAULT '{}'::jsonb, _limit integer DEFAULT 30)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  bio text,
  gender public.gender,
  interests text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _f jsonb := coalesce(_filters, '{}'::jsonb);
  _key text;
  _min int;
  _max int;
  _gender public.gender;
  _country text;
  _city text;
  _distance int;
  _my_lat double precision;
  _my_lng double precision;
  _marital text[];
  _children boolean;
  _denomination text;
  _commitment text;
  _goal text;
  _family text;
  _interests text[];
  _active_days int;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_f) <> 'object' THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023';
  END IF;
  FOR _key IN SELECT jsonb_object_keys(_f) LOOP
    IF _key NOT IN ('min_age', 'max_age', 'gender', 'country', 'city', 'max_distance_km', 'marital_status', 'has_children',
                    'denomination', 'faith_commitment', 'relationship_goal', 'family_project',
                    'interests', 'active_within_days') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = _key;
    END IF;
  END LOOP;

  -- Âge
  IF _f ? 'min_age' THEN
    IF jsonb_typeof(_f->'min_age') <> 'number' OR (_f->>'min_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'min_age';
    END IF;
    _min := (_f->>'min_age')::int;
  END IF;
  IF _f ? 'max_age' THEN
    IF jsonb_typeof(_f->'max_age') <> 'number' OR (_f->>'max_age') !~ '^\d+$' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_age';
    END IF;
    _max := (_f->>'max_age')::int;
  END IF;
  IF (_min IS NOT NULL AND (_min < 18 OR _min > 99))
     OR (_max IS NOT NULL AND (_max < 18 OR _max > 99))
     OR (_min IS NOT NULL AND _max IS NOT NULL AND _min > _max) THEN
    RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'age';
  END IF;

  -- Sexe : « female » ou « male » (texte) ; absent = indifférent.
  IF _f ? 'gender' THEN
    IF jsonb_typeof(_f->'gender') <> 'string' OR (_f->>'gender') NOT IN ('female', 'male') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'gender';
    END IF;
    _gender := (_f->>'gender')::public.gender;
  END IF;

  -- Pays : texte de 1 à 100 caractères ; comparaison exacte sans tenir compte des
  -- majuscules, accents, tirets, apostrophes ni espaces multiples.
  IF _f ? 'country' THEN
    IF jsonb_typeof(_f->'country') <> 'string'
       OR char_length(btrim(_f->>'country')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'country';
    END IF;
    _country := public.normalize_place(_f->>'country');
  END IF;

  -- Ville : texte de 1 à 100 caractères ; la ville du profil doit contenir le texte
  -- cherché, sans tenir compte des majuscules, accents, tirets, apostrophes ni espaces
  -- multiples (« yaounde » trouve « Yaoundé », « Douala 5e » est trouvé par « douala »).
  -- Les caractères spéciaux (%, _) sont du texte ordinaire.
  IF _f ? 'city' THEN
    IF jsonb_typeof(_f->'city') <> 'string'
       OR char_length(btrim(_f->>'city')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'city';
    END IF;
    _city := public.normalize_place(_f->>'city');
  END IF;

  -- Distance : rayon au choix parmi 5, 10, 25, 50, 100, 250 et 500 km, autour de la
  -- position enregistrée de la personne connectée (obligatoire : sinon refus
  -- `location_required`). Les profils sans position ne correspondent jamais.
  IF _f ? 'max_distance_km' THEN
    IF jsonb_typeof(_f->'max_distance_km') <> 'number'
       OR (_f->>'max_distance_km') NOT IN ('5', '10', '25', '50', '100', '250', '500') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'max_distance_km';
    END IF;
    _distance := (_f->>'max_distance_km')::int;
    SELECT l.latitude, l.longitude INTO _my_lat, _my_lng
    FROM public.profile_locations l WHERE l.user_id = _me;
    IF _my_lat IS NULL THEN
      RAISE EXCEPTION 'location_required' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Situation matrimoniale : liste (1 à 3 valeurs distinctes) parmi « never_married »,
  -- « divorced », « widowed » ; le profil doit avoir l'une d'elles.
  IF _f ? 'marital_status' THEN
    IF jsonb_typeof(_f->'marital_status') <> 'array'
       OR jsonb_array_length(_f->'marital_status') NOT BETWEEN 1 AND 3
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'marital_status') e
         WHERE jsonb_typeof(e) <> 'string' OR e #>> '{}' NOT IN ('never_married', 'divorced', 'widowed')
       )
       OR (SELECT count(DISTINCT e #>> '{}') FROM jsonb_array_elements(_f->'marital_status') e)
          <> jsonb_array_length(_f->'marital_status') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'marital_status';
    END IF;
    SELECT array_agg(e #>> '{}') INTO _marital FROM jsonb_array_elements(_f->'marital_status') e;
  END IF;

  -- Enfants : true (a des enfants) ou false (sans enfant) ; les profils non précisés ne
  -- correspondent jamais.
  IF _f ? 'has_children' THEN
    IF jsonb_typeof(_f->'has_children') <> 'boolean' THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'has_children';
    END IF;
    _children := (_f->>'has_children')::boolean;
  END IF;

  -- Dénomination : texte de 1 à 100 caractères ; la dénomination du profil doit le
  -- contenir (forme normalisée : sans majuscules, accents, tirets ni apostrophes).
  IF _f ? 'denomination' THEN
    IF jsonb_typeof(_f->'denomination') <> 'string'
       OR char_length(btrim(_f->>'denomination')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'denomination';
    END IF;
    _denomination := public.normalize_place(_f->>'denomination');
  END IF;

  -- Engagement chrétien (« Votre pratique chrétienne » du profil) : même règle que la
  -- dénomination (texte de 1 à 100 caractères, contenu, forme normalisée).
  IF _f ? 'faith_commitment' THEN
    IF jsonb_typeof(_f->'faith_commitment') <> 'string'
       OR char_length(btrim(_f->>'faith_commitment')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'faith_commitment';
    END IF;
    _commitment := public.normalize_place(_f->>'faith_commitment');
  END IF;

  -- Objectif relationnel (« Ce que vous recherchez », préférences du membre) : texte de
  -- 1 à 100 caractères ; l'objectif du profil doit le contenir (forme normalisée).
  IF _f ? 'relationship_goal' THEN
    IF jsonb_typeof(_f->'relationship_goal') <> 'string'
       OR char_length(btrim(_f->>'relationship_goal')) NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'relationship_goal';
    END IF;
    _goal := public.normalize_place(_f->>'relationship_goal');
  END IF;

  -- Projet familial (préférences du membre) : texte de 1 à 200 caractères ; le projet du
  -- profil doit le contenir (forme normalisée).
  IF _f ? 'family_project' THEN
    IF jsonb_typeof(_f->'family_project') <> 'string'
       OR char_length(btrim(_f->>'family_project')) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'family_project';
    END IF;
    _family := public.normalize_place(_f->>'family_project');
  END IF;

  -- Centres d'intérêt : liste de 1 à 5 textes (1 à 40 caractères chacun) ; le profil doit
  -- avoir au moins l'un d'eux (comparaison exacte sur la forme normalisée).
  IF _f ? 'interests' THEN
    IF jsonb_typeof(_f->'interests') <> 'array'
       OR jsonb_array_length(_f->'interests') NOT BETWEEN 1 AND 5
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(_f->'interests') e
         WHERE jsonb_typeof(e) <> 'string' OR char_length(btrim(e #>> '{}')) NOT BETWEEN 1 AND 40
       ) THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'interests';
    END IF;
    SELECT array_agg(DISTINCT public.normalize_place(e #>> '{}')) INTO _interests
    FROM jsonb_array_elements(_f->'interests') e;
  END IF;

  -- Filtre avancé (Premium) « Actif récemment » : dernière activité il y a moins de 1, 7
  -- ou 30 jours.
  IF _f ? 'active_within_days' THEN
    IF jsonb_typeof(_f->'active_within_days') <> 'number'
       OR (_f->>'active_within_days') NOT IN ('1', '7', '30') THEN
      RAISE EXCEPTION 'invalid_filter' USING ERRCODE = '22023', DETAIL = 'active_within_days';
    END IF;
    _active_days := (_f->>'active_within_days')::int;
  END IF;

  -- Filtres avancés : réservés aux membres Premium (abonnement actif). Le refus arrive
  -- après la validation des valeurs et avant toute lecture de profil.
  IF _active_days IS NOT NULL AND NOT public.is_premium(_me) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501', DETAIL = 'active_within_days';
  END IF;

  IF NOT public.can_browse_profiles() THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.birth_date, p.city, p.country, p.bio, p.gender, p.interests
  FROM public.profiles p
  WHERE p.user_id <> _me
    AND public.is_discoverable_profile(p.user_id)
    AND NOT public.is_blocked_between(_me, p.user_id)
    AND (_min IS NULL OR p.birth_date <= (current_date - make_interval(years => _min))::date)
    AND (_max IS NULL OR p.birth_date > (current_date - make_interval(years => _max + 1))::date)
    AND (_gender IS NULL OR p.gender = _gender)
    AND (_country IS NULL OR public.normalize_place(p.country) = _country)
    AND (_city IS NULL OR strpos(coalesce(public.normalize_place(p.city), ''), _city) > 0)
    AND (_marital IS NULL OR p.marital_status = ANY (_marital))
    AND (_children IS NULL OR p.has_children = _children)
    AND (_denomination IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.denomination), ''), _denomination) > 0
    ))
    AND (_commitment IS NULL OR EXISTS (
      SELECT 1 FROM public.christian_profiles cp
      WHERE cp.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(cp.faith_commitment), ''), _commitment) > 0
    ))
    AND (_goal IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.relationship_goal), ''), _goal) > 0
    ))
    AND (_family IS NULL OR EXISTS (
      SELECT 1 FROM public.preferences pr
      WHERE pr.user_id = p.user_id
        AND strpos(coalesce(public.normalize_place(pr.family_project), ''), _family) > 0
    ))
    AND (_active_days IS NULL OR EXISTS (
      SELECT 1 FROM public.user_activity a
      WHERE a.user_id = p.user_id
        AND a.last_seen_at > now() - make_interval(days => _active_days)
    ))
    AND (_interests IS NULL OR EXISTS (
      SELECT 1 FROM unnest(p.interests) i WHERE public.normalize_place(i) = ANY (_interests)
    ))
    AND (_distance IS NULL OR EXISTS (
      SELECT 1 FROM public.profile_locations l
      WHERE l.user_id = p.user_id
        AND public.distance_km(_my_lat, _my_lng, l.latitude, l.longitude) <= _distance
    ))
    -- 20.3 : un membre qui masque son activité n'apparaît pas dans le filtre « actif depuis ».
    AND (_active_days IS NULL OR public.is_activity_visible(p.user_id))
  -- 15.12 : profils boostés, puis Premium, puis les plus récents.
  ORDER BY public.is_boosted(p.user_id) DESC, public.is_premium(p.user_id) DESC, p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50);
END;
$$;

REVOKE ALL ON FUNCTION public.search_profiles(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(jsonb, integer) TO authenticated, service_role;

$m009$;
  END IF;
  IF '20260930190000_phase21_22_blocage_signalement' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930190000_phase21_22_blocage_signalement';
    EXECUTE $m010$
-- Phases 21 et 22 — Blocage et signalement.
--
-- Déjà en place : table `blocks` et `is_blocked_between`, appliqués à Découvrir, la
-- Recherche, les profils, les photos, les demandes de contact et l'envoi de messages.
-- 21.1 / 21.2 — `block_user(_user_id)` enregistre le blocage (idempotent) et, en même
--        temps : Match et conversation fermés (« bloqué »), demandes en attente annulées,
--        favoris retirés dans les deux sens.
-- 21.3 — Masquer : les listes (Matches, messages, favoris, visiteurs, notifications)
--        ignorent les membres bloqués ; `list_blocked_users` pour les Paramètres.
-- 21.4 / 21.5 — Interactions et messagerie : Like, favori, visite, demande et message
--        refusés entre membres bloqués (contrôles serveur ci-dessous et existants).
--        `unblock_user` retire le blocage (le Match fermé n'est pas rouvert).
-- 22.1 à 22.5 — `report_user(_user_id, _reason, _description, _message_id)` : profil ou
--        message, motif obligatoire (liste fermée), description facultative (2 000
--        caractères), enregistré « ouvert » pour la modération. Le message signalé doit
--        venir de la personne signalée, dans une conversation du signaleur. 10
--        signalements par jour au plus ; un signalement identique encore ouvert n'est
--        pas dupliqué. L'écriture directe dans `reports` est retirée.

-- ============================================================
-- Phase 21 — Blocage
-- ============================================================
CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _user_id = _me THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id) VALUES (_me, _user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  UPDATE public.matches m SET status = 'blocked'
  WHERE m.user_1_id = least(_me, _user_id) AND m.user_2_id = greatest(_me, _user_id)
    AND m.status = 'active';
  UPDATE public.conversations c SET status = 'closed'
  WHERE c.user_1_id = least(_me, _user_id) AND c.user_2_id = greatest(_me, _user_id)
    AND c.status <> 'closed';
  UPDATE public.contact_requests r SET status = 'cancelled', responded_at = now()
  WHERE r.status = 'pending'
    AND ((r.sender_id = _me AND r.receiver_id = _user_id)
      OR (r.sender_id = _user_id AND r.receiver_id = _me));
  DELETE FROM public.favorites f
  WHERE (f.user_id = _me AND f.favorite_user_id = _user_id)
     OR (f.user_id = _user_id AND f.favorite_user_id = _me);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = _user_id;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated, service_role;

-- Les membres que j'ai bloqués (prénom seulement), pour les débloquer.
CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (user_id uuid, first_name text, blocked_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.blocked_id, p.first_name, b.created_at
  FROM public.blocks b
  LEFT JOIN public.profiles p ON p.user_id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_blocked_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_blocked_users() TO authenticated, service_role;

-- 21.4 : favoris et visites refusés entre membres bloqués (défense en profondeur :
-- les profils bloqués ne sont déjà plus visibles).
CREATE OR REPLACE FUNCTION public.refuse_blocked_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
REVOKE ALL ON FUNCTION public.refuse_blocked_interaction() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS favorites_refuse_blocked ON public.favorites;
CREATE TRIGGER favorites_refuse_blocked BEFORE INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
DROP TRIGGER IF EXISTS profile_visits_refuse_blocked ON public.profile_visits;
CREATE TRIGGER profile_visits_refuse_blocked BEFORE INSERT ON public.profile_visits
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();
DROP TRIGGER IF EXISTS likes_refuse_blocked ON public.likes;
CREATE TRIGGER likes_refuse_blocked BEFORE INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_interaction();

-- ============================================================
-- Phase 22 — Signalement
-- ============================================================
DROP POLICY IF EXISTS reports_insert_own ON public.reports;
REVOKE INSERT, UPDATE, DELETE ON public.reports FROM anon, authenticated;
GRANT SELECT ON public.reports TO authenticated;

CREATE OR REPLACE FUNCTION public.report_user(
  _user_id uuid,
  _reason public.report_reason,
  _description text DEFAULT NULL,
  _message_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_description, '')), '');
  _conv uuid;
  _id uuid;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _user_id = _me
     OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id) THEN
    RAISE EXCEPTION 'invalid_target' USING ERRCODE = '22023';
  END IF;
  IF _reason IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  IF _text IS NOT NULL AND char_length(_text) > 2000 THEN
    RAISE EXCEPTION 'description_too_long' USING ERRCODE = '22023';
  END IF;
  -- 22.2 : le message doit venir de la personne signalée, dans une conversation du signaleur.
  IF _message_id IS NOT NULL THEN
    SELECT m.conversation_id INTO _conv
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = _message_id AND m.sender_id = _user_id
      AND _me IN (c.user_1_id, c.user_2_id);
    IF _conv IS NULL THEN
      RAISE EXCEPTION 'invalid_message' USING ERRCODE = '22023';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('report:' || _me::text, 0));
  SELECT r.id INTO _id FROM public.reports r
  WHERE r.reporter_id = _me AND r.reported_user_id = _user_id
    AND r.message_id IS NOT DISTINCT FROM _message_id
    AND r.status IN ('open', 'reviewing');
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;
  IF (SELECT count(*) FROM public.reports r
      WHERE r.reporter_id = _me AND r.created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'report_daily_limit' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.reports (reporter_id, reported_user_id, conversation_id, message_id, reason, description)
  VALUES (_me, _user_id, _conv, _message_id, _reason, _text)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.report_user(uuid, public.report_reason, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_user(uuid, public.report_reason, text, uuid) TO authenticated, service_role;

$m010$;
  END IF;
  IF '20260930200000_phase23_administration' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930200000_phase23_administration';
    EXECUTE $m011$
-- Phase 23 — Administration (/admin).
-- Rôles USER / ADMIN : table `user_roles` et `is_admin()` existants (phase 0).
-- Toutes les fonctions ci-dessous vérifient `is_admin()` côté serveur : la page /admin
-- n'est qu'un affichage. Chaque action de modération est tracée dans
-- `moderation_actions` (qui, quoi, quand, pourquoi).
-- 23.3 / 23.4 — `admin_stats()` : chiffres du tableau de bord.
-- 23.5 / 23.6 — `admin_list_users(...)`, `admin_user_detail(_user_id)`.
-- 23.7 à 23.9 — `admin_set_user_status(_user_id, _action, _reason)` : suspendre,
--        réactiver, bannir (le blocage de la connexion est ajouté par la fonction
--        serveur avec le rôle service). Impossible sur soi-même ou un autre admin.
-- 23.10 / 23.11 — `admin_list_reports(_status)`, `admin_resolve_report(...)`.
-- Modération des photos : `admin_list_pending_photos()`, `admin_moderate_photo(...)`.
-- 23.12 à 23.14 — `admin_list_payments()`, `admin_list_subscriptions()`,
--        `admin_list_unlocks()`.
-- Support (phase 15.16) : `admin_list_support_tickets()`, `admin_reply_support_ticket(...)`.

CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO authenticated, service_role;

-- 23.3 / 23.4 — Tableau de bord.
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN jsonb_build_object(
    'users_total', (SELECT count(*) FROM public.users),
    'users_active', (SELECT count(*) FROM public.users WHERE status = 'active'),
    'users_suspended', (SELECT count(*) FROM public.users WHERE status = 'suspended'),
    'users_banned', (SELECT count(*) FROM public.users WHERE status = 'disabled'),
    'users_new_7d', (SELECT count(*) FROM public.users WHERE created_at > now() - interval '7 days'),
    'profiles_complete', (SELECT count(*) FROM public.profiles WHERE onboarding_completed_at IS NOT NULL),
    'premium_active', (SELECT count(DISTINCT user_id) FROM public.subscriptions
                       WHERE status = 'active' AND starts_at <= now() AND expires_at > now()),
    'matches_total', (SELECT count(*) FROM public.matches WHERE status = 'active'),
    'messages_7d', (SELECT count(*) FROM public.messages WHERE created_at > now() - interval '7 days'),
    'reports_open', (SELECT count(*) FROM public.reports WHERE status IN ('open', 'reviewing')),
    'photos_pending', (SELECT count(*) FROM public.photos WHERE status = 'pending'),
    'tickets_open', (SELECT count(*) FROM public.support_tickets WHERE status = 'open'),
    'revenue_cents', (SELECT coalesce(sum(amount), 0) FROM public.payments WHERE status = 'succeeded'),
    'revenue_30d_cents', (SELECT coalesce(sum(amount), 0) FROM public.payments
                          WHERE status = 'succeeded' AND created_at > now() - interval '30 days'),
    'unlocks_active', (SELECT count(*) FROM public.conversation_unlocks
                       WHERE status = 'active' AND starts_at <= now() AND expires_at > now())
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated, service_role;

-- 23.5 — Utilisateurs (recherche par e-mail ou prénom, filtre par statut).
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _search text DEFAULT NULL, _status text DEFAULT NULL, _limit integer DEFAULT 50, _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid, email text, first_name text, status public.account_status,
  profile_status public.profile_status, created_at timestamptz, premium boolean,
  is_admin boolean, reports_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q text := nullif(btrim(coalesce(_search, '')), '');
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT u.id, u.email, p.first_name, u.status, p.status, u.created_at,
         public.is_premium(u.id), public.has_role(u.id, 'admin'),
         (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = u.id)
  FROM public.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE (_q IS NULL OR u.email ILIKE '%' || _q || '%' OR p.first_name ILIKE '%' || _q || '%')
    AND (_status IS NULL OR u.status::text = _status)
  ORDER BY u.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200) OFFSET greatest(coalesce(_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, integer, integer) TO authenticated, service_role;

-- 23.6 — Détail d'un utilisateur.
CREATE OR REPLACE FUNCTION public.admin_user_detail(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN jsonb_build_object(
    'user', (SELECT to_jsonb(u) FROM public.users u WHERE u.id = _user_id),
    'profile', (SELECT to_jsonb(p) - 'latitude' - 'longitude' FROM public.profiles p WHERE p.user_id = _user_id),
    'is_admin', public.has_role(_user_id, 'admin'),
    'premium', public.is_premium(_user_id),
    'last_seen_at', (SELECT a.last_seen_at FROM public.user_activity a WHERE a.user_id = _user_id),
    'counts', jsonb_build_object(
      'matches', (SELECT count(*) FROM public.matches m WHERE _user_id IN (m.user_1_id, m.user_2_id)),
      'messages', (SELECT count(*) FROM public.messages m WHERE m.sender_id = _user_id),
      'likes_sent', (SELECT count(*) FROM public.likes l WHERE l.sender_id = _user_id AND l.kind = 'like'),
      'reports_received', (SELECT count(*) FROM public.reports r WHERE r.reported_user_id = _user_id),
      'reports_sent', (SELECT count(*) FROM public.reports r WHERE r.reporter_id = _user_id),
      'blocked_by', (SELECT count(*) FROM public.blocks b WHERE b.blocked_id = _user_id)
    ),
    'photos', coalesce((SELECT jsonb_agg(jsonb_build_object('id', ph.id, 'storage_path', ph.storage_path,
                        'status', ph.status, 'is_primary', ph.is_primary) ORDER BY ph.position, ph.created_at)
                        FROM public.photos ph WHERE ph.user_id = _user_id), '[]'::jsonb),
    'subscriptions', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC)
                        FROM public.subscriptions s WHERE s.user_id = _user_id), '[]'::jsonb),
    'payments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', py.id, 'type', py.type, 'amount', py.amount,
                        'currency', py.currency, 'provider', py.provider, 'status', py.status,
                        'created_at', py.created_at) ORDER BY py.created_at DESC)
                        FROM public.payments py WHERE py.user_id = _user_id), '[]'::jsonb),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason,
                        'description', r.description, 'status', r.status, 'created_at', r.created_at)
                        ORDER BY r.created_at DESC)
                        FROM public.reports r WHERE r.reported_user_id = _user_id), '[]'::jsonb),
    'moderation', coalesce((SELECT jsonb_agg(jsonb_build_object('action', ma.action, 'reason', ma.reason,
                        'admin_email', au.email, 'created_at', ma.created_at) ORDER BY ma.created_at DESC)
                        FROM public.moderation_actions ma
                        LEFT JOIN public.users au ON au.id = ma.admin_id
                        WHERE ma.target_user_id = _user_id), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated, service_role;

-- 23.7 à 23.9 — Suspendre, réactiver, bannir.
CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user_id uuid, _action text, _reason text DEFAULT NULL)
RETURNS public.account_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new public.account_status;
  _type public.moderation_action_type;
  _why text := nullif(btrim(coalesce(_reason, '')), '');
BEGIN
  PERFORM public.assert_admin();
  IF _user_id = auth.uid() OR public.has_role(_user_id, 'admin') THEN
    RAISE EXCEPTION 'cannot_moderate_admin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  CASE _action
    WHEN 'suspend' THEN _new := 'suspended'; _type := 'suspend';
    WHEN 'reactivate' THEN _new := 'active'; _type := 'unsuspend';
    WHEN 'ban' THEN _new := 'disabled'; _type := 'disable';
    ELSE RAISE EXCEPTION 'invalid_action' USING ERRCODE = '22023';
  END CASE;
  IF _action IN ('suspend', 'ban') AND _why IS NULL THEN
    RAISE EXCEPTION 'reason_required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.users SET status = _new, updated_at = now() WHERE id = _user_id;
  INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason)
  VALUES (auth.uid(), _user_id, _type, _why);
  RETURN _new;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_user_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text, text) TO authenticated, service_role;

-- 23.10 — Signalements.
CREATE OR REPLACE FUNCTION public.admin_list_reports(_status text DEFAULT NULL)
RETURNS TABLE (
  id uuid, reason public.report_reason, description text, status public.report_status,
  created_at timestamptz, reporter_id uuid, reporter_name text, reported_user_id uuid,
  reported_name text, reported_status public.account_status, message_id uuid, message_content text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT r.id, r.reason, r.description, r.status, r.created_at,
         r.reporter_id, rp.first_name, r.reported_user_id, tp.first_name, tu.status,
         r.message_id, m.content
  FROM public.reports r
  LEFT JOIN public.profiles rp ON rp.user_id = r.reporter_id
  LEFT JOIN public.profiles tp ON tp.user_id = r.reported_user_id
  LEFT JOIN public.users tu ON tu.id = r.reported_user_id
  LEFT JOIN public.messages m ON m.id = r.message_id
  WHERE _status IS NULL OR r.status::text = _status
  ORDER BY (r.status IN ('open', 'reviewing')) DESC, r.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_reports(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(text) TO authenticated, service_role;

-- 23.11 — Traiter un signalement (résolu ou rejeté), avec une note.
CREATE OR REPLACE FUNCTION public.admin_resolve_report(_report_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
BEGIN
  PERFORM public.assert_admin();
  IF _status NOT IN ('reviewing', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.reports SET status = _status::public.report_status
  WHERE id = _report_id RETURNING reported_user_id INTO _target;
  IF _target IS NULL THEN
    RAISE EXCEPTION 'report_not_found' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason, metadata)
  VALUES (auth.uid(), _target, 'note', nullif(btrim(coalesce(_note, '')), ''),
          jsonb_build_object('report_id', _report_id, 'report_status', _status));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, text, text) TO authenticated, service_role;

-- Modération des photos (« en attente » depuis la phase 1).
CREATE OR REPLACE FUNCTION public.admin_list_pending_photos()
RETURNS TABLE (id uuid, user_id uuid, first_name text, storage_path text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT ph.id, ph.user_id, p.first_name, ph.storage_path, ph.created_at
  FROM public.photos ph LEFT JOIN public.profiles p ON p.user_id = ph.user_id
  WHERE ph.status = 'pending'
  ORDER BY ph.created_at
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_pending_photos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_photos() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_moderate_photo(_photo_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS public.photo_status
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _new public.photo_status := CASE WHEN _approve THEN 'approved' ELSE 'rejected' END;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.photos SET status = _new WHERE id = _photo_id RETURNING user_id INTO _owner;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT _approve THEN
    INSERT INTO public.moderation_actions (admin_id, target_user_id, action, reason, metadata)
    VALUES (auth.uid(), _owner, 'delete_photo', nullif(btrim(coalesce(_reason, '')), ''),
            jsonb_build_object('photo_id', _photo_id));
  END IF;
  RETURN _new;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_moderate_photo(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_moderate_photo(uuid, boolean, text) TO authenticated, service_role;

-- 23.12 — Paiements.
CREATE OR REPLACE FUNCTION public.admin_list_payments()
RETURNS TABLE (
  id uuid, user_id uuid, email text, type public.payment_type, amount integer, currency text,
  provider text, status public.payment_status, provider_transaction_id text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT py.id, py.user_id, u.email, py.type, py.amount, py.currency, py.provider, py.status,
         py.provider_transaction_id, py.created_at
  FROM public.payments py LEFT JOIN public.users u ON u.id = py.user_id
  ORDER BY py.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_payments() TO authenticated, service_role;

-- 23.13 — Abonnements.
CREATE OR REPLACE FUNCTION public.admin_list_subscriptions()
RETURNS TABLE (
  id uuid, user_id uuid, email text, plan public.subscription_plan,
  status public.subscription_status, starts_at timestamptz, expires_at timestamptz, active_now boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT s.id, s.user_id, u.email, s.plan, s.status, s.starts_at, s.expires_at,
         (s.status = 'active' AND s.starts_at <= now() AND s.expires_at > now())
  FROM public.subscriptions s LEFT JOIN public.users u ON u.id = s.user_id
  ORDER BY s.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_subscriptions() TO authenticated, service_role;

-- 23.14 — Déblocages de conversation.
CREATE OR REPLACE FUNCTION public.admin_list_unlocks()
RETURNS TABLE (
  id uuid, conversation_id uuid, paid_by uuid, email text, status public.unlock_status,
  starts_at timestamptz, expires_at timestamptz, active_now boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT cu.id, cu.conversation_id, cu.paid_by_user_id, u.email, cu.status, cu.starts_at, cu.expires_at,
         (cu.status = 'active' AND cu.starts_at <= now() AND cu.expires_at > now())
  FROM public.conversation_unlocks cu LEFT JOIN public.users u ON u.id = cu.paid_by_user_id
  ORDER BY cu.created_at DESC
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_unlocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_unlocks() TO authenticated, service_role;

-- Support : demandes (prioritaires d'abord) et réponse.
CREATE OR REPLACE FUNCTION public.admin_list_support_tickets()
RETURNS TABLE (
  id uuid, user_id uuid, email text, first_name text, subject text, message text,
  priority text, status text, admin_reply text, created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT t.id, t.user_id, u.email, p.first_name, t.subject, t.message, t.priority, t.status,
         t.admin_reply, t.created_at
  FROM public.support_tickets t
  LEFT JOIN public.users u ON u.id = t.user_id
  LEFT JOIN public.profiles p ON p.user_id = t.user_id
  ORDER BY (t.status = 'open') DESC, (t.priority = 'priority') DESC, t.created_at
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_support_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_support_tickets() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(_ticket_id uuid, _reply text, _close boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _text text := nullif(btrim(coalesce(_reply, '')), '');
BEGIN
  PERFORM public.assert_admin();
  IF _text IS NULL OR char_length(_text) > 4000 THEN
    RAISE EXCEPTION 'invalid_reply' USING ERRCODE = '22023';
  END IF;
  UPDATE public.support_tickets
     SET admin_reply = _text, answered_at = now(), updated_at = now(),
         status = CASE WHEN _close THEN 'closed' ELSE 'answered' END
   WHERE id = _ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ticket_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_reply_support_ticket(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reply_support_ticket(uuid, text, boolean) TO authenticated, service_role;

$m011$;
  END IF;
  IF '20260930210000_phase24_securite_finale' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20260930210000_phase24_securite_finale';
    EXECUTE $m012$
-- Phase 24 — Sécurité finale.
-- Audit complet (script docs/verification/phase-24) : RLS active sur toutes les tables,
-- toutes les fonctions SECURITY DEFINER ont un search_path fixe, les fonctions internes
-- (déclencheurs, calcul, activation après paiement) ne sont pas appelables par l'API.
-- Seul écart trouvé : la fonction de déclencheur `activate_premium_subscription` restait
-- exécutable par tout le monde (sans effet réel, un déclencheur ne peut pas être appelé
-- directement, mais on retire le droit par principe).
REVOKE ALL ON FUNCTION public.activate_premium_subscription() FROM PUBLIC, anon, authenticated;

$m012$;
  END IF;
  IF '20261001090000_inscription_fluide' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20261001090000_inscription_fluide';
    EXECUTE $m013$
-- ============================================================
-- Nouvelle inscription (parcours en étapes, connexion Google)
--
-- Ajoute les quelques informations demandées par le nouveau parcours :
--   * profiles.region            : province / région (étape « Où es-tu ? »)
--   * profiles.origin            : origine (fenêtre « Complète ton profil »)
--   * profiles.terms_accepted_at : date d'acceptation des conditions (18 ans et plus)
--   * user_settings.marketing_emails : « Reste au courant » (e-mails d'actualité)
-- et une petite fonction publique pour l'écran d'accueil de l'inscription :
--   * recent_signups() : prénoms et pays des derniers membres inscrits et visibles
--     (aucune photo, aucune ville, aucun identifiant).
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_region_length,
  ADD CONSTRAINT profiles_region_length CHECK (region IS NULL OR char_length(region) <= 100),
  DROP CONSTRAINT IF EXISTS profiles_origin_length,
  ADD CONSTRAINT profiles_origin_length CHECK (origin IS NULL OR char_length(origin) <= 60);

-- La date d'acceptation ne peut pas être dans le futur ni être effacée une fois posée.
CREATE OR REPLACE FUNCTION public.protect_terms_accepted_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  ELSIF NEW.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := LEAST(NEW.terms_accepted_at, now());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_terms_accepted_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_protect_terms ON public.profiles;
CREATE TRIGGER profiles_protect_terms BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_terms_accepted_at();

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS marketing_emails boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recent_signups()
RETURNS TABLE (first_name text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(p.first_name, ' ', 1), p.country, p.created_at
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.visibility = 'visible'
    AND p.onboarding_completed_at IS NOT NULL
    AND p.first_name IS NOT NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 8;
$$;
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO anon, authenticated;

-- Connexion Google : Google envoie « full_name » / « name » (et parfois « given_name »)
-- au lieu de « first_name ». Le premier mot du nom sert alors de prénom de départ.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

$m013$;
  END IF;
  IF '20261001100000_inscription_derniers_inscrits_serveur' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20261001100000_inscription_derniers_inscrits_serveur';
    EXECUTE $m014$
-- ============================================================
-- Nouvelle inscription — bulle « … vient de s'inscrire »
--
-- Règle de sécurité 24.12 : aucune fonction SECURITY DEFINER ouverte aux visiteurs.
-- recent_signups() n'est donc plus appelable par anon / authenticated : le serveur de
-- l'application l'appelle avec le rôle service (getRecentSignups).
-- ============================================================
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;

$m014$;
  END IF;
  IF '20261002100000_profils_virtuels_et_verification' >= _first THEN
    RAISE NOTICE 'Mise à jour : %', '20261002100000_profils_virtuels_et_verification';
    EXECUTE $m015$
-- ============================================================
-- Profils virtuels et vérification du profil
--
-- 1. profiles.is_virtual : marque les profils d'exemple (fictifs). Seul le serveur
--    (migrations, rôle service, administrateurs) peut poser ou retirer ce marqueur ; un
--    membre ne peut jamais le changer, ni sur son profil ni sur un autre.
-- 2. geo_countries : position de chaque pays (remplie par la migration suivante), pour
--    trouver « le pays le plus proche ».
-- 3. À chaque inscription d'un VRAI membre (profil validé pour la première fois), un
--    profil virtuel est supprimé : du même pays (de préférence du même sexe), sinon du
--    pays le plus proche. Une seule fois par membre. Un échec ne bloque jamais
--    l'inscription. La suppression vise uniquement un compte marqué virtuel à la fois
--    dans le profil (is_virtual) et dans le compte (fournisseur « virtual »).
-- 4. recent_signups() : les profils virtuels n'apparaissent pas dans « derniers inscrits ».
-- 5. Vérification du profil : table profile_verifications, espace de stockage privé
--    « verifications » (le membre dépose dans son dossier ; seuls les administrateurs
--    consultent), fonctions d'administration, et profiles.verified_at.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Marqueurs protégés : is_virtual, verified_at
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_virtual_country_idx
  ON public.profiles (lower(btrim(country))) WHERE is_virtual;

CREATE OR REPLACE FUNCTION public.protect_server_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Requête d'un membre (auth.uid() renseigné, hors administrateur) : ces champs restent
  -- ceux du serveur.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_virtual := false;
      NEW.verified_at := NULL;
    ELSE
      NEW.is_virtual := OLD.is_virtual;
      NEW.verified_at := OLD.verified_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_server_profile_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_protect_server_fields ON public.profiles;
CREATE TRIGGER profiles_protect_server_fields BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_server_profile_fields();

-- ------------------------------------------------------------
-- 2. Position des pays (serveur uniquement)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_countries_name_idx ON public.geo_countries (lower(name));
ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_countries FROM anon, authenticated;
GRANT ALL ON public.geo_countries TO service_role;

-- ------------------------------------------------------------
-- 3. Remplacement automatique d'un profil virtuel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.virtual_profile_removals (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  removed_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.virtual_profile_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.virtual_profile_removals FROM anon, authenticated;
GRANT ALL ON public.virtual_profile_removals TO service_role;

-- Supprime UN profil virtuel : même pays d'abord, sinon le pays le plus proche.
-- Renvoie l'identifiant supprimé (ou NULL s'il n'y en a plus).
CREATE OR REPLACE FUNCTION public.remove_one_virtual_profile(_country text, _gender public.gender)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _key text := lower(btrim(coalesce(_country, '')));
  _origin public.geo_countries%ROWTYPE;
  _target uuid;
BEGIN
  SELECT p.user_id INTO _target
  FROM public.profiles p
  WHERE p.is_virtual AND lower(btrim(p.country)) = _key
  ORDER BY (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

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
      (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF _target IS NULL THEN
    RETURN NULL;
  END IF;

  -- Double vérification : uniquement un compte virtuel (profil ET compte marqués).
  DELETE FROM auth.users u
  WHERE u.id = _target
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN _target;
END; $$;
REVOKE ALL ON FUNCTION public.remove_one_virtual_profile(text, public.gender) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_one_virtual_profile(text, public.gender) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_virtual_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _removed uuid;
BEGIN
  IF NEW.is_virtual OR OLD.onboarding_completed_at IS NOT NULL OR NEW.onboarding_completed_at IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Une seule fois par membre (même s'il recommence son inscription).
    INSERT INTO public.virtual_profile_removals (user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    _removed := public.remove_one_virtual_profile(NEW.country, NEW.gender);
    UPDATE public.virtual_profile_removals SET removed_user_id = _removed
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Jamais d'échec d'inscription à cause des profils virtuels.
    RAISE WARNING 'replace_virtual_profile_on_signup: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.replace_virtual_profile_on_signup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_replace_virtual ON public.profiles;
CREATE TRIGGER profiles_replace_virtual AFTER UPDATE OF onboarding_completed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.replace_virtual_profile_on_signup();

-- ------------------------------------------------------------
-- 4. « Derniers inscrits » : sans les profils virtuels
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recent_signups()
RETURNS TABLE (first_name text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
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
-- Règle 24.12 : fonction SECURITY DEFINER réservée au rôle service (l'application
-- l'appelle côté serveur, voir recent-signups.functions.ts).
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;

-- ------------------------------------------------------------
-- 5. Vérification du profil (selfie ou pièce d'identité)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('selfie', 'id_document')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT profile_verifications_path_owner
    CHECK (split_part(storage_path, '/', 1) = user_id::text)
);
CREATE INDEX IF NOT EXISTS profile_verifications_user_idx
  ON public.profile_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_verifications_pending_idx
  ON public.profile_verifications (created_at) WHERE status = 'pending';
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.profile_verifications TO authenticated;
GRANT ALL ON public.profile_verifications TO service_role;

DROP POLICY IF EXISTS "verifications_select_own" ON public.profile_verifications;
CREATE POLICY "verifications_select_own" ON public.profile_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "verifications_insert_own" ON public.profile_verifications;
CREATE POLICY "verifications_insert_own" ON public.profile_verifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND split_part(storage_path, '/', 1) = auth.uid()::text
  );

-- Espace de stockage privé (8 Mo par photo, images uniquement).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verifications', 'verifications', false, 8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "verifications_storage_insert_own" ON storage.objects;
CREATE POLICY "verifications_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "verifications_storage_select" ON storage.objects;
CREATE POLICY "verifications_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verifications'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
DROP POLICY IF EXISTS "verifications_storage_delete" ON storage.objects;
CREATE POLICY "verifications_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verifications'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

CREATE OR REPLACE FUNCTION public.admin_list_pending_verifications()
RETURNS TABLE (
  id uuid, user_id uuid, first_name text, method text, storage_path text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, v.user_id, p.first_name, v.method, v.storage_path, v.created_at
  FROM public.profile_verifications v LEFT JOIN public.profiles p ON p.user_id = v.user_id
  WHERE v.status = 'pending'
  ORDER BY v.created_at
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_pending_verifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_verifications() TO authenticated, service_role;

-- Décision de l'administrateur. Renvoie le chemin du fichier, que l'espace /admin
-- supprime ensuite : la photo de vérification n'est gardée que le temps de l'examen.
CREATE OR REPLACE FUNCTION public.admin_review_verification(_verification_id uuid, _approve boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid;
  _path text;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.profile_verifications
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = _verification_id AND status = 'pending'
  RETURNING user_id, storage_path INTO _owner, _path;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _approve THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _owner AND verified_at IS NULL;
  END IF;
  RETURN _path;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_verification(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_verification(uuid, boolean) TO authenticated, service_role;

$m015$;
  END IF;
END
$auto$;

-- ############################################################
-- PARTIE 2 : les 50 profils virtuels
-- ############################################################
-- ============================================================
-- Profils virtuels : données (générées par scripts/generate-virtual-profiles.mjs)
--
-- * public.geo_countries : position de chaque pays (base GeoNames), pour « le pays le
--   plus proche » quand il n'y a plus de profil virtuel dans le pays d'un nouveau membre.
-- * 50 profils virtuels (25 femmes, 25 hommes) : 5 Gabon, 5 Cameroun, 5 Côte d'Ivoire, 5 Congo-Brazzaville, 5 Togo, 5 Bénin, 5 Sénégal, 5 Mali, 10 France,
--   22 à 48 ans. Ce sont des comptes sans mot de passe (connexion impossible), marqués
--   « virtual » dans le compte et is_virtual dans le profil. Aucune photo : la carte
--   affiche l'initiale, en attendant de vraies photos.
-- Aucune table n'est créée. Rejouable sans risque : un profil déjà présent n'est pas
-- recréé, et les profils virtuels d'une version précédente absents de la liste sont retirés.
-- À exécuter APRÈS 20261002100000_profils_virtuels_et_verification.sql.
-- ============================================================

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

DO $do$
DECLARE
  _seed jsonb := $seed$[
["virtuel.ga.01@profils-virtuels.yona.invalid","Prisca","Ondo","female","1997-10-29","Gabon","Estuaire","Libreville","Souriante et attentionnée, j'aime la cuisine et la louange. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Louange","Cuisine"],"Adventiste","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",20,38],
["virtuel.ga.02@profils-virtuels.yona.invalid","Steeve","Mintsa","male","2000-04-03","Gabon","Ogooué-Maritime","Port-Gentil","Dynamique et fidèle en amitié, je consacre mon temps libre à la louange. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Louange","Voyages"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Mariage","female",18,35],
["virtuel.ga.03@profils-virtuels.yona.invalid","Rachel","Obiang","female","1986-04-18","Gabon","Haut-Ogooué","Franceville","Calme et joyeuse, je partage mon temps entre mon travail et le cinéma. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique","Cinéma","Mode"],"Catholique","Chaque semaine","Matin et soir","Essentielle","Mariage","male",31,49],
["virtuel.ga.04@profils-virtuels.yona.invalid","Brice","Bivigou","male","1979-03-27","Gabon","Woleu-Ntem","Oyem","Posé mais déterminé, j'aime les voyages, le cinéma et les longues discussions. Je joue dans le groupe de louange de mon église. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Lecture","Voyages","Cinéma"],"Protestante (Église évangélique du Gabon)","Chaque semaine","Plusieurs fois par semaine","Essentielle","Mariage","female",38,56],
["virtuel.ga.05@profils-virtuels.yona.invalid","Murielle","Nzé","female","2000-07-14","Gabon","Haut-Ogooué","Moanda","Je suis une femme simple, passionnée par la mode et la cuisine. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Cuisine","Nature","Mode","Bénévolat"],"Pentecôtiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","male",18,35],
["virtuel.cm.01@profils-virtuels.yona.invalid","Serge","Nana","male","1984-11-07","Cameroun","Centre","Yaoundé","Fils de Dieu avant tout, je trouve ma joie dans le cinéma et le sport. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Nature","Voyages","Sport"],"Pentecôtiste","Plusieurs fois par semaine","Tous les jours","Au centre de ma vie","Mariage","female",33,51],
["virtuel.cm.02@profils-virtuels.yona.invalid","Brenda","Kamga","female","1984-06-04","Cameroun","Littoral","Douala","Douce mais déterminée, j'aime la photographie, les voyages et les longues discussions. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Bénévolat","Voyages","Photographie"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",33,51],
["virtuel.cm.03@profils-virtuels.yona.invalid","Martial","Mbappé","male","1986-12-25","Cameroun","West","Bafoussam","Chaque journée est un cadeau de Dieu : je la remplis de louange et de musique. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Danse","Musique"],"Baptiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",31,49],
["virtuel.cm.04@profils-virtuels.yona.invalid","Nadine","Nkoulou","female","1980-08-14","Cameroun","North-West","Bamenda","Souriante et attentionnée, j'aime la cuisine et la danse. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Bénévolat","Cuisine","Danse","Cinéma"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",37,55],
["virtuel.cm.05@profils-virtuels.yona.invalid","Guy","Onana","male","2001-12-03","Cameroun","North","Garoua","Souriant et attentionné, j'aime la mode et le bénévolat. La prière rythme mes journées. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Louange","Bénévolat"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",18,34],
["virtuel.ci.01@profils-virtuels.yona.invalid","Grâce","Ouattara","female","2003-01-06","Côte d'Ivoire","Abidjan Autonomous District","Abidjan","Je suis une femme simple, passionnée par la musique et le cinéma. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Lecture","Musique","Cinéma"],"Catholique","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",18,32],
["virtuel.ci.02@profils-virtuels.yona.invalid","Cyrille","Ehui","male","1982-10-06","Côte d'Ivoire","Vallée du Bandama District","Bouaké","Dynamique et fidèle en amitié, je consacre mon temps libre à la danse. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Cuisine","Danse","Voyages"],"Catholique","Plusieurs fois par semaine","Matin et soir","Très importante","Mariage","female",35,53],
["virtuel.ci.03@profils-virtuels.yona.invalid","Laetitia","Konan","female","1986-03-31","Côte d'Ivoire","Lacs District","Yamoussoukro","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de danse. Le Psaume 23 m'accompagne depuis toujours. Prête à bâtir une famille fondée sur l'amour et la foi.",["Nature","Louange","Bénévolat","Danse"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",31,49],
["virtuel.ci.04@profils-virtuels.yona.invalid","Didier","Kouamé","male","1977-07-01","Côte d'Ivoire","Sassandra-Marahoue","Daloa","Calme et joyeux, je partage mon temps entre mon travail et les balades dans la nature. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Sport","Nature","Voyages"],"Harriste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","female",40,58],
["virtuel.ci.05@profils-virtuels.yona.invalid","Ange","Gnahoré","female","1991-09-06","Côte d'Ivoire","Bas-Sassandra District","San-Pédro","Dynamique et fidèle en amitié, je consacre mon temps libre à la cuisine. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Sport","Cuisine"],"Méthodiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",26,44],
["virtuel.cg.01@profils-virtuels.yona.invalid","Hardy","Matsiona","male","1990-06-30","Congo-Brazzaville","Brazzaville","Brazzaville","Posé mais déterminé, j'aime la lecture, la cuisine et les longues discussions. Ma foi guide chacune de mes décisions. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Lecture","Cuisine"],"Salutiste (Armée du Salut)","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.cg.02@profils-virtuels.yona.invalid","Grâce","Ibara","female","1988-11-26","Congo-Brazzaville","Pointe-Noire","Pointe-Noire","Calme et joyeuse, je partage mon temps entre mon travail et la lecture. Ma foi guide chacune de mes décisions. Prête à bâtir une famille fondée sur l'amour et la foi.",["Voyages","Lecture"],"Kimbanguiste","Chaque semaine","Matin et soir","Très importante","Mariage","male",29,47],
["virtuel.cg.03@profils-virtuels.yona.invalid","Varel","Miakassissa","male","2000-03-11","Congo-Brazzaville","Niari","Dolisie","Chaque journée est un cadeau de Dieu : je la remplis de musique et de mode. Ma foi guide chacune de mes décisions. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Mode","Musique","Photographie"],"Pentecôtiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Faire connaissance d'abord","female",18,35],
["virtuel.cg.04@profils-virtuels.yona.invalid","Victoire","Moukoko","female","1982-10-05","Congo-Brazzaville","Bouenza","Nkayi","Je suis une femme simple, passionnée par le sport et la musique. Je participe à un groupe de prière chaque semaine. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Louange","Sport","Musique"],"Catholique","Chaque semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",35,53],
["virtuel.cg.05@profils-virtuels.yona.invalid","Ulrich","Kimbembé","male","1983-12-02","Congo-Brazzaville","Cuvette","Owando","Posé mais déterminé, j'aime le cinéma, la musique et les longues discussions. Je participe à un groupe de prière chaque semaine. J'attends une femme de foi, douce et pleine de joie.",["Cinéma","Musique"],"Kimbanguiste","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.tg.01@profils-virtuels.yona.invalid","Dédé","Kudjoh","female","1980-07-30","Togo","Maritime","Lomé","Douce mais déterminée, j'aime la lecture, la danse et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Danse","Lecture"],"Évangélique presbytérienne","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Relation sérieuse","male",37,55],
["virtuel.tg.02@profils-virtuels.yona.invalid","Dodji","Lawson","male","1994-12-24","Togo","Centrale","Sokodé","Calme et joyeux, je partage mon temps entre mon travail et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Bénévolat","Photographie","Danse"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",23,41],
["virtuel.tg.03@profils-virtuels.yona.invalid","Dzifa","Ahadji","female","2002-03-28","Togo","Kara","Kara","Fille de Dieu avant tout, je trouve ma joie dans la lecture et les voyages. Je suis engagée dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Musique","Lecture","Voyages"],"Catholique","Chaque semaine","Tous les jours","Au centre de ma vie","Relation sérieuse","male",18,33],
["virtuel.tg.04@profils-virtuels.yona.invalid","Sénamé","Amegah","male","1984-12-04","Togo","Plateaux","Kpalimé","Chaque journée est un cadeau de Dieu : je la remplis de sport et de lecture. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Musique","Lecture","Mode","Sport"],"Évangélique presbytérienne","Chaque semaine","Matin et soir","Essentielle","Faire connaissance d'abord","female",33,51],
["virtuel.tg.05@profils-virtuels.yona.invalid","Mawuena","Dossou","female","1985-01-06","Togo","Plateaux","Atakpamé","Douce mais déterminée, j'aime la lecture, les balades dans la nature et les longues discussions. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Nature","Lecture","Sport"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","male",32,50],
["virtuel.bj.01@profils-virtuels.yona.invalid","Gildas","Agossou","male","1977-01-03","Bénin","Littoral","Cotonou","Souriant et attentionné, j'aime la mode et la danse. Le Psaume 23 m'accompagne depuis toujours. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Musique","Danse","Mode"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","female",40,58],
["virtuel.bj.02@profils-virtuels.yona.invalid","Léonie","Kpossou","female","1999-11-22","Bénin","Ouémé","Porto-Novo","Je suis une femme simple, passionnée par le bénévolat et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Photographie","Bénévolat"],"Église du christianisme céleste","Deux à trois fois par mois","Tous les jours","Très importante","Relation sérieuse","male",18,36],
["virtuel.bj.03@profils-virtuels.yona.invalid","Arnaud","Hounkpatin","male","1983-01-01","Bénin","Borgou","Parakou","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. La prière rythme mes journées. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Photographie","Danse"],"Méthodiste","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",34,52],
["virtuel.bj.04@profils-virtuels.yona.invalid","Ornella","Akpovo","female","1993-10-21","Bénin","Zou","Abomey","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de voyages. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Nature","Bénévolat","Voyages"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",24,42],
["virtuel.bj.05@profils-virtuels.yona.invalid","Dieudonné","Zinsou","male","1983-02-23","Bénin","Atlantique","Abomey-Calavi","Je suis un homme simple, passionné par la cuisine et la lecture. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Cuisine","Lecture"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.01@profils-virtuels.yona.invalid","Joséphine","Diène","female","1979-12-05","Sénégal","Dakar","Dakar","Je suis une femme simple, passionnée par la mode et le cinéma. Je sers à l'accueil de mon église le dimanche. Je crois au mariage, à la fidélité et au respect.",["Sport","Cinéma","Photographie","Mode"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Essentielle","Faire connaissance d'abord","male",38,56],
["virtuel.sn.02@profils-virtuels.yona.invalid","Charles","Diouf","male","1989-01-17","Sénégal","Thies","Thiès","Je suis un homme simple, passionné par la photographie et la danse. J'aide à l'organisation des sorties de l'église. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Danse","Sport","Photographie"],"Catholique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",28,46],
["virtuel.sn.03@profils-virtuels.yona.invalid","Clémentine","Da Silva","female","1991-09-25","Sénégal","Ziguinchor","Ziguinchor","Souriante et attentionnée, j'aime la mode et le cinéma. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Sport","Mode","Cinéma"],"Adventiste","Chaque semaine","Matin et soir","Au centre de ma vie","Mariage","male",26,44],
["virtuel.sn.04@profils-virtuels.yona.invalid","Antoine","Ndour","male","1983-08-31","Sénégal","Saint-Louis","Saint-Louis","Fils de Dieu avant tout, je trouve ma joie dans la musique et la louange. J'aide à l'organisation des sorties de l'église. Je cherche une relation sérieuse, en vue du mariage.",["Louange","Musique","Cuisine"],"Catholique","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.05@profils-virtuels.yona.invalid","Cécile","Mendy","female","2000-09-23","Sénégal","Thies","Mbour","Souriante et attentionnée, j'aime le bénévolat et la danse. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Danse","Louange","Bénévolat","Cuisine"],"Évangélique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","male",18,35],
["virtuel.ml.01@profils-virtuels.yona.invalid","Bernard","Kéita","male","1987-07-23","Mali","Bamako","Bamako","Posé mais déterminé, j'aime la cuisine, la mode et les longues discussions. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Mode"],"Baptiste","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Mariage","female",30,48],
["virtuel.ml.02@profils-virtuels.yona.invalid","Béatrice","Konaté","female","1991-03-31","Mali","Sikasso","Sikasso","Douce mais déterminée, j'aime la cuisine, la photographie et les longues discussions. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Photographie","Cinéma","Sport"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",26,44],
["virtuel.ml.03@profils-virtuels.yona.invalid","Luc","Traoré","male","1990-08-01","Mali","Ségou","Ségou","Calme et joyeux, je partage mon temps entre mon travail et la musique. Je sers à l'accueil de mon église le dimanche. J'attends une femme de foi, douce et pleine de joie.",["Musique","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.ml.04@profils-virtuels.yona.invalid","Marthe","Dara","female","1992-08-08","Mali","Mopti","Mopti","Dynamique et fidèle en amitié, je consacre mon temps libre aux balades dans la nature. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Musique","Nature","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Essentielle","Mariage","male",25,43],
["virtuel.ml.05@profils-virtuels.yona.invalid","Timothée","Togo","male","1992-09-23","Mali","Sikasso","Koutiala","Dynamique et fidèle en amitié, je consacre mon temps libre au cinéma. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Musique","Cuisine","Cinéma"],"Baptiste","Plusieurs fois par semaine","Matin et soir","Essentielle","Relation sérieuse","female",25,43],
["virtuel.fr.01@profils-virtuels.yona.invalid","Anne","Bernard","female","1995-01-21","France","Île-de-France","Paris","Je suis une femme simple, passionnée par la mode et les voyages. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Mode","Voyages","Lecture"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","male",22,40],
["virtuel.fr.02@profils-virtuels.yona.invalid","Benoît","Lambert","male","2003-01-25","France","Auvergne-Rhône-Alpes","Lyon","Souriant et attentionné, j'aime le bénévolat et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. Je crois au mariage, à la fidélité et au respect.",["Danse","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Très importante","Mariage","female",18,32],
["virtuel.fr.03@profils-virtuels.yona.invalid","Charlotte","Faure","female","1986-09-19","France","Provence-Alpes-Côte d'Azur","Marseille","Calme et joyeuse, je partage mon temps entre mon travail et la photographie. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Photographie","Mode"],"Catholique","Deux à trois fois par mois","Tous les jours","Au centre de ma vie","Relation sérieuse","male",31,49],
["virtuel.fr.04@profils-virtuels.yona.invalid","Antoine","André","male","1980-04-29","France","Occitanie","Toulouse","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Nature","Photographie"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",37,55],
["virtuel.fr.05@profils-virtuels.yona.invalid","Sophie","Lefebvre","female","1993-06-22","France","New Aquitaine","Bordeaux","Fille de Dieu avant tout, je trouve ma joie dans les voyages et la musique. Je chante dans la chorale de mon église. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique"],"Catholique","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",24,42],
["virtuel.fr.06@profils-virtuels.yona.invalid","Julien","Masson","male","2003-02-02","France","Hauts-de-France","Lille","Fils de Dieu avant tout, je trouve ma joie dans la louange et la danse. La prière rythme mes journées. J'attends une femme de foi, douce et pleine de joie.",["Louange","Danse"],"Catholique","Deux à trois fois par mois","Tous les jours","Essentielle","Relation sérieuse","female",18,32],
["virtuel.fr.07@profils-virtuels.yona.invalid","Laure","Laurent","female","2000-04-29","France","Pays de la Loire","Nantes","Je suis une femme simple, passionnée par la photographie et les voyages. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Photographie","Voyages"],"Protestante réformée","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",18,35],
["virtuel.fr.08@profils-virtuels.yona.invalid","David","Martin","male","1990-05-10","France","Grand Est","Strasbourg","Chaque journée est un cadeau de Dieu : je la remplis de danse et de louange. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Photographie","Lecture","Danse"],"Baptiste","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",27,45],
["virtuel.fr.09@profils-virtuels.yona.invalid","Sarah","Fontaine","female","1993-06-08","France","Brittany","Rennes","Douce mais déterminée, j'aime le sport, la lecture et les longues discussions. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Cuisine","Lecture","Sport"],"Évangélique","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",24,42],
["virtuel.fr.10@profils-virtuels.yona.invalid","Nicolas","Rousseau","male","1978-09-29","France","Occitanie","Montpellier","Calme et joyeux, je partage mon temps entre mon travail et le sport. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Mode","Sport","Lecture","Louange"],"Catholique","Deux à trois fois par mois","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",39,57]
]$seed$;
  _col text;
BEGIN
  -- 0. Profils virtuels laissés par une version précédente et absents de cette liste :
  --    retirés (uniquement des comptes virtuels : fournisseur « virtual » + adresse
  --    @profils-virtuels.yona.invalid). Il reste ainsi exactement 50 profils virtuels.
  DELETE FROM auth.users u
  WHERE u.email LIKE '%@profils-virtuels.yona.invalid'
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_seed) e WHERE e ->> 0 = u.email);

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
    jsonb_build_object('first_name', e ->> 1, 'last_name', e ->> 2, 'is_virtual', true),
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

  -- 2. Profils complets, actifs et visibles.
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 3)::public.gender,
      birth_date = (e ->> 4)::date,
      country = e ->> 5,
      region = e ->> 6,
      city = e ->> 7,
      bio = e ->> 8,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 9)),
      is_virtual = true,
      terms_accepted_at = now(),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible'
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 10,
      church_attendance = e ->> 11,
      prayer_practice = e ->> 12,
      faith_importance = e ->> 13
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 14,
      preferred_gender = (e ->> 15)::public.gender,
      min_age = (e ->> 16)::smallint,
      max_age = (e ->> 17)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;

-- ############################################################
-- PARTIE 3 : bilan (lecture seule)
-- ############################################################
WITH attendu(migration, nature, a, b) AS (VALUES
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'blocks_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'conversations_ordered_pair', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'likes_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'matches_ordered_pair', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'messages_content_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'payments_amount_positive', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'preferences_age_range', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'profiles_bio_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'profiles_first_name_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'reports_description_length', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'reports_no_self', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'subscriptions_period', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'constraint', 'unlocks_period', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'get_presence'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'handle_new_user'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'has_role'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_admin'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_blocked_between'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_conversation_participant'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'is_premium'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_photo_status'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_profile_status'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'protect_user_columns'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'function', 'public', 'set_updated_at'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'blocks_blocked_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'conversations_user_1_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'conversations_user_2_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'likes_receiver_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'matches_user_2_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'messages_conversation_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'moderation_actions_target_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'payments_provider_tx_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'payments_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'photos_one_primary_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'photos_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'profiles_discovery_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'reports_status_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'subscriptions_user_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'index', 'unlocks_conversation_idx', ''),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'activity_select_admin', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'activity_select_own', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_delete_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_insert_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_select_admin', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'blocks_select_own', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_select_admin', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_select_own', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'christian_update_own', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'conversations_select_admin', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'conversations_select_participant', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'likes_select_admin', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'likes_select_sent', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'matches_select_admin', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'matches_select_participant', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_admin', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_own_blocked', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'messages_select_participant', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'moderation_insert_admin', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'moderation_select_admin', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'payments_select_admin', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'payments_select_own', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_delete_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_delete_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_insert_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_select_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_select_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_update_admin', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'photos_update_own', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_select_admin', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_select_own', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'preferences_update_own', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_select_admin', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_select_own', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_update_admin', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'profiles_update_own', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_select_admin', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_select_own', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'reports_update_admin', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'subscriptions_select_admin', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'subscriptions_select_own', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'unlocks_select_admin', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'unlocks_select_participant', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'user_roles_select_admin', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'user_roles_select_own', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_select_admin', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_select_own', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_update_admin', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'policy', 'users_update_own', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'blocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'conversation_unlocks'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'likes'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'matches'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'messages'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'moderation_actions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'reports'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'user_roles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'table', 'public', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'christian_profiles_updated_at', 'christian_profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'conversations_updated_at', 'conversations'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'on_auth_user_created', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'payments_updated_at', 'payments'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'photos_protect_status', 'photos'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'preferences_updated_at', 'preferences'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'profiles_protect_status', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'profiles_updated_at', 'profiles'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'subscriptions_updated_at', 'subscriptions'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'user_activity_updated_at', 'user_activity'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'users_protect_columns', 'users'),
  ('20260908214236_428de546-faef-410d-974c-c327d5c92b9f', 'trigger', 'users_updated_at', 'users'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'ai_usage_count_positive', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'conversation_user_usage_range', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'favorites_no_self', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'constraint', 'profile_visits_no_self', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'consume_ai_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'consume_free_message'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'enforce_photo_limit'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'get_ai_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'get_conversation_quota'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'function', 'public', 'has_active_conversation_unlock'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'ai_usage_feature_date_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'ai_usage_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'conversation_user_usage_conversation_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'conversation_user_usage_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'favorites_favorite_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'favorites_user_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visited_at_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visited_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'index', 'profile_visits_visitor_idx', ''),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'ai_usage_select_admin', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'ai_usage_select_own', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'cuu_select_admin', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'cuu_select_own', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_delete_own', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_select_admin', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'favorites_select_own', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'profile_visits_select_admin', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'policy', 'profile_visits_select_own_visits', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'favorites'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'table', 'public', 'profile_visits'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'ai_usage_updated_at', 'ai_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'conversation_user_usage_updated_at', 'conversation_user_usage'),
  ('20260918001810_e92322dc-33ca-46b1-b49e-6d6e1c43eeaf', 'trigger', 'photos_enforce_limit', 'photos'),
  ('20260925120000_phase0_rattrapage_schema', 'bucket', 'photos', ''),
  ('20260925120000_phase0_rattrapage_schema', 'policy', 'photos_storage_delete_own', 'objects'),
  ('20260925120000_phase0_rattrapage_schema', 'policy', 'photos_storage_insert_own', 'objects'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'is_active_account'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'is_discoverable_profile'),
  ('20260925130000_phase0_corrections_rls', 'function', 'public', 'protect_like_parties'),
  ('20260925130000_phase0_corrections_rls', 'trigger', 'likes_protect_parties', 'likes'),
  ('20260926100000_phase1_infos_personnelles', 'function', 'public', 'check_profile_personal_info'),
  ('20260926100000_phase1_infos_personnelles', 'trigger', 'profiles_check_personal_info', 'profiles'),
  ('20260926110000_phase1_infos_chretiennes', 'function', 'public', 'text_items_max_length'),
  ('20260926130000_phase1_photos', 'function', 'public', 'photos_after_delete'),
  ('20260926130000_phase1_photos', 'function', 'public', 'photos_before_insert'),
  ('20260926130000_phase1_photos', 'function', 'public', 'set_primary_photo'),
  ('20260926130000_phase1_photos', 'trigger', 'photos_promote_primary_on_delete', 'photos'),
  ('20260926130000_phase1_photos', 'trigger', 'photos_set_primary_on_insert', 'photos'),
  ('20260926140000_phase1_visibilite_profil', 'function', 'public', 'check_profile_visibility'),
  ('20260926140000_phase1_visibilite_profil', 'trigger', 'profiles_check_visibility', 'profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'function', 'public', 'can_browse_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'function', 'public', 'discover_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'christian_select_visible', 'christian_profiles'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'photos_select_visible', 'photos'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'photos_storage_select', 'objects'),
  ('20260926150000_phase1_eligibilite_decouverte', 'policy', 'profiles_select_visible', 'profiles'),
  ('20260926160000_phase2_enregistrer_like', 'function', 'public', 'set_like_created_at'),
  ('20260926160000_phase2_enregistrer_like', 'policy', 'likes_insert_own', 'likes'),
  ('20260926160000_phase2_enregistrer_like', 'trigger', 'likes_set_created_at', 'likes'),
  ('20260926180000_phase2_blocages_decouverte', 'policy', 'likes_update_own', 'likes'),
  ('20260926190000_phase3_like_reciproque', 'function', 'public', 'has_mutual_like'),
  ('20260926200000_phase3_creer_match', 'function', 'public', 'create_match_on_mutual_like'),
  ('20260926200000_phase3_creer_match', 'trigger', 'likes_create_match', 'likes'),
  ('20260926220000_phase4_conversation_auto', 'function', 'public', 'create_conversation_for_match'),
  ('20260926220000_phase4_conversation_auto', 'trigger', 'matches_create_conversation', 'matches'),
  ('20260927100000_phase4_enregistrer_message', 'function', 'public', 'send_message'),
  ('20260927120000_phase4_messages_non_lus', 'function', 'public', 'get_unread_counts'),
  ('20260927120000_phase4_messages_non_lus', 'function', 'public', 'mark_conversation_read'),
  ('20260927120000_phase4_messages_non_lus', 'policy', 'conversation_reads_select_own', 'conversation_reads'),
  ('20260927120000_phase4_messages_non_lus', 'table', 'public', 'conversation_reads'),
  ('20260927140000_phase5_compteur_individuel', 'function', 'public', 'init_conversation_usage'),
  ('20260927140000_phase5_compteur_individuel', 'trigger', 'conversations_init_usage', 'conversations'),
  ('20260927180000_phase6_numeros_classiques', 'function', 'public', 'contains_phone_number'),
  ('20260928010000_phase6_empecher_stockage', 'function', 'public', 'messages_block_phone_numbers'),
  ('20260928010000_phase6_empecher_stockage', 'trigger', 'messages_block_phone_numbers', 'messages'),
  ('20260928020000_phase6_enforcement_serveur', 'constraint', 'messages_no_phone_number_delivered', ''),
  ('20260928040000_phase7_ecran_paiement', 'function', 'public', 'start_conversation_unlock_payment'),
  ('20260928050000_phase7_paiement_confirme', 'function', 'public', 'confirm_payment'),
  ('20260928060000_phase7_activer_deblocage', 'function', 'public', 'activate_conversation_unlock'),
  ('20260928060000_phase7_activer_deblocage', 'index', 'conversation_unlocks_payment_unique', ''),
  ('20260928060000_phase7_activer_deblocage', 'trigger', 'payments_activate_conversation_unlock', 'payments'),
  ('20260928090000_phase7_expirer_deblocage', 'function', 'public', 'expire_conversation_unlocks'),
  ('20260928110000_phase8_enregistrer_favori', 'function', 'public', 'set_favorite_created_at'),
  ('20260928110000_phase8_enregistrer_favori', 'policy', 'favorites_insert_own', 'favorites'),
  ('20260928110000_phase8_enregistrer_favori', 'trigger', 'favorites_set_created_at', 'favorites'),
  ('20260928120000_phase8_qui_ma_favorise', 'function', 'public', 'get_favorited_by'),
  ('20260928140000_phase9_enregistrer_visite', 'function', 'public', 'record_profile_visit'),
  ('20260928150000_phase9_limiter_visites', 'index', 'profile_visits_pair_recent_idx', ''),
  ('20260928160000_phase9_visiteurs_premium', 'function', 'public', 'get_profile_visitors'),
  ('20260928180000_phase10_derniere_activite', 'function', 'public', 'touch_activity'),
  ('20260928200000_phase10_statut_en_ligne', 'function', 'public', 'mark_offline'),
  ('20260928220000_phase11_filtre_age', 'function', 'public', 'search_profiles'),
  ('20260928235000_phase11_filtre_pays', 'function', 'public', 'list_search_countries'),
  ('20260928235000_phase11_filtre_pays', 'function', 'public', 'normalize_place'),
  ('20260929000000_phase11_filtre_ville', 'function', 'public', 'list_search_cities'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'clear_my_location'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'clear_profile_coordinates'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'distance_km'),
  ('20260929010000_phase11_filtre_distance', 'function', 'public', 'set_my_location'),
  ('20260929010000_phase11_filtre_distance', 'policy', 'profile_locations_select_own', 'profile_locations'),
  ('20260929010000_phase11_filtre_distance', 'table', 'public', 'profile_locations'),
  ('20260929010000_phase11_filtre_distance', 'trigger', 'profiles_no_coordinates', 'profiles'),
  ('20260929020000_phase11_filtre_situation', 'constraint', 'profiles_marital_status_check', ''),
  ('20260929030000_phase11_filtre_enfants', 'constraint', 'profiles_children_check', ''),
  ('20260929040000_phase11_filtre_denomination', 'function', 'public', 'list_search_values'),
  ('20260929080000_phase11_filtre_interets', 'constraint', 'profiles_interests_count', ''),
  ('20260929080000_phase11_filtre_interets', 'constraint', 'profiles_interests_item_length', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_message_length', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_no_self', ''),
  ('20260929110000_phase12_creer_demande', 'constraint', 'contact_requests_status_check', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_one_pending', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_receiver_idx', ''),
  ('20260929110000_phase12_creer_demande', 'index', 'contact_requests_sender_idx', ''),
  ('20260929110000_phase12_creer_demande', 'policy', 'contact_requests_select_parties', 'contact_requests'),
  ('20260929110000_phase12_creer_demande', 'table', 'public', 'contact_requests'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'cancel_contact_request'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'get_contact_request_quota'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'respond_contact_request'),
  ('20260930100000_phase12_repondre_quota_demandes', 'function', 'public', 'utc_day_start'),
  ('20260930100000_phase12_repondre_quota_demandes', 'index', 'contact_requests_sender_day_idx', ''),
  ('20260930110000_phase13_roi_salomon', 'function', 'public', 'ai_usage_day'),
  ('20260930110000_phase13_roi_salomon', 'function', 'public', 'refund_ai_quota'),
  ('20260930120000_phase14_premium', 'function', 'public', 'activate_premium_subscription'),
  ('20260930120000_phase14_premium', 'function', 'public', 'expire_subscriptions'),
  ('20260930120000_phase14_premium', 'function', 'public', 'get_my_premium'),
  ('20260930120000_phase14_premium', 'function', 'public', 'get_premium_badges'),
  ('20260930120000_phase14_premium', 'function', 'public', 'premium_plan_amount'),
  ('20260930120000_phase14_premium', 'function', 'public', 'start_premium_payment'),
  ('20260930120000_phase14_premium', 'index', 'subscriptions_payment_unique', ''),
  ('20260930120000_phase14_premium', 'trigger', 'payments_activate_premium', 'payments'),
  ('20260930130000_phase15_avantages_premium', 'bucket', 'voice-messages', ''),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'audio_duration_seconds'),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'audio_path'),
  ('20260930130000_phase15_avantages_premium', 'column', 'messages', 'kind'),
  ('20260930130000_phase15_avantages_premium', 'constraint', 'messages_kind_valid', ''),
  ('20260930130000_phase15_avantages_premium', 'constraint', 'profile_boosts_period', ''),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'activate_profile_boost'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'create_support_ticket'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'get_message_quota'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'get_my_boost'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'is_boosted'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'is_conversation_folder_participant'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'lock_conversation_for_sending'),
  ('20260930130000_phase15_avantages_premium', 'function', 'public', 'send_voice_message'),
  ('20260930130000_phase15_avantages_premium', 'index', 'profile_boosts_user_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'index', 'support_tickets_queue_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'index', 'support_tickets_user_idx', ''),
  ('20260930130000_phase15_avantages_premium', 'policy', 'profile_boosts_select_own', 'profile_boosts'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'support_tickets_select_own', 'support_tickets'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_delete_own', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_insert_premium', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'policy', 'voice_storage_select_participant', 'objects'),
  ('20260930130000_phase15_avantages_premium', 'table', 'public', 'profile_boosts'),
  ('20260930130000_phase15_avantages_premium', 'table', 'public', 'support_tickets'),
  ('20260930150000_phase17_message_flash', 'column', 'contact_requests', 'is_flash'),
  ('20260930150000_phase17_message_flash', 'function', 'public', 'list_contact_requests'),
  ('20260930150000_phase17_message_flash', 'function', 'public', 'send_contact_request'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'can_view_profile'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'compatibility_breakdown'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'get_compatibility'),
  ('20260930160000_phase18_compatibilite', 'function', 'public', 'get_compatibility_scores'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'create_notification'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'get_unread_notification_count'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'list_notifications'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'mark_all_notifications_read'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'mark_notification_read'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_contact_request'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_favorite'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_like'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_match'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_message'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'notify_visit'),
  ('20260930170000_phase19_notifications', 'function', 'public', 'wants_notification'),
  ('20260930170000_phase19_notifications', 'index', 'notifications_unread_idx', ''),
  ('20260930170000_phase19_notifications', 'index', 'notifications_user_idx', ''),
  ('20260930170000_phase19_notifications', 'policy', 'notifications_select_own', 'notifications'),
  ('20260930170000_phase19_notifications', 'table', 'public', 'notifications'),
  ('20260930170000_phase19_notifications', 'trigger', 'contact_requests_notify', 'contact_requests'),
  ('20260930170000_phase19_notifications', 'trigger', 'favorites_notify', 'favorites'),
  ('20260930170000_phase19_notifications', 'trigger', 'likes_notify', 'likes'),
  ('20260930170000_phase19_notifications', 'trigger', 'matches_notify', 'matches'),
  ('20260930170000_phase19_notifications', 'trigger', 'messages_notify', 'messages'),
  ('20260930170000_phase19_notifications', 'trigger', 'profile_visits_notify', 'profile_visits'),
  ('20260930180000_phase20_parametres', 'function', 'public', 'is_activity_visible'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_insert_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_select_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'policy', 'user_settings_update_own', 'user_settings'),
  ('20260930180000_phase20_parametres', 'table', 'public', 'user_settings'),
  ('20260930180000_phase20_parametres', 'trigger', 'user_settings_updated_at', 'user_settings'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'block_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'list_blocked_users'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'refuse_blocked_interaction'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'report_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'function', 'public', 'unblock_user'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'favorites_refuse_blocked', 'favorites'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'likes_refuse_blocked', 'likes'),
  ('20260930190000_phase21_22_blocage_signalement', 'trigger', 'profile_visits_refuse_blocked', 'profile_visits'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_payments'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_pending_photos'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_reports'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_subscriptions'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_support_tickets'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_unlocks'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_list_users'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_moderate_photo'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_reply_support_ticket'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_resolve_report'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_set_user_status'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_stats'),
  ('20260930200000_phase23_administration', 'function', 'public', 'admin_user_detail'),
  ('20260930200000_phase23_administration', 'function', 'public', 'assert_admin'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'origin'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'region'),
  ('20261001090000_inscription_fluide', 'column', 'profiles', 'terms_accepted_at'),
  ('20261001090000_inscription_fluide', 'column', 'user_settings', 'marketing_emails'),
  ('20261001090000_inscription_fluide', 'constraint', 'profiles_origin_length', ''),
  ('20261001090000_inscription_fluide', 'constraint', 'profiles_region_length', ''),
  ('20261001090000_inscription_fluide', 'function', 'public', 'protect_terms_accepted_at'),
  ('20261001090000_inscription_fluide', 'function', 'public', 'recent_signups'),
  ('20261001090000_inscription_fluide', 'trigger', 'profiles_protect_terms', 'profiles'),
  ('20261002100000_profils_virtuels_et_verification', 'bucket', 'verifications', ''),
  ('20261002100000_profils_virtuels_et_verification', 'column', 'profiles', 'is_virtual'),
  ('20261002100000_profils_virtuels_et_verification', 'column', 'profiles', 'verified_at'),
  ('20261002100000_profils_virtuels_et_verification', 'constraint', 'profile_verifications_path_owner', ''),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'admin_list_pending_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'admin_review_verification'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'protect_server_profile_fields'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'remove_one_virtual_profile'),
  ('20261002100000_profils_virtuels_et_verification', 'function', 'public', 'replace_virtual_profile_on_signup'),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'geo_countries_name_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profile_verifications_pending_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profile_verifications_user_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'index', 'profiles_virtual_country_idx', ''),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_insert_own', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_select_own', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_delete', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_insert_own', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'policy', 'verifications_storage_select', 'objects'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'geo_countries'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'profile_verifications'),
  ('20261002100000_profils_virtuels_et_verification', 'table', 'public', 'virtual_profile_removals'),
  ('20261002100000_profils_virtuels_et_verification', 'trigger', 'profiles_protect_server_fields', 'profiles'),
  ('20261002100000_profils_virtuels_et_verification', 'trigger', 'profiles_replace_virtual', 'profiles')
),
controle AS (
  SELECT migration, nature, a, b,
    CASE nature
      WHEN 'table' THEN to_regclass(quote_ident(a) || '.' || quote_ident(b)) IS NOT NULL
      WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                   WHERE n.nspname = a AND p.proname = b)
      WHEN 'column' THEN EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema IN ('public', 'storage') AND table_name = a AND column_name = b)
      WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                                  WHERE t.tgname = a AND c.relname = b)
      WHEN 'policy' THEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = a AND tablename = b)
      WHEN 'index' THEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = a)
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = a)
      WHEN 'bucket' THEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = a)
    END AS present
  FROM attendu
),
bilan AS (
  SELECT migration,
         count(*) FILTER (WHERE present) AS presents,
         count(*) FILTER (WHERE NOT present) AS manquants,
         string_agg(CASE WHEN NOT present THEN nature || ' ' || a || CASE WHEN b <> '' THEN '.' || b ELSE '' END END, ', '
                    ORDER BY nature, a, b) AS exemples
  FROM controle GROUP BY migration
)
SELECT migration, presents, manquants, left(exemples, 160) AS elements_manquants
FROM bilan WHERE manquants > 0
UNION ALL
SELECT '→ Profils virtuels dans la base', count(*), 0, NULL
FROM public.profiles WHERE is_virtual
UNION ALL
SELECT 'Tout est à jour', NULL, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM bilan WHERE manquants > 0)
ORDER BY 1;
