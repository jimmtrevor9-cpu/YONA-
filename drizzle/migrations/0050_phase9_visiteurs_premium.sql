-- Phase 9 / Étape 9.4 — Afficher les visiteurs à Premium.
-- `get_profile_visitors()` renvoie désormais, pour un membre Premium actif, un visiteur
-- par ligne : prénom, date de naissance, ville, pays, date de la dernière visite et
-- nombre de visites, les plus récentes d'abord (100 au plus). Seuls les visiteurs dont le
-- profil est visible et actif, sans blocage dans un sens ou dans l'autre, sont renvoyés,
-- et seulement si la personne connectée peut consulter les profils.
-- Membre non Premium : aucune ligne (le refus explicite est l'étape 9.5).

DROP FUNCTION IF EXISTS public.get_profile_visitors();
CREATE FUNCTION public.get_profile_visitors()
RETURNS TABLE (
  visitor_id uuid,
  first_name text,
  birth_date date,
  city text,
  country text,
  visited_at timestamptz,
  visit_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.visitor_id, p.first_name, p.birth_date, p.city, p.country,
         max(v.visited_at) AS visited_at, count(*)::integer AS visit_count
  FROM public.profile_visits v
  JOIN public.profiles p ON p.user_id = v.visitor_id
  WHERE v.visited_user_id = auth.uid()
    AND public.is_premium(auth.uid())
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(v.visitor_id)
    AND NOT public.is_blocked_between(auth.uid(), v.visitor_id)
  GROUP BY v.visitor_id, p.first_name, p.birth_date, p.city, p.country
  ORDER BY max(v.visited_at) DESC
  LIMIT 100
$$;

REVOKE ALL ON FUNCTION public.get_profile_visitors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_visitors() TO authenticated, service_role;
