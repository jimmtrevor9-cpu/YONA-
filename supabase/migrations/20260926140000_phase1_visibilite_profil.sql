-- ============================================================
-- Phase 1 — Étape 1.14 — Visibilité du profil
--
-- Un profil n'est montré aux autres membres que s'il est « actif », « visible »,
-- que le compte est actif et qu'aucun blocage n'existe (règles RLS de l'étape 0.6).
-- Problèmes constatés (voir docs/verification/phase-1/etape-1.14-visibilite-profil.md) :
--   1. Un membre pouvait passer son profil en « actif » directement via l'API
--      sans prénom, sexe ni date de naissance → profil vide montré aux autres.
--   2. Un membre pouvait se mettre lui-même en statut « suspendu » (statut
--      réservé à la modération) puis ne plus pouvoir en sortir.
-- Les contrôles s'appliquent aux requêtes des membres ; les administrateurs
-- et le serveur (sans utilisateur connecté) ne sont pas concernés.
-- Rejouable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_profile_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'suspended' AND OLD.status IS DISTINCT FROM 'suspended' THEN
    RAISE EXCEPTION 'profile_status_forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.status = 'active' AND (
    NULLIF(btrim(NEW.first_name), '') IS NULL OR NEW.gender IS NULL OR NEW.birth_date IS NULL
  ) THEN
    RAISE EXCEPTION 'profile_incomplete' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.check_profile_visibility() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_check_visibility ON public.profiles;
CREATE TRIGGER profiles_check_visibility BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_visibility();
