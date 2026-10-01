-- ============================================================
-- Nouvelle inscription (parcours en étapes, connexion Google)
--
-- Ajoute les quelques informations demandées par le nouveau parcours :
--   * profiles.region            : province / région (étape « Où es-tu ? »)
--   * profiles.origin            : origine (fenêtre « Complète ton profil »)
--   * profiles.terms_accepted_at : date d'acceptation des conditions (18 ans et plus)
--   * user_settings.marketing_emails : « Reste au courant » (e-mails d'actualité)
-- et une petite fonction publique pour l'écran d'accueil de l'inscription :
--   * recent_signups() : prénoms et pays des derniers membres inscrits et visibles
--     (aucune photo, aucune ville, aucun identifiant).
-- ============================================================
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

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS marketing_emails boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.recent_signups()
RETURNS TABLE (first_name text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(p.first_name, ' ', 1), p.country, p.created_at
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.visibility = 'visible'
    AND p.onboarding_completed_at IS NOT NULL
    AND p.first_name IS NOT NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 8;
$$;
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO anon, authenticated;

-- Connexion Google : Google envoie « full_name » / « name » (et parfois « given_name »)
-- au lieu de « first_name ». Le premier mot du nom sert alors de prénom de départ.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  _first text;
BEGIN
  _first := NULLIF(btrim(_meta ->> 'first_name'), '');
  IF _first IS NULL THEN
    _first := NULLIF(btrim(_meta ->> 'given_name'), '');
  END IF;
  IF _first IS NULL THEN
    _first := NULLIF(split_part(btrim(COALESCE(_meta ->> 'full_name', _meta ->> 'name', '')), ' ', 1), '');
  END IF;
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.profiles (user_id, first_name) VALUES (NEW.id, left(_first, 60));
  INSERT INTO public.christian_profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_activity (user_id, last_login_at, last_seen_at) VALUES (NEW.id, now(), now());
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
