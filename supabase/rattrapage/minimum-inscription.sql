-- ============================================================
-- YONA — MINIMUM pour débloquer l'inscription (petit fichier, à coller en entier)
--
-- Ajoute seulement ce dont la création du profil a besoin (extrait de la migration
-- 20261001090000_inscription_fluide.sql) et referme « derniers inscrits » aux visiteurs
-- (20261001100000). Rejouable sans risque. Le fichier complet
-- rattrapage-et-50-profils-virtuels.sql pourra être lancé plus tard, sans conflit.
-- ============================================================

-- 1. Profil : région, origine, date d'acceptation des conditions.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_region_length,
  ADD CONSTRAINT profiles_region_length CHECK (region IS NULL OR char_length(region) <= 100),
  DROP CONSTRAINT IF EXISTS profiles_origin_length,
  ADD CONSTRAINT profiles_origin_length CHECK (origin IS NULL OR char_length(origin) <= 60);

-- La date d'acceptation ne peut pas être dans le futur ni être effacée une fois posée.
CREATE OR REPLACE FUNCTION public.protect_terms_accepted_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := OLD.terms_accepted_at;
  ELSIF NEW.terms_accepted_at IS NOT NULL THEN
    NEW.terms_accepted_at := LEAST(NEW.terms_accepted_at, now());
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_terms_accepted_at() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_protect_terms ON public.profiles;
CREATE TRIGGER profiles_protect_terms BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_terms_accepted_at();

-- 2. Paramètres : « Reste au courant » (e-mails d'actualité). Si la table des paramètres
--    n'existe pas encore, cette étape est sautée (le bilan l'indiquera par « NON »).
DO $$
BEGIN
  IF to_regclass('public.user_settings') IS NOT NULL THEN
    ALTER TABLE public.user_settings
      ADD COLUMN IF NOT EXISTS marketing_emails boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. « Derniers inscrits » : réservé au serveur du site, plus lisible par les visiteurs.
DO $$
BEGIN
  IF to_regprocedure('public.recent_signups()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;
  END IF;
END $$;

-- 4. Bilan (tableau affiché en bas de l'éditeur) : tout doit indiquer « oui ».
SELECT 'Colonne ' || c AS verification,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  ) THEN 'oui' ELSE 'NON' END AS resultat
FROM (VALUES ('profiles', 'region'), ('profiles', 'origin'),
             ('profiles', 'terms_accepted_at'), ('user_settings', 'marketing_emails')) AS v(t, c);
