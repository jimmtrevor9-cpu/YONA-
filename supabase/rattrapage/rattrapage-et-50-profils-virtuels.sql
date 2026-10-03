-- ============================================================
-- YONA — RATTRAPAGE de la base + 50 profils virtuels (un seul fichier à coller)
--
-- À coller EN ENTIER dans Supabase → SQL Editor, puis « Run ».
-- Il exécute, dans l'ordre, ces migrations du dossier supabase/migrations/ :
--   1. 20261001090000_inscription_fluide.sql
--        (colonnes region, origin, terms_accepted_at, e-mails d'actualité,
--         « derniers inscrits », prénom Google)
--   2. 20261001100000_inscription_derniers_inscrits_serveur.sql
--        (« derniers inscrits » réservé au serveur)
--   3. 20261002100000_profils_virtuels_et_verification.sql
--        (profils virtuels, suppression automatique, vérification du profil)
--   4. 20261002110000_profils_virtuels_donnees.sql
--        (50 profils virtuels : 40 en Afrique francophone, 10 en France)
-- puis affiche un petit bilan.
--
-- Rejouable sans risque : chaque partie vérifie ce qui existe déjà. Si une erreur
-- survient, Supabase annule tout le fichier (rien n'est enregistré à moitié).
-- ============================================================

-- ############################################################
-- PARTIE 1 / 4 : 20261001090000_inscription_fluide.sql
-- ############################################################
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

-- ############################################################
-- PARTIE 2 / 4 : 20261001100000_inscription_derniers_inscrits_serveur.sql
-- ############################################################
-- ============================================================
-- Nouvelle inscription — bulle « … vient de s'inscrire »
--
-- Règle de sécurité 24.12 : aucune fonction SECURITY DEFINER ouverte aux visiteurs.
-- recent_signups() n'est donc plus appelable par anon / authenticated : le serveur de
-- l'application l'appelle avec le rôle service (getRecentSignups).
-- ============================================================
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;

-- ############################################################
-- PARTIE 3 / 4 : 20261002100000_profils_virtuels_et_verification.sql
-- ############################################################
-- ============================================================
-- Profils virtuels et vérification du profil
--
-- 1. profiles.is_virtual : marque les profils d'exemple (fictifs). Seul le serveur
--    (migrations, rôle service, administrateurs) peut poser ou retirer ce marqueur ; un
--    membre ne peut jamais le changer, ni sur son profil ni sur un autre.
-- 2. geo_countries : position de chaque pays (remplie par la migration suivante), pour
--    trouver « le pays le plus proche ».
-- 3. À chaque inscription d'un VRAI membre (profil validé pour la première fois), un
--    profil virtuel est supprimé : du même pays (de préférence du même sexe), sinon du
--    pays le plus proche. Une seule fois par membre. Un échec ne bloque jamais
--    l'inscription. La suppression vise uniquement un compte marqué virtuel à la fois
--    dans le profil (is_virtual) et dans le compte (fournisseur « virtual »).
-- 4. recent_signups() : les profils virtuels n'apparaissent pas dans « derniers inscrits ».
-- 5. Vérification du profil : table profile_verifications, espace de stockage privé
--    « verifications » (le membre dépose dans son dossier ; seuls les administrateurs
--    consultent), fonctions d'administration, et profiles.verified_at.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Marqueurs protégés : is_virtual, verified_at
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_virtual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_virtual_country_idx
  ON public.profiles (lower(btrim(country))) WHERE is_virtual;

CREATE OR REPLACE FUNCTION public.protect_server_profile_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Requête d'un membre (auth.uid() renseigné, hors administrateur) : ces champs restent
  -- ceux du serveur.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_virtual := false;
      NEW.verified_at := NULL;
    ELSE
      NEW.is_virtual := OLD.is_virtual;
      NEW.verified_at := OLD.verified_at;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.protect_server_profile_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_protect_server_fields ON public.profiles;
CREATE TRIGGER profiles_protect_server_fields BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_server_profile_fields();

-- ------------------------------------------------------------
-- 2. Position des pays (serveur uniquement)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.geo_countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL
);
CREATE INDEX IF NOT EXISTS geo_countries_name_idx ON public.geo_countries (lower(name));
ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_countries FROM anon, authenticated;
GRANT ALL ON public.geo_countries TO service_role;

