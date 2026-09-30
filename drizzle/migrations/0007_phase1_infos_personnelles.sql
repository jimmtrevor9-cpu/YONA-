-- ============================================================
-- Phase 1 — Étape 1.9 — Informations personnelles : règles côté serveur
--
-- Avant : aucune vérification ; un profil pouvait déclarer un âge de moins de
-- 18 ans, une date de naissance future ou antérieure à 1900, et des textes de
-- ville / pays / profession de longueur illimitée.
-- Les mêmes règles sont affichées dans l'interface
-- (src/features/profiles/personal-info.ts). Rejouable.
-- ============================================================

-- Date de naissance : entre le 1er janvier 1900 et « aujourd'hui − 18 ans ».
-- (Déclencheur plutôt que contrainte CHECK : current_date n'est pas immuable.)
-- Vérifiée seulement quand la date change, pour ne jamais bloquer la mise à jour
-- d'autres champs d'un profil existant.
CREATE OR REPLACE FUNCTION public.check_profile_personal_info()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.birth_date IS DISTINCT FROM OLD.birth_date) THEN
    IF NEW.birth_date < DATE '1900-01-01' OR NEW.birth_date > current_date THEN
      RAISE EXCEPTION 'invalid_birth_date' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.birth_date > (current_date - interval '18 years')::date THEN
      RAISE EXCEPTION 'underage: 18 ans minimum' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.check_profile_personal_info() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_check_personal_info ON public.profiles;
CREATE TRIGGER profiles_check_personal_info BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_profile_personal_info();

-- Ville, pays, profession : 100 caractères maximum.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_city_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_city_length CHECK (city IS NULL OR char_length(city) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_country_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_country_length CHECK (country IS NULL OR char_length(country) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profession_length' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_profession_length CHECK (profession IS NULL OR char_length(profession) <= 100);
  END IF;
END $$;
