-- Phase 8 / Étape 8.9 — Bloquer l'accès Free à « Qui m'a mis en favori ».
-- `get_favorited_by()` refuse désormais explicitement un membre sans abonnement Premium
-- actif (erreur `premium_required`) au lieu de renvoyer une liste vide : l'application
-- peut ainsi distinguer « personne » de « réservé Premium », sans jamais transmettre
-- la moindre information (ni liste, ni nombre) à un membre gratuit.

CREATE OR REPLACE FUNCTION public.get_favorited_by()
RETURNS TABLE (
  user_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  favorited_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_premium(auth.uid()) THEN
    RAISE EXCEPTION 'premium_required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT f.user_id, p.first_name, p.birth_date, p.city, p.country, f.created_at
  FROM public.favorites f
  JOIN public.profiles p ON p.user_id = f.user_id
  WHERE f.favorite_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(f.user_id)
    AND NOT public.is_blocked_between(auth.uid(), f.user_id)
  ORDER BY f.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_favorited_by() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_favorited_by() TO authenticated, service_role;