-- ------------------------------------------------------------
-- 3. Remplacement automatique d'un profil virtuel
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.virtual_profile_removals (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  removed_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.virtual_profile_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.virtual_profile_removals FROM anon, authenticated;
GRANT ALL ON public.virtual_profile_removals TO service_role;

-- Supprime UN profil virtuel : même pays d'abord, sinon le pays le plus proche.
-- Renvoie l'identifiant supprimé (ou NULL s'il n'y en a plus).
CREATE OR REPLACE FUNCTION public.remove_one_virtual_profile(_country text, _gender public.gender)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _key text := lower(btrim(coalesce(_country, '')));
  _origin public.geo_countries%ROWTYPE;
  _target uuid;
BEGIN
  SELECT p.user_id INTO _target
  FROM public.profiles p
  WHERE p.is_virtual AND lower(btrim(p.country)) = _key
  ORDER BY (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF _target IS NULL THEN
    SELECT * INTO _origin FROM public.geo_countries g WHERE lower(g.name) = _key LIMIT 1;
    SELECT p.user_id INTO _target
    FROM public.profiles p
    LEFT JOIN public.geo_countries g ON lower(g.name) = lower(btrim(p.country))
    WHERE p.is_virtual
    ORDER BY
      CASE
        WHEN _origin.code IS NULL OR g.code IS NULL THEN 1e12
        ELSE power(g.lat - _origin.lat, 2)
           + power((g.lng - _origin.lng) * cos(radians((g.lat + _origin.lat) / 2)), 2)
      END,
      (p.gender IS NOT DISTINCT FROM _gender) DESC, p.created_at, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF _target IS NULL THEN
    RETURN NULL;
  END IF;

  -- Double vérification : uniquement un compte virtuel (profil ET compte marqués).
  DELETE FROM auth.users u
  WHERE u.id = _target
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN _target;
END; $$;
REVOKE ALL ON FUNCTION public.remove_one_virtual_profile(text, public.gender) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_one_virtual_profile(text, public.gender) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_virtual_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _removed uuid;
BEGIN
  IF NEW.is_virtual OR OLD.onboarding_completed_at IS NOT NULL OR NEW.onboarding_completed_at IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Une seule fois par membre (même s'il recommence son inscription).
    INSERT INTO public.virtual_profile_removals (user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    _removed := public.remove_one_virtual_profile(NEW.country, NEW.gender);
    UPDATE public.virtual_profile_removals SET removed_user_id = _removed
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Jamais d'échec d'inscription à cause des profils virtuels.
    RAISE WARNING 'replace_virtual_profile_on_signup: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.replace_virtual_profile_on_signup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_replace_virtual ON public.profiles;
CREATE TRIGGER profiles_replace_virtual AFTER UPDATE OF onboarding_completed_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.replace_virtual_profile_on_signup();

-- ------------------------------------------------------------
-- 4. « Derniers inscrits » : sans les profils virtuels
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recent_signups()
RETURNS TABLE (first_name text, country text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT split_part(p.first_name, ' ', 1), p.country, p.created_at
  FROM public.profiles p
  WHERE p.status = 'active'
    AND p.visibility = 'visible'
    AND NOT p.is_virtual
    AND p.onboarding_completed_at IS NOT NULL
    AND p.first_name IS NOT NULL
    AND p.created_at > now() - interval '7 days'
  ORDER BY p.created_at DESC
  LIMIT 8;
$$;
-- Règle 24.12 : fonction SECURITY DEFINER réservée au rôle service (l'application
-- l'appelle côté serveur, voir recent-signups.functions.ts).
REVOKE ALL ON FUNCTION public.recent_signups() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recent_signups() TO service_role;

-- ------------------------------------------------------------
-- 5. Vérification du profil (selfie ou pièce d'identité)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('selfie', 'id_document')),
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT profile_verifications_path_owner
    CHECK (split_part(storage_path, '/', 1) = user_id::text)
);
CREATE INDEX IF NOT EXISTS profile_verifications_user_idx
  ON public.profile_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_verifications_pending_idx
  ON public.profile_verifications (created_at) WHERE status = 'pending';
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.profile_verifications TO authenticated;
GRANT ALL ON public.profile_verifications TO service_role;

DROP POLICY IF EXISTS "verifications_select_own" ON public.profile_verifications;
CREATE POLICY "verifications_select_own" ON public.profile_verifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS "verifications_insert_own" ON public.profile_verifications;
CREATE POLICY "verifications_insert_own" ON public.profile_verifications FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND split_part(storage_path, '/', 1) = auth.uid()::text
  );

-- Espace de stockage privé (8 Mo par photo, images uniquement).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('verifications', 'verifications', false, 8388608,
  ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS "verifications_storage_insert_own" ON storage.objects;
CREATE POLICY "verifications_storage_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verifications' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "verifications_storage_select" ON storage.objects;
CREATE POLICY "verifications_storage_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'verifications'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
DROP POLICY IF EXISTS "verifications_storage_delete" ON storage.objects;
CREATE POLICY "verifications_storage_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verifications'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

CREATE OR REPLACE FUNCTION public.admin_list_pending_verifications()
RETURNS TABLE (
  id uuid, user_id uuid, first_name text, method text, storage_path text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, v.user_id, p.first_name, v.method, v.storage_path, v.created_at
  FROM public.profile_verifications v LEFT JOIN public.profiles p ON p.user_id = v.user_id
  WHERE v.status = 'pending'
  ORDER BY v.created_at
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_pending_verifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_pending_verifications() TO authenticated, service_role;

-- Décision de l'administrateur. Renvoie le chemin du fichier, que l'espace /admin
-- supprime ensuite : la photo de vérification n'est gardée que le temps de l'examen.
CREATE OR REPLACE FUNCTION public.admin_review_verification(_verification_id uuid, _approve boolean)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _owner uuid;
  _path text;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.profile_verifications
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE id = _verification_id AND status = 'pending'
  RETURNING user_id, storage_path INTO _owner, _path;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _approve THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _owner AND verified_at IS NULL;
  END IF;
  RETURN _path;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_verification(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_verification(uuid, boolean) TO authenticated, service_role;

-- ############################################################
-- PARTIE 4 / 4 : 20261002110000_profils_virtuels_donnees.sql
-- ############################################################
-- ============================================================
-- Profils virtuels : données (générées par scripts/generate-virtual-profiles.mjs)
--
-- * public.geo_countries : position de chaque pays (base GeoNames), pour « le pays le
--   plus proche » quand il n'y a plus de profil virtuel dans le pays d'un nouveau membre.
-- * 50 profils virtuels (25 femmes, 25 hommes) : 5 Gabon, 5 Cameroun, 5 Côte d'Ivoire, 5 Congo-Brazzaville, 5 Togo, 5 Bénin, 5 Sénégal, 5 Mali, 10 France,
--   22 à 48 ans. Ce sont des comptes sans mot de passe (connexion impossible), marqués
--   « virtual » dans le compte et is_virtual dans le profil. Aucune photo : la carte
--   affiche l'initiale, en attendant de vraies photos.
-- Aucune table n'est créée. Rejouable sans risque : un profil déjà présent n'est pas
-- recréé, et les profils virtuels d'une version précédente absents de la liste sont retirés.
-- À exécuter APRÈS 20261002100000_profils_virtuels_et_verification.sql.
-- ============================================================

INSERT INTO public.geo_countries (code, name, lat, lng) VALUES
  ('AF', 'Afghanistan', 34.64, 67.55),
  ('ZA', 'Afrique du Sud', -28.59, 27.24),
  ('AL', 'Albanie', 41.1, 20.01),
  ('DZ', 'Algérie', 34.84, 3.3),
  ('DE', 'Allemagne', 50.65, 10.18),
  ('AD', 'Andorre', 42.53, 1.55),
  ('AO', 'Angola', -10.9, 15.97),
  ('AI', 'Anguilla', 18.21, -63.06),
  ('AG', 'Antigua-et-Barbuda', 17.14, -61.8),
  ('SA', 'Arabie saoudite', 23.86, 44.13),
  ('AR', 'Argentine', -32.06, -62.61),
  ('AM', 'Arménie', 40.31, 44.57),
  ('AW', 'Aruba', 12.52, -70),
  ('AU', 'Australie', -32.28, 144.13),
  ('AT', 'Autriche', 47.62, 14.38),
  ('AZ', 'Azerbaïdjan', 40.35, 47.71),
  ('BS', 'Bahamas', 24.76, -76.52),
  ('BH', 'Bahreïn', 26.17, 50.55),
  ('BD', 'Bangladesh', 23.69, 90.26),
  ('BB', 'Barbade', 13.18, -59.57),
  ('BE', 'Belgique', 50.74, 4.52),
  ('BZ', 'Belize', 17.49, -88.58),
  ('BJ', 'Bénin', 8.09, 2.23),
  ('BM', 'Bermudes', 32.31, -64.77),
  ('BT', 'Bhoutan', 27.29, 90.27),
  ('BY', 'Biélorussie', 53.57, 27.82),
  ('BO', 'Bolivie', -17.52, -65.46),
  ('BA', 'Bosnie-Herzégovine', 44.36, 17.83),
  ('BW', 'Botswana', -22.93, 25.8),
  ('BR', 'Brésil', -16.49, -46.3),
  ('BN', 'Brunei', 4.85, 114.81),
  ('BG', 'Bulgarie', 42.8, 25.14),
  ('BF', 'Burkina Faso', 12.31, -1.63),
  ('BI', 'Burundi', -3.36, 29.78),
  ('KH', 'Cambodge', 12.18, 104.71),
  ('CM', 'Cameroun', 5.75, 11.54),
  ('CA', 'Canada', 48.24, -91.4),
  ('CV', 'Cap-Vert', 15.7, -23.9),
  ('CF', 'Centrafrique', 5.68, 18.99),
  ('CL', 'Chili', -35.27, -71.82),
  ('CN', 'Chine', 32.44, 110.25),
  ('CY', 'Chypre', 34.98, 33.24),
  ('CO', 'Colombie', 5.69, -74.76),
  ('KM', 'Comores', -11.95, 43.86),
  ('CG', 'Congo-Brazzaville', -1.98, 14.64),
  ('KP', 'Corée du Nord', 40.17, 127.23),
  ('KR', 'Corée du Sud', 36.1, 127.44),
  ('CR', 'Costa Rica', 9.96, -84.23),
  ('CI', 'Côte d''Ivoire', 7.22, -5.64),
  ('HR', 'Croatie', 45.14, 16.41),
  ('CU', 'Cuba', 22.07, -79.92),
  ('CW', 'Curaçao', 12.17, -68.97),
  ('DK', 'Danemark', 55.84, 10.68),
  ('DJ', 'Djibouti', 11.64, 42.78),
  ('DM', 'Dominique', 15.41, -61.36),
  ('EG', 'Égypte', 29.35, 31.43),
  ('AE', 'Émirats arabes unis', 25.1, 55.37),
  ('EC', 'Équateur', -1.48, -79.11),
  ('ER', 'Érythrée', 14.98, 38.87),
  ('ES', 'Espagne', 40.54, -3.23),
  ('EE', 'Estonie', 58.93, 25.4),
  ('SZ', 'Eswatini', -26.5, 31.43),
  ('VA', 'État de la Cité du Vatican', 41.9, 12.45),
  ('US', 'États-Unis', 38.34, -90.5),
  ('ET', 'Éthiopie', 9.17, 38.9),
  ('FJ', 'Fidji', -17.37, 155.86),
  ('FI', 'Finlande', 61.71, 24.77),
  ('FR', 'France', 46.99, 2.49),
  ('GA', 'Gabon', -0.84, 11.68),
  ('GM', 'Gambie', 13.42, -15.7),
  ('GE', 'Géorgie', 42.22, 42.92),
  ('GS', 'Géorgie du Sud-et-les Îles Sandwich du Sud', -54.28, -36.51),
  ('GH', 'Ghana', 6.69, -1.01),
  ('GI', 'Gibraltar', 36.13, -5.35),
  ('GR', 'Grèce', 38.82, 23.19),
  ('GD', 'Grenade', 12.18, -61.66),
  ('GL', 'Groenland', 65.86, -49.72),
  ('GP', 'Guadeloupe', 16.18, -61.56),
  ('GU', 'Guam', 13.44, 144.76),
  ('GT', 'Guatemala', 14.92, -90.85),
  ('GG', 'Guernesey', 49.48, -2.55),
  ('GN', 'Guinée', 10.61, -11.28),
  ('GQ', 'Guinée équatoriale', 1.75, 9.86),
  ('GW', 'Guinée-Bissau', 11.95, -15.35),
  ('GY', 'Guyana', 6.39, -58.13),
  ('GF', 'Guyane française', 4.91, -52.93),
  ('HT', 'Haïti', 18.99, -72.73),
  ('HN', 'Honduras', 14.79, -87.52),
  ('HU', 'Hongrie', 47.32, 19.53),
  ('CX', 'Île Christmas', -10.42, 105.68),
  ('IM', 'Île de Man', 54.22, -4.54),
  ('NF', 'Île Norfolk', -29.05, 167.97),
  ('AX', 'Îles Åland', 60.2, 20.18),
  ('KY', 'Îles Caïmans', 19.36, -81.13),
  ('CC', 'Îles Cocos', -12.16, 96.82),
  ('CK', 'Îles Cook', -21.22, -159.75),
  ('FO', 'Îles Féroé', 61.99, -6.82),
  ('FK', 'Îles Malouines', -51.69, -57.86),
  ('MP', 'Îles Mariannes du Nord', 15.15, 145.71),
  ('MH', 'Îles Marshall', 8.25, 168.99),
  ('UM', 'Îles mineures éloignées des États-Unis', 0, 0),
  ('PN', 'Îles Pitcairn', -25.07, -130.1),
  ('SB', 'Îles Salomon', -9.17, 159.79),
  ('TC', 'Îles Turques-et-Caïques', 21.76, -72.06),
  ('VG', 'Îles Vierges britanniques', 18.44, -64.53),
  ('VI', 'Îles Vierges des États-Unis', 18.14, -64.84),
  ('IN', 'Inde', 20.45, 79.18),
  ('ID', 'Indonésie', -3.81, 112.59),
  ('IQ', 'Irak', 34.29, 44.56),
  ('IR', 'Iran', 33.83, 51.72),
  ('IE', 'Irlande', 53.2, -7.38),
  ('IS', 'Islande', 64.61, -20.27),
  ('IL', 'Israël', 32.28, 35.06),
  ('IT', 'Italie', 43.43, 11.58),
  ('JM', 'Jamaïque', 18.15, -77.28),
  ('JP', 'Japon', 35.92, 137.14),
  ('JE', 'Jersey', 49.21, -2.1),
  ('JO', 'Jordanie', 31.87, 35.89),
  ('KZ', 'Kazakhstan', 48.34, 69.24),
  ('KE', 'Kenya', -0.61, 36.73),
  ('KG', 'Kirghizstan', 41.33, 73.35),
  ('KI', 'Kiribati', 1.77, 85.99),
  ('XK', 'Kosovo', 42.55, 20.78),
  ('KW', 'Koweït', 29.26, 48.03),
  ('RE', 'La Réunion', -21.12, 55.5),
  ('LA', 'Laos', 18.32, 103.84),
  ('LS', 'Lesotho', -29.56, 27.95),
  ('LV', 'Lettonie', 56.91, 24.5),
  ('LB', 'Liban', 33.78, 35.71),
  ('LR', 'Liberia', 6.47, -9.26),
  ('LY', 'Libye', 30.87, 16.01),
  ('LI', 'Liechtenstein', 47.17, 9.52),
  ('LT', 'Lituanie', 55.17, 23.84),
  ('LU', 'Luxembourg', 49.68, 6.11),
  ('MK', 'Macédoine du Nord', 41.68, 21.56),
  ('MG', 'Madagascar', -19.25, 47.33),
  ('MY', 'Malaisie', 3.84, 103.4),
  ('MW', 'Malawi', -14, 34.52),
  ('MV', 'Maldives', 3.16, 73.28),
  ('ML', 'Mali', 14.02, -5.45),
  ('MT', 'Malte', 35.92, 14.43),
  ('MA', 'Maroc', 32.85, -6.37),
  ('MQ', 'Martinique', 14.64, -60.99),
  ('MU', 'Maurice', -20.09, 57.71),
  ('MR', 'Mauritanie', 17.35, -12.56),
  ('YT', 'Mayotte', -12.81, 45.15),
  ('MX', 'Mexique', 20.19, -99.25),
  ('FM', 'Micronésie', 6.96, 151.76),
  ('MD', 'Moldavie', 47.09, 28.73),
  ('MC', 'Monaco', 43.74, 7.42),
  ('MN', 'Mongolie', 47.48, 102.55),
  ('ME', 'Monténégro', 42.56, 19.22),
  ('MS', 'Montserrat', 16.76, -62.21),
  ('MZ', 'Mozambique', -18.98, 35.72),
  ('MM', 'Myanmar (Birmanie)', 18.13, 96.22),
  ('NA', 'Namibie', -21.54, 17.09),
  ('NR', 'Nauru', -0.53, 166.93),
  ('NP', 'Népal', 27.85, 84.29),
  ('NI', 'Nicaragua', 12.6, -85.89),
  ('NE', 'Niger', 14.45, 6.31),
  ('NG', 'Nigeria', 8.74, 7.37),
  ('NU', 'Niue', -19.05, -169.92),
  ('NO', 'Norvège', 61.99, 10.26),
  ('NC', 'Nouvelle-Calédonie', -21.77, 166.05),
  ('NZ', 'Nouvelle-Zélande', -40.4, 173.32),
  ('OM', 'Oman', 23.06, 57.18),
  ('UG', 'Ouganda', 0.82, 32.07),
  ('UZ', 'Ouzbékistan', 40.6, 67.22),
  ('PK', 'Pakistan', 30.57, 71.27),
  ('PW', 'Palaos', 7.15, 134.26),
  ('PA', 'Panama', 8.46, -80.7),
  ('PG', 'Papouasie-Nouvelle-Guinée', -6.36, 146.97),
  ('PY', 'Paraguay', -25.26, -56.68),
  ('NL', 'Pays-Bas', 52.07, 5.46),
  ('BQ', 'Pays-Bas caribéens', 14.2, -66.36),
  ('PE', 'Pérou', -11.1, -75.29),
  ('PH', 'Philippines', 11.9, 122.73),
  ('PL', 'Pologne', 51.48, 19.43),
  ('PF', 'Polynésie française', -17.3, -148.48),
  ('PR', 'Porto Rico', 18.23, -66.38),
  ('PT', 'Portugal', 39.58, -9.75),
  ('QA', 'Qatar', 25.39, 51.43),
  ('HK', 'R.A.S. chinoise de Hong Kong', 22.32, 114.17),
  ('MO', 'R.A.S. chinoise de Macao', 22.16, 113.55),
  ('CD', 'RD Congo', -3.38, 23.52),
  ('DO', 'République dominicaine', 18.93, -70.55),
  ('RO', 'Roumanie', 45.8, 25.13),
  ('GB', 'Royaume-Uni', 52.85, -1.84),
  ('RU', 'Russie', 53.5, 57.2),
  ('RW', 'Rwanda', -2.05, 29.63),
  ('EH', 'Sahara occidental', 25.2, -13.8),
  ('BL', 'Saint-Barthélemy', 17.9, -62.85),
  ('KN', 'Saint-Christophe-et-Niévès', 17.29, -62.73),
  ('SM', 'Saint-Marin', 43.94, 12.46),
  ('MF', 'Saint-Martin', 18.07, -63.07),
  ('SX', 'Saint-Martin (partie néerlandaise)', 18.04, -63.05),
  ('PM', 'Saint-Pierre-et-Miquelon', 46.94, -56.28),
  ('VC', 'Saint-Vincent-et-les Grenadines', 13.19, -61.2),
  ('SH', 'Sainte-Hélène', -19.21, -9.54),
  ('LC', 'Sainte-Lucie', 13.92, -60.96),
  ('SV', 'Salvador', 13.69, -88.93),
  ('WS', 'Samoa', -13.81, -171.93),
  ('AS', 'Samoa américaines', -14.11, -170.55),
  ('ST', 'Sao Tomé-et-Principe', 0.35, 6.72),
  ('SN', 'Sénégal', 14.58, -15.51),
  ('RS', 'Serbie', 44.74, 20.41),
  ('SC', 'Seychelles', -4.61, 55.51),
  ('SL', 'Sierra Leone', 8.36, -11.8),
  ('SG', 'Singapour', 1.34, 103.83),
  ('SK', 'Slovaquie', 48.62, 18.7),
  ('SI', 'Slovénie', 46.22, 14.98),
  ('SO', 'Somalie', 6.03, 45.39),
  ('SD', 'Soudan', 14.38, 31.45),
  ('SS', 'Soudan du Sud', 7, 29.54),
  ('LK', 'Sri Lanka', 7.15, 80.46),
  ('SE', 'Suède', 58.97, 15.37),
  ('CH', 'Suisse', 47.06, 8.11),
  ('SR', 'Suriname', 5.73, -55.27),
  ('SJ', 'Svalbard et Jan Mayen', 74.57, 3.46),
  ('SY', 'Syrie', 34.91, 37.07),
  ('TJ', 'Tadjikistan', 38.76, 69.45),
  ('TW', 'Taïwan', 24.15, 120.67),
  ('TZ', 'Tanzanie', -5.81, 35.5),
  ('TD', 'Tchad', 12.03, 17.55),
  ('CZ', 'Tchéquie', 49.75, 15.71),
  ('TF', 'Terres australes françaises', -49.35, 70.22),
  ('IO', 'Territoire britannique de l''océan Indien', -7.26, 72.38),
  ('PS', 'Territoires palestiniens', 31.97, 35.12),
  ('TH', 'Thaïlande', 14.32, 101.19),
  ('TL', 'Timor oriental', -8.8, 125.73),
  ('TG', 'Togo', 8.23, 0.97),
  ('TK', 'Tokelau', -9.04, -171.87),
  ('TO', 'Tonga', -20.64, -174.94),
  ('TT', 'Trinité-et-Tobago', 10.47, -61.4),
  ('TN', 'Tunisie', 35.64, 10.02),
  ('TM', 'Turkménistan', 38.57, 59.47),
  ('TR', 'Turquie', 38.86, 34.4),
  ('TV', 'Tuvalu', -7.69, 178.29),
  ('UA', 'Ukraine', 48.43, 30.97),
  ('UY', 'Uruguay', -33.56, -56.18),
  ('VU', 'Vanuatu', -16.33, 167.83),
  ('VE', 'Venezuela', 9.4, -68.25),
  ('VN', 'Viêt Nam', 16.62, 106.32),
  ('WF', 'Wallis-et-Futuna', -13.96, -177.48),
  ('YE', 'Yémen', 14.9, 45.12),
  ('ZM', 'Zambie', -13.55, 28.12),
  ('ZW', 'Zimbabwe', -18.52, 30.34)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng;

DO $do$
DECLARE
  _seed jsonb := $seed$[
["virtuel.ga.01@profils-virtuels.yona.invalid","Prisca","Ondo","female","1997-10-29","Gabon","Estuaire","Libreville","Souriante et attentionnée, j'aime la cuisine et la louange. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Louange","Cuisine"],"Adventiste","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",20,38],
["virtuel.ga.02@profils-virtuels.yona.invalid","Steeve","Mintsa","male","2000-04-03","Gabon","Ogooué-Maritime","Port-Gentil","Dynamique et fidèle en amitié, je consacre mon temps libre à la louange. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Nature","Louange","Voyages"],"Adventiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Mariage","female",18,35],
["virtuel.ga.03@profils-virtuels.yona.invalid","Rachel","Obiang","female","1986-04-18","Gabon","Haut-Ogooué","Franceville","Calme et joyeuse, je partage mon temps entre mon travail et le cinéma. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique","Cinéma","Mode"],"Catholique","Chaque semaine","Matin et soir","Essentielle","Mariage","male",31,49],
["virtuel.ga.04@profils-virtuels.yona.invalid","Brice","Bivigou","male","1979-03-27","Gabon","Woleu-Ntem","Oyem","Posé mais déterminé, j'aime les voyages, le cinéma et les longues discussions. Je joue dans le groupe de louange de mon église. Prêt à bâtir une famille fondée sur l'amour et la foi.",["Lecture","Voyages","Cinéma"],"Protestante (Église évangélique du Gabon)","Chaque semaine","Plusieurs fois par semaine","Essentielle","Mariage","female",38,56],
["virtuel.ga.05@profils-virtuels.yona.invalid","Murielle","Nzé","female","2000-07-14","Gabon","Haut-Ogooué","Moanda","Je suis une femme simple, passionnée par la mode et la cuisine. La prière rythme mes journées. J'attends un homme de foi, doux et responsable.",["Cuisine","Nature","Mode","Bénévolat"],"Pentecôtiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","male",18,35],
["virtuel.cm.01@profils-virtuels.yona.invalid","Serge","Nana","male","1984-11-07","Cameroun","Centre","Yaoundé","Fils de Dieu avant tout, je trouve ma joie dans le cinéma et le sport. La prière rythme mes journées. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Nature","Voyages","Sport"],"Pentecôtiste","Plusieurs fois par semaine","Tous les jours","Au centre de ma vie","Mariage","female",33,51],
["virtuel.cm.02@profils-virtuels.yona.invalid","Brenda","Kamga","female","1984-06-04","Cameroun","Littoral","Douala","Douce mais déterminée, j'aime la photographie, les voyages et les longues discussions. J'enseigne à l'école du dimanche. J'attends un homme de foi, doux et responsable.",["Bénévolat","Voyages","Photographie"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",33,51],
["virtuel.cm.03@profils-virtuels.yona.invalid","Martial","Mbappé","male","1986-12-25","Cameroun","West","Bafoussam","Chaque journée est un cadeau de Dieu : je la remplis de louange et de musique. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Danse","Musique"],"Baptiste","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",31,49],
["virtuel.cm.04@profils-virtuels.yona.invalid","Nadine","Nkoulou","female","1980-08-14","Cameroun","North-West","Bamenda","Souriante et attentionnée, j'aime la cuisine et la danse. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Bénévolat","Cuisine","Danse","Cinéma"],"Pentecôtiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",37,55],
["virtuel.cm.05@profils-virtuels.yona.invalid","Guy","Onana","male","2001-12-03","Cameroun","North","Garoua","Souriant et attentionné, j'aime la mode et le bénévolat. La prière rythme mes journées. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Louange","Bénévolat"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",18,34],
["virtuel.ci.01@profils-virtuels.yona.invalid","Grâce","Ouattara","female","2003-01-06","Côte d'Ivoire","Abidjan Autonomous District","Abidjan","Je suis une femme simple, passionnée par la musique et le cinéma. Ma foi guide chacune de mes décisions. Je cherche une relation sérieuse, en vue du mariage.",["Lecture","Musique","Cinéma"],"Catholique","Plusieurs fois par semaine","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",18,32],
["virtuel.ci.02@profils-virtuels.yona.invalid","Cyrille","Ehui","male","1982-10-06","Côte d'Ivoire","Vallée du Bandama District","Bouaké","Dynamique et fidèle en amitié, je consacre mon temps libre à la danse. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Cuisine","Danse","Voyages"],"Catholique","Plusieurs fois par semaine","Matin et soir","Très importante","Mariage","female",35,53],
["virtuel.ci.03@profils-virtuels.yona.invalid","Laetitia","Konan","female","1986-03-31","Côte d'Ivoire","Lacs District","Yamoussoukro","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de danse. Le Psaume 23 m'accompagne depuis toujours. Prête à bâtir une famille fondée sur l'amour et la foi.",["Nature","Louange","Bénévolat","Danse"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",31,49],
["virtuel.ci.04@profils-virtuels.yona.invalid","Didier","Kouamé","male","1977-07-01","Côte d'Ivoire","Sassandra-Marahoue","Daloa","Calme et joyeux, je partage mon temps entre mon travail et les balades dans la nature. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Sport","Nature","Voyages"],"Harriste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","female",40,58],
["virtuel.ci.05@profils-virtuels.yona.invalid","Ange","Gnahoré","female","1991-09-06","Côte d'Ivoire","Bas-Sassandra District","San-Pédro","Dynamique et fidèle en amitié, je consacre mon temps libre à la cuisine. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Sport","Cuisine"],"Méthodiste","Chaque semaine","Tous les jours","Essentielle","Mariage","male",26,44],
["virtuel.cg.01@profils-virtuels.yona.invalid","Hardy","Matsiona","male","1990-06-30","Congo-Brazzaville","Brazzaville","Brazzaville","Posé mais déterminé, j'aime la lecture, la cuisine et les longues discussions. Ma foi guide chacune de mes décisions. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Lecture","Cuisine"],"Salutiste (Armée du Salut)","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.cg.02@profils-virtuels.yona.invalid","Grâce","Ibara","female","1988-11-26","Congo-Brazzaville","Pointe-Noire","Pointe-Noire","Calme et joyeuse, je partage mon temps entre mon travail et la lecture. Ma foi guide chacune de mes décisions. Prête à bâtir une famille fondée sur l'amour et la foi.",["Voyages","Lecture"],"Kimbanguiste","Chaque semaine","Matin et soir","Très importante","Mariage","male",29,47],
["virtuel.cg.03@profils-virtuels.yona.invalid","Varel","Miakassissa","male","2000-03-11","Congo-Brazzaville","Niari","Dolisie","Chaque journée est un cadeau de Dieu : je la remplis de musique et de mode. Ma foi guide chacune de mes décisions. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Mode","Musique","Photographie"],"Pentecôtiste","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Faire connaissance d'abord","female",18,35],
["virtuel.cg.04@profils-virtuels.yona.invalid","Victoire","Moukoko","female","1982-10-05","Congo-Brazzaville","Bouenza","Nkayi","Je suis une femme simple, passionnée par le sport et la musique. Je participe à un groupe de prière chaque semaine. Je cherche une relation sérieuse, en vue du mariage.",["Danse","Louange","Sport","Musique"],"Catholique","Chaque semaine","Matin et soir","Au centre de ma vie","Relation sérieuse","male",35,53],
["virtuel.cg.05@profils-virtuels.yona.invalid","Ulrich","Kimbembé","male","1983-12-02","Congo-Brazzaville","Cuvette","Owando","Posé mais déterminé, j'aime le cinéma, la musique et les longues discussions. Je participe à un groupe de prière chaque semaine. J'attends une femme de foi, douce et pleine de joie.",["Cinéma","Musique"],"Kimbanguiste","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.tg.01@profils-virtuels.yona.invalid","Dédé","Kudjoh","female","1980-07-30","Togo","Maritime","Lomé","Douce mais déterminée, j'aime la lecture, la danse et les longues discussions. Le Psaume 23 m'accompagne depuis toujours. Je cherche une relation sérieuse, en vue du mariage.",["Cinéma","Danse","Lecture"],"Évangélique presbytérienne","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Relation sérieuse","male",37,55],
["virtuel.tg.02@profils-virtuels.yona.invalid","Dodji","Lawson","male","1994-12-24","Togo","Centrale","Sokodé","Calme et joyeux, je partage mon temps entre mon travail et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Bénévolat","Photographie","Danse"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",23,41],
["virtuel.tg.03@profils-virtuels.yona.invalid","Dzifa","Ahadji","female","2002-03-28","Togo","Kara","Kara","Fille de Dieu avant tout, je trouve ma joie dans la lecture et les voyages. Je suis engagée dans le groupe de jeunes de ma paroisse. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Musique","Lecture","Voyages"],"Catholique","Chaque semaine","Tous les jours","Au centre de ma vie","Relation sérieuse","male",18,33],
["virtuel.tg.04@profils-virtuels.yona.invalid","Sénamé","Amegah","male","1984-12-04","Togo","Plateaux","Kpalimé","Chaque journée est un cadeau de Dieu : je la remplis de sport et de lecture. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Musique","Lecture","Mode","Sport"],"Évangélique presbytérienne","Chaque semaine","Matin et soir","Essentielle","Faire connaissance d'abord","female",33,51],
["virtuel.tg.05@profils-virtuels.yona.invalid","Mawuena","Dossou","female","1985-01-06","Togo","Plateaux","Atakpamé","Douce mais déterminée, j'aime la lecture, les balades dans la nature et les longues discussions. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Nature","Lecture","Sport"],"Assemblées de Dieu","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","male",32,50],
["virtuel.bj.01@profils-virtuels.yona.invalid","Gildas","Agossou","male","1977-01-03","Bénin","Littoral","Cotonou","Souriant et attentionné, j'aime la mode et la danse. Le Psaume 23 m'accompagne depuis toujours. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Musique","Danse","Mode"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Essentielle","Relation sérieuse","female",40,58],
["virtuel.bj.02@profils-virtuels.yona.invalid","Léonie","Kpossou","female","1999-11-22","Bénin","Ouémé","Porto-Novo","Je suis une femme simple, passionnée par le bénévolat et la mode. Le Psaume 23 m'accompagne depuis toujours. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Mode","Photographie","Bénévolat"],"Église du christianisme céleste","Deux à trois fois par mois","Tous les jours","Très importante","Relation sérieuse","male",18,36],
["virtuel.bj.03@profils-virtuels.yona.invalid","Arnaud","Hounkpatin","male","1983-01-01","Bénin","Borgou","Parakou","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. La prière rythme mes journées. J'aimerais rencontrer une femme qui place Dieu au centre de sa vie.",["Voyages","Photographie","Danse"],"Méthodiste","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",34,52],
["virtuel.bj.04@profils-virtuels.yona.invalid","Ornella","Akpovo","female","1993-10-21","Bénin","Zou","Abomey","Chaque journée est un cadeau de Dieu : je la remplis de balades dans la nature et de voyages. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Nature","Bénévolat","Voyages"],"Église du christianisme céleste","Chaque semaine","Plusieurs fois par semaine","Au centre de ma vie","Mariage","male",24,42],
["virtuel.bj.05@profils-virtuels.yona.invalid","Dieudonné","Zinsou","male","1983-02-23","Bénin","Atlantique","Abomey-Calavi","Je suis un homme simple, passionné par la cuisine et la lecture. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Cuisine","Lecture"],"Assemblées de Dieu","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.01@profils-virtuels.yona.invalid","Joséphine","Diène","female","1979-12-05","Sénégal","Dakar","Dakar","Je suis une femme simple, passionnée par la mode et le cinéma. Je sers à l'accueil de mon église le dimanche. Je crois au mariage, à la fidélité et au respect.",["Sport","Cinéma","Photographie","Mode"],"Évangélique","Plusieurs fois par semaine","Tous les jours","Essentielle","Faire connaissance d'abord","male",38,56],
["virtuel.sn.02@profils-virtuels.yona.invalid","Charles","Diouf","male","1989-01-17","Sénégal","Thies","Thiès","Je suis un homme simple, passionné par la photographie et la danse. J'aide à l'organisation des sorties de l'église. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Mode","Danse","Sport","Photographie"],"Catholique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","female",28,46],
["virtuel.sn.03@profils-virtuels.yona.invalid","Clémentine","Da Silva","female","1991-09-25","Sénégal","Ziguinchor","Ziguinchor","Souriante et attentionnée, j'aime la mode et le cinéma. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Sport","Mode","Cinéma"],"Adventiste","Chaque semaine","Matin et soir","Au centre de ma vie","Mariage","male",26,44],
["virtuel.sn.04@profils-virtuels.yona.invalid","Antoine","Ndour","male","1983-08-31","Sénégal","Saint-Louis","Saint-Louis","Fils de Dieu avant tout, je trouve ma joie dans la musique et la louange. J'aide à l'organisation des sorties de l'église. Je cherche une relation sérieuse, en vue du mariage.",["Louange","Musique","Cuisine"],"Catholique","Plusieurs fois par semaine","Tous les jours","Essentielle","Mariage","female",34,52],
["virtuel.sn.05@profils-virtuels.yona.invalid","Cécile","Mendy","female","2000-09-23","Sénégal","Thies","Mbour","Souriante et attentionnée, j'aime le bénévolat et la danse. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Danse","Louange","Bénévolat","Cuisine"],"Évangélique","Chaque semaine","Tous les jours","Très importante","Relation sérieuse","male",18,35],
["virtuel.ml.01@profils-virtuels.yona.invalid","Bernard","Kéita","male","1987-07-23","Mali","Bamako","Bamako","Posé mais déterminé, j'aime la cuisine, la mode et les longues discussions. J'aime méditer la Parole chaque matin. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Mode"],"Baptiste","Deux à trois fois par mois","Plusieurs fois par semaine","Essentielle","Mariage","female",30,48],
["virtuel.ml.02@profils-virtuels.yona.invalid","Béatrice","Konaté","female","1991-03-31","Mali","Sikasso","Sikasso","Douce mais déterminée, j'aime la cuisine, la photographie et les longues discussions. Je participe à un groupe de prière chaque semaine. Je crois au mariage, à la fidélité et au respect.",["Cuisine","Photographie","Cinéma","Sport"],"Baptiste","Chaque semaine","Tous les jours","Au centre de ma vie","Mariage","male",26,44],
["virtuel.ml.03@profils-virtuels.yona.invalid","Luc","Traoré","male","1990-08-01","Mali","Ségou","Ségou","Calme et joyeux, je partage mon temps entre mon travail et la musique. Je sers à l'accueil de mon église le dimanche. J'attends une femme de foi, douce et pleine de joie.",["Musique","Voyages"],"Baptiste","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Relation sérieuse","female",27,45],
["virtuel.ml.04@profils-virtuels.yona.invalid","Marthe","Dara","female","1992-08-08","Mali","Mopti","Mopti","Dynamique et fidèle en amitié, je consacre mon temps libre aux balades dans la nature. Le Psaume 23 m'accompagne depuis toujours. J'attends un homme de foi, doux et responsable.",["Musique","Nature","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Essentielle","Mariage","male",25,43],
["virtuel.ml.05@profils-virtuels.yona.invalid","Timothée","Togo","male","1992-09-23","Mali","Sikasso","Koutiala","Dynamique et fidèle en amitié, je consacre mon temps libre au cinéma. Je sers à l'accueil de mon église le dimanche. Je cherche une relation sérieuse, en vue du mariage.",["Musique","Cuisine","Cinéma"],"Baptiste","Plusieurs fois par semaine","Matin et soir","Essentielle","Relation sérieuse","female",25,43],
["virtuel.fr.01@profils-virtuels.yona.invalid","Anne","Bernard","female","1995-01-21","France","Île-de-France","Paris","Je suis une femme simple, passionnée par la mode et les voyages. Je sers à l'accueil de mon église le dimanche. J'attends un homme de foi, doux et responsable.",["Mode","Voyages","Lecture"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Essentielle","Faire connaissance d'abord","male",22,40],
["virtuel.fr.02@profils-virtuels.yona.invalid","Benoît","Lambert","male","2003-01-25","France","Auvergne-Rhône-Alpes","Lyon","Souriant et attentionné, j'aime le bénévolat et la danse. Je suis engagé dans le groupe de jeunes de ma paroisse. Je crois au mariage, à la fidélité et au respect.",["Danse","Bénévolat"],"Baptiste","Chaque semaine","Matin et soir","Très importante","Mariage","female",18,32],
["virtuel.fr.03@profils-virtuels.yona.invalid","Charlotte","Faure","female","1986-09-19","France","Provence-Alpes-Côte d'Azur","Marseille","Calme et joyeuse, je partage mon temps entre mon travail et la photographie. J'enseigne à l'école du dimanche. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Photographie","Mode"],"Catholique","Deux à trois fois par mois","Tous les jours","Au centre de ma vie","Relation sérieuse","male",31,49],
["virtuel.fr.04@profils-virtuels.yona.invalid","Antoine","André","male","1980-04-29","France","Occitanie","Toulouse","Dynamique et fidèle en amitié, je consacre mon temps libre à la photographie. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Nature","Photographie"],"Catholique","Plusieurs fois par semaine","Plusieurs fois par semaine","Très importante","Relation sérieuse","female",37,55],
["virtuel.fr.05@profils-virtuels.yona.invalid","Sophie","Lefebvre","female","1993-06-22","France","New Aquitaine","Bordeaux","Fille de Dieu avant tout, je trouve ma joie dans les voyages et la musique. Je chante dans la chorale de mon église. J'aimerais rencontrer un homme qui place Dieu au centre de sa vie.",["Voyages","Musique"],"Catholique","Deux à trois fois par mois","Matin et soir","Au centre de ma vie","Faire connaissance d'abord","male",24,42],
["virtuel.fr.06@profils-virtuels.yona.invalid","Julien","Masson","male","2003-02-02","France","Hauts-de-France","Lille","Fils de Dieu avant tout, je trouve ma joie dans la louange et la danse. La prière rythme mes journées. J'attends une femme de foi, douce et pleine de joie.",["Louange","Danse"],"Catholique","Deux à trois fois par mois","Tous les jours","Essentielle","Relation sérieuse","female",18,32],
["virtuel.fr.07@profils-virtuels.yona.invalid","Laure","Laurent","female","2000-04-29","France","Pays de la Loire","Nantes","Je suis une femme simple, passionnée par la photographie et les voyages. Je participe à un groupe de prière chaque semaine. Prête à bâtir une famille fondée sur l'amour et la foi.",["Photographie","Voyages"],"Protestante réformée","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",18,35],
["virtuel.fr.08@profils-virtuels.yona.invalid","David","Martin","male","1990-05-10","France","Grand Est","Strasbourg","Chaque journée est un cadeau de Dieu : je la remplis de danse et de louange. Je sers à l'accueil de mon église le dimanche. Je souhaite rencontrer une femme sincère pour construire un foyer béni.",["Louange","Photographie","Lecture","Danse"],"Baptiste","Plusieurs fois par semaine","Tous les jours","Très importante","Relation sérieuse","female",27,45],
["virtuel.fr.09@profils-virtuels.yona.invalid","Sarah","Fontaine","female","1993-06-08","France","Brittany","Rennes","Douce mais déterminée, j'aime le sport, la lecture et les longues discussions. Je participe à un groupe de prière chaque semaine. Je souhaite rencontrer un homme sincère pour construire un foyer béni.",["Cuisine","Lecture","Sport"],"Évangélique","Chaque semaine","Tous les jours","Essentielle","Relation sérieuse","male",24,42],
["virtuel.fr.10@profils-virtuels.yona.invalid","Nicolas","Rousseau","male","1978-09-29","France","Occitanie","Montpellier","Calme et joyeux, je partage mon temps entre mon travail et le sport. Le Psaume 23 m'accompagne depuis toujours. Je crois au mariage, à la fidélité et au respect.",["Mode","Sport","Lecture","Louange"],"Catholique","Deux à trois fois par mois","Plusieurs fois par semaine","Au centre de ma vie","Relation sérieuse","female",39,57]
]$seed$;
  _col text;
