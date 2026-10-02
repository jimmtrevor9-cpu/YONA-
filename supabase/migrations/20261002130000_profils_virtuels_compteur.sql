-- ============================================================
-- Profils virtuels — nombre de vrais membres inscrits
--
-- La page des profils affiche des profils d'exemple (fichier local du site, jamais en
-- base). Chaque vrai membre inscrit en fait disparaître un. Cette fonction renvoie
-- uniquement un nombre : les membres dont le profil est créé (onboarding terminé).
--
-- Règle de sécurité 24.12 : aucune fonction SECURITY DEFINER ouverte aux visiteurs.
-- Elle n'est donc exécutable que par le rôle service : le serveur de l'application
-- l'appelle (getRegisteredMembersCount).
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_registered_members()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.profiles WHERE onboarding_completed_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.count_registered_members() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_registered_members() TO service_role;
