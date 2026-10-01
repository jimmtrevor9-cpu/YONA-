-- Phase 9 / Étape 9.5 — Bloquer l'accès Free à « Qui a visité mon profil ».
-- `get_profile_visitors()` refuse désormais explicitement un membre sans abonnement
-- Premium actif (erreur `premium_required`) au lieu de renvoyer une liste vide. Un membre
-- gratuit ne reçoit aucune information : ni liste, ni nombre.

CREATE OR REPLACE FUNCTION public.get_profile_visitors()
RETURNS TABLE (
  visitor_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  visited_at timestamptz,
  visit_count integer
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
  SELECT v.visitor_id, p.first_name, p.birth_date, p.city, p.country,
         max(v.visited_at) AS visited_at, count(*)::integer AS visit_count
  FROM public.profile_visits v
  JOIN public.profiles p ON p.user_id = v.visitor_id
  WHERE v.visited_user_id = auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(v.visitor_id)
    AND NOT public.is_blocked_between(auth.uid(), v.visitor_id)
  GROUP BY v.visitor_id, p.first_name, p.birth_date, p.city, p.country
  ORDER BY max(v.visited_at) DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_visitors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_visitors() TO authenticated, service_role;
