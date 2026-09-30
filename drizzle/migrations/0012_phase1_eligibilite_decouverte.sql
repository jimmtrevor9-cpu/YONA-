-- ============================================================
-- Phase 1 — Étape 1.15 — Éligibilité à la découverte
--
-- Constat (voir docs/verification/phase-1/etape-1.15-eligibilite-decouverte.md) :
--   1. Un compte sans profil finalisé (ou un profil suspendu) pouvait parcourir
--      tous les profils, leurs informations chrétiennes et leurs photos.
--   2. La découverte ignorait les préférences enregistrées (sexe recherché,
--      tranche d'âge) : elles étaient saisies mais jamais utilisées.
-- Règles :
--   • peut parcourir les profils : compte actif ET profil finalisé
--     (statut « actif » ou « masqué ») — ou administrateur ;
--   • profils proposés : actifs, visibles, compte actif, sans blocage (règles
--     existantes), hors soi-même, conformes au sexe recherché et à la tranche
--     d'âge du membre, les plus récemment mis à jour d'abord.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Qui peut parcourir les profils des autres
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_browse_profiles()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid() AND u.status = 'active' AND p.status IN ('active', 'hidden')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_browse_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_browse_profiles() TO authenticated, service_role;

DROP POLICY IF EXISTS "profiles_select_visible" ON public.profiles;
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND status = 'active' AND visibility = 'visible'
    AND public.can_browse_profiles()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_active_account(user_id)
  );

DROP POLICY IF EXISTS "christian_select_visible" ON public.christian_profiles;
CREATE POLICY "christian_select_visible" ON public.christian_profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND public.can_browse_profiles()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_discoverable_profile(user_id)
  );

DROP POLICY IF EXISTS "photos_select_visible" ON public.photos;
CREATE POLICY "photos_select_visible" ON public.photos FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid() AND status = 'approved'
    AND public.can_browse_profiles()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND public.is_discoverable_profile(user_id)
  );

DROP POLICY IF EXISTS "photos_storage_select" ON storage.objects;
CREATE POLICY "photos_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'photos' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
      OR (
        public.can_browse_profiles()
        AND EXISTS (
          SELECT 1 FROM public.photos p
          WHERE p.storage_path = storage.objects.name
            AND p.status = 'approved'
            AND NOT public.is_blocked_between(auth.uid(), p.user_id)
            AND public.is_discoverable_profile(p.user_id)
        )
      )
    )
  );

-- ------------------------------------------------------------
-- 2. Profils proposés dans la découverte (droits du membre : la RLS s'applique)
-- ------------------------------------------------------------
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
  ORDER BY p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;
REVOKE EXECUTE ON FUNCTION public.discover_profiles(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer) TO authenticated, service_role;
