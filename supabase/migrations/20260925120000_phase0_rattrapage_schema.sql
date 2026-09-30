-- ============================================================
-- Phase 0 — Étape 0.4 — Rattrapage du schéma (idempotent)
--
-- Garantit le même schéma final quelle que soit l'origine de la base :
--   A. base neuve (toutes les migrations dans l'ordre) → aucun effet ;
--   B. base créée avec l'ancien contenu de 20260917210826 → ajoute ce qui manquait.
-- Crée aussi le bucket de stockage « photos » (privé), utilisé par les
-- politiques de 20260909003817 mais créé par aucune migration.
-- Toutes les instructions peuvent être rejouées sans erreur.
-- ============================================================

-- 1. Contrainte et index présents dans 20260908214236 mais absents de l'ancien 20260917210826
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reports_description_length' AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_description_length
      CHECK (description IS NULL OR char_length(description) <= 2000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS moderation_actions_target_idx ON public.moderation_actions (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id, status, expires_at DESC);

-- 2. Droits d'exécution des fonctions (contenu de 20260909003751, rejoué à l'identique)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_photo_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_presence(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role), public.is_admin(), public.is_blocked_between(uuid, uuid), public.is_conversation_participant(uuid, uuid), public.is_premium(uuid), public.get_presence(uuid), public.touch_activity() TO authenticated, service_role;

-- 3. Bucket de stockage des photos (privé : accès uniquement via les politiques)
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', false)
ON CONFLICT (id) DO NOTHING;

-- 4. Politiques de stockage (contenu de 20260909003817, rendu rejouable)
DROP POLICY IF EXISTS "photos_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_storage_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "photos_storage_select" ON storage.objects;

CREATE POLICY "photos_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "photos_storage_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
CREATE POLICY "photos_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.photos p
        WHERE p.storage_path = storage.objects.name
          AND p.status = 'approved'
          AND NOT public.is_blocked_between(auth.uid(), p.user_id)
          AND EXISTS (SELECT 1 FROM public.profiles pr JOIN public.users u ON u.id = pr.user_id
                      WHERE pr.user_id = p.user_id AND pr.status = 'active' AND pr.visibility = 'visible' AND u.status = 'active')
      )
    )
  );
