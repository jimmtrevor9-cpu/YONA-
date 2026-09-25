-- ============================================================
-- Phase 0 — Étape 0.6 — Corrections des règles d'accès (RLS)
--
-- Problèmes constatés par les tests d'accès via l'API (voir
-- docs/verification/phase-0/etape-0.6-rls.md) :
--   1. Les profils, profils chrétiens et photos des autres membres étaient
--      invisibles : les règles lisaient public.users, que la RLS limite à sa
--      propre ligne → découverte toujours vide, Like toujours refusé.
--   2. Un compte supprimé de auth.users laissait sa fiche (profil visible…).
--   3. Un Like existant pouvait être redirigé vers un autre membre (y compris
--      un membre ayant bloqué l'auteur).
--   4. Une photo pouvait référencer un fichier du dossier d'un autre membre.
--   5. La présence « en ligne » pouvait être falsifiée par écriture directe.
--   6. Des fonctions révélaient des informations sur d'autres membres
--      (blocages entre tiers, rôle administrateur, déblocages, participation).
--   7. Droits techniques par défaut trop larges (TRUNCATE, TRIGGER,
--      REFERENCES ; tous les droits pour les visiteurs anonymes).
-- Toutes les instructions sont rejouables.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Visibilité des profils : vérification via fonctions SECURITY DEFINER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_account(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _user_id AND u.status = 'active')
$$;

CREATE OR REPLACE FUNCTION public.is_discoverable_profile(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = _user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_account(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_discoverable_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_account(uuid), public.is_discoverable_profile(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles_select_visible" ON public.profiles;
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND status = 'active' AND visibility = 'visible'
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_active_account(user_id)
  );

DROP POLICY IF EXISTS "christian_select_visible" ON public.christian_profiles;
CREATE POLICY "christian_select_visible" ON public.christian_profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_discoverable_profile(user_id)
  );

DROP POLICY IF EXISTS "photos_select_visible" ON public.photos;
CREATE POLICY "photos_select_visible" ON public.photos FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid() AND status = 'approved'
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_discoverable_profile(user_id)
  );

DROP POLICY IF EXISTS "photos_storage_select" ON storage.objects;
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
          AND public.is_discoverable_profile(p.user_id)
      )
    )
  );

-- ------------------------------------------------------------
-- 2. Suppression d'un compte : la fiche applicative suit auth.users
-- ------------------------------------------------------------
DELETE FROM public.users u WHERE NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_id_auth_fkey' AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_auth_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. Likes : auteur et destinataire non modifiables après création
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_like_parties()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id THEN
    RAISE EXCEPTION 'like_parties_immutable' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_like_parties() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS likes_protect_parties ON public.likes;
CREATE TRIGGER likes_protect_parties BEFORE UPDATE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.protect_like_parties();

DROP POLICY IF EXISTS "likes_update_own" ON public.likes;
CREATE POLICY "likes_update_own" ON public.likes FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND NOT public.is_blocked_between(sender_id, receiver_id));

-- ------------------------------------------------------------
-- 4. Photos : le fichier doit être dans le dossier de son propriétaire
-- ------------------------------------------------------------
DELETE FROM public.photos WHERE split_part(storage_path, '/', 1) <> user_id::text;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'photos_path_in_owner_folder' AND conrelid = 'public.photos'::regclass
  ) THEN
    ALTER TABLE public.photos
      ADD CONSTRAINT photos_path_in_owner_folder CHECK (split_part(storage_path, '/', 1) = user_id::text);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. Présence : mise à jour uniquement via touch_activity()
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "activity_update_own" ON public.user_activity;
REVOKE UPDATE ON public.user_activity FROM authenticated;

-- ------------------------------------------------------------
-- 6. Fonctions : ne répondre que sur soi-même (ou pour un admin / le serveur)
--    Les politiques les appellent toujours avec auth.uid() : comportement inchangé.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
      auth.uid() IS NULL
      OR _user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
    )
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR auth.uid() IN (_a, _b) OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.blocks
      WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
    )
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid() OR public.is_admin())
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = _conversation_id AND (_user_id = user_1_id OR _user_id = user_2_id)
    )
$$;

CREATE OR REPLACE FUNCTION public.has_active_conversation_unlock(_conversation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
      auth.uid() IS NULL
      OR public.is_conversation_participant(_conversation_id, auth.uid())
      OR public.is_admin()
    )
    AND EXISTS (
      SELECT 1 FROM public.conversation_unlocks u
      WHERE u.conversation_id = _conversation_id AND u.status = 'active'
        AND u.starts_at IS NOT NULL AND u.starts_at <= now()
        AND u.expires_at IS NOT NULL AND u.expires_at > now()
    )
$$;

-- ------------------------------------------------------------
-- 7. Droits techniques : la RLS reste la protection principale ;
--    on retire en plus ce dont l'application n'a jamais besoin.
-- ------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
