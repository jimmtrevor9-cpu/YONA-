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