BEGIN
  -- 0. Profils virtuels laissés par une version précédente et absents de cette liste :
  --    retirés (uniquement des comptes virtuels : fournisseur « virtual » + adresse
  --    @profils-virtuels.yona.invalid). Il reste ainsi exactement 50 profils virtuels.
  DELETE FROM auth.users u
  WHERE u.email LIKE '%@profils-virtuels.yona.invalid'
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_seed) e WHERE e ->> 0 = u.email);

  -- 1. Comptes sans mot de passe (le déclencheur handle_new_user crée users, profiles,
  --    préférences…). Un compte déjà présent (même adresse) n'est pas recréé.
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
    e ->> 0, '', now(),
    jsonb_build_object('provider', 'virtual', 'providers', jsonb_build_array('virtual')),
    jsonb_build_object('first_name', e ->> 1, 'last_name', e ->> 2, 'is_virtual', true),
    now(), now()
  FROM jsonb_array_elements(_seed) e
  WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = e ->> 0);

  -- Colonnes texte du service d'authentification : jamais NULL (sinon l'écran des
  -- utilisateurs de Supabase peut échouer). Seules les colonnes présentes sont touchées.
  FOREACH _col IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
    'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = _col
    ) THEN
      EXECUTE format(
        'UPDATE auth.users SET %I = '''' WHERE %I IS NULL AND email LIKE %L',
        _col, _col, '%@profils-virtuels.yona.invalid'
      );
    END IF;
  END LOOP;

  -- 2. Profils complets, actifs et visibles.
  UPDATE public.profiles p
  SET first_name = e ->> 1,
      gender = (e ->> 3)::public.gender,
      birth_date = (e ->> 4)::date,
      country = e ->> 5,
      region = e ->> 6,
      city = e ->> 7,
      bio = e ->> 8,
      interests = ARRAY(SELECT jsonb_array_elements_text(e -> 9)),
      is_virtual = true,
      terms_accepted_at = now(),
      onboarding_step = 4,
      onboarding_completed_at = coalesce(p.onboarding_completed_at, now()),
      status = 'active',
      visibility = 'visible'
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE p.user_id = u.id;

  UPDATE public.christian_profiles c
  SET denomination = e ->> 10,
      church_attendance = e ->> 11,
      prayer_practice = e ->> 12,
      faith_importance = e ->> 13
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE c.user_id = u.id;

  UPDATE public.preferences pr
  SET relationship_goal = e ->> 14,
      preferred_gender = (e ->> 15)::public.gender,
      min_age = (e ->> 16)::smallint,
      max_age = (e ->> 17)::smallint
  FROM jsonb_array_elements(_seed) e
  JOIN public.users u ON u.email = e ->> 0
  WHERE pr.user_id = u.id;
END
$do$;

-- ############################################################
-- BILAN (le tableau affiché en bas de l'éditeur)
-- ############################################################
SELECT 'Profils virtuels (total)' AS verification, count(*)::text AS resultat
FROM public.profiles WHERE is_virtual
UNION ALL
SELECT 'Profils virtuels : ' || country, count(*)::text
FROM public.profiles WHERE is_virtual GROUP BY country
UNION ALL
SELECT 'Colonne profiles.region présente',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'region')
  THEN 'oui' ELSE 'NON' END
UNION ALL
SELECT 'Table de vérification du profil présente',
  CASE WHEN to_regclass('public.profile_verifications') IS NOT NULL THEN 'oui' ELSE 'NON' END
UNION ALL
SELECT 'Espace privé « verifications » présent',
  CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'verifications') THEN 'oui' ELSE 'NON' END;
