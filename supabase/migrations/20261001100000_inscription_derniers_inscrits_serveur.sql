-- ============================================================
-- Nouvelle inscription — bulle « … vient de s'inscrire »
--
-- Règle de sécurité 24.12 : aucune fonction SECURITY DEFINER ouverte aux visiteurs.
-- recent_signups() n'est donc plus appelable par anon / authenticated : le serveur de
-- l'application l'appelle avec le rôle service (getRecentSignups).
-- ============================================================
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;
