-- ============================================================
-- Phase 2 — Étape 2.7 — Ne plus afficher les profils déjà traités
--
-- Constat (voir docs/verification/phase-2/etape-2.7-profils-traites.md) :
-- la découverte (discover_profiles, étape 1.15) proposait encore les profils
-- déjà aimés ou passés par le membre.
-- Règle : un profil pour lequel le membre a un Like ou un Pass actif n'est plus
-- proposé ; un Like retiré (« withdrawn ») le rend de nouveau proposable.
-- Le reste de la fonction est inchangé. Rejouable.
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
  ORDER BY p.updated_at DESC
  LIMIT least(greatest(coalesce(_limit, 30), 1), 50)
$$;
REVOKE EXECUTE ON FUNCTION public.discover_profiles(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.discover_profiles(integer) TO authenticated, service_role;
