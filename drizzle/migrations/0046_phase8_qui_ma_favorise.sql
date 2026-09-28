-- Phase 8 / Étape 8.8 — Permettre à Premium de voir qui l'a mis en favori.
-- `get_favorited_by()` renvoie désormais, pour un membre Premium actif, le prénom, la date
-- de naissance, la ville, le pays et la date d'ajout de chaque membre qui l'a mis en
-- favori, les plus récents d'abord. Ne sont renvoyés que les membres dont le profil est
-- visible et actif (`is_discoverable_profile`), sans blocage dans un sens ou dans l'autre,
-- et seulement si la personne connectée peut consulter les profils (`can_browse_profiles`).
-- Membre non Premium : aucune ligne (le refus explicite est l'étape 8.9).

DROP FUNCTION IF EXISTS public.get_favorited_by();
CREATE FUNCTION public.get_favorited_by()
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  favorited_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.user_id, p.first_name, p.birth_date, p.city, p.country, f.created_at
  FROM public.favorites f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.favorite_user_id = auth.uid()
    AND public.is_premium(auth.uid())
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(f.user_id)
    AND NOT public.is_blocked_between(auth.uid(), f.user_id)
  ORDER BY f.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.get_favorited_by() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_favorited_by() TO authenticated, service_role;
