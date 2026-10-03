-- ============================================================
-- Profils de démonstration (40) : photo autorisée obligatoire, étiquette visible,
-- suppression à la vérification d'identité.
--
-- 1. profiles.demo_photo_path / demo_photo_source : photo d'un profil de démonstration,
--    livrée avec le site (/demo-profils/…, images générées fournies par le propriétaire)
--    ou déposée par un administrateur (espace public « demo-profils ») avec la nature de
--    l'image attestée (visage généré d'une personne qui n'existe pas, image sous licence,
--    ou accord écrit de la personne). Un profil de démonstration SANS photo n'est jamais
--    montré aux membres.
-- 2. Champs protégés : un membre ne peut ni poser ni modifier ces champs.
-- 3. is_discoverable_profile : un profil de démonstration sans photo n'est pas visible.
-- 4. Demandes de contact et Message Flash refusés vers un profil de démonstration (il ne
--    peut pas répondre) : rien n'est décompté.
-- 5. Suppression automatique : un profil de démonstration est retiré à chaque vrai membre
--    dont l'IDENTITÉ EST VÉRIFIÉE (profiles.verified_at posé), et non plus à la fin du
--    profil. Une seule fois par membre, de préférence dans le pays retenu du membre et du
--    sexe qu'il recherche, en commençant par les profils visibles ; jamais un vrai compte ;
--    un échec ne bloque jamais la vérification. La photo est mise en file de suppression.
-- 6. File de suppression de fichiers (storage_cleanup_queue), vidée par le serveur.
-- 7. Administration : liste des profils de démonstration, pose / retrait de la photo.
-- Rejouable (IF NOT EXISTS, CREATE OR REPLACE, DROP … IF EXISTS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Photo d'un profil de démonstration
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS demo_photo_path text,
  ADD COLUMN IF NOT EXISTS demo_photo_source text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_demo_photo_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_demo_photo_check CHECK (
  (demo_photo_path IS NULL AND demo_photo_source IS NULL)
  OR (
    is_virtual
    AND char_length(demo_photo_path) BETWEEN 1 AND 300
    AND (
      split_part(demo_photo_path, '/', 1) = user_id::text
      OR demo_photo_path ~ '^/demo-profils/[a-z0-9-]+\.(webp|jpg|png)$'
    )
    AND demo_photo_source IN ('generated', 'licensed', 'consent')
  )
);

COMMENT ON COLUMN public.profiles.demo_photo_path IS
  'Profil de démonstration : chemin de la photo dans le stockage public « demo-profils ».';
COMMENT ON COLUMN public.profiles.demo_photo_source IS
  'Nature attestée par l''administrateur : generated (personne qui n''existe pas), licensed (licence), consent (accord écrit).';

-- Espace de stockage public (lecture par lien) ; écriture réservée aux administrateurs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('demo-profils', 'demo-profils', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS demo_storage_select_admin ON storage.objects;
CREATE POLICY demo_storage_select_admin ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'demo-profils' AND public.is_admin());
DROP POLICY IF EXISTS demo_storage_insert_admin ON storage.objects;
CREATE POLICY demo_storage_insert_admin ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'demo-profils' AND public.is_admin());
DROP POLICY IF EXISTS demo_storage_update_admin ON storage.objects;
CREATE POLICY demo_storage_update_admin ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'demo-profils' AND public.is_admin())
  WITH CHECK (bucket_id = 'demo-profils' AND public.is_admin());
DROP POLICY IF EXISTS demo_storage_delete_admin ON storage.objects;
CREATE POLICY demo_storage_delete_admin ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'demo-profils' AND public.is_admin());

-- ------------------------------------------------------------
-- 2. Champs réservés au serveur
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_server_profile_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Requête d'un membre (auth.uid() renseigné, hors administrateur) : ces champs restent
  -- ceux du serveur.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_virtual := false;
      NEW.verified_at := NULL;
      NEW.demo_photo_path := NULL;
      NEW.demo_photo_source := NULL;
    ELSE
      NEW.is_virtual := OLD.is_virtual;
      NEW.verified_at := OLD.verified_at;
      NEW.demo_photo_path := OLD.demo_photo_path;
      NEW.demo_photo_source := OLD.demo_photo_source;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ------------------------------------------------------------
-- 3. Profil visible : un profil de démonstration seulement avec sa photo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_discoverable_profile(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = _user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active'
      AND (NOT p.is_virtual OR p.demo_photo_path IS NOT NULL)
  )
$$;

-- ------------------------------------------------------------
-- 4. Pas de demande de contact vers un profil de démonstration
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refuse_contact_to_demo_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = NEW.receiver_id AND p.is_virtual) THEN
    RAISE EXCEPTION 'demo_profile' USING ERRCODE = '22023',
      HINT = 'Profil de démonstration : il ne peut pas répondre.';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.refuse_contact_to_demo_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS contact_requests_refuse_demo ON public.contact_requests;
CREATE TRIGGER contact_requests_refuse_demo BEFORE INSERT ON public.contact_requests
  FOR EACH ROW EXECUTE FUNCTION public.refuse_contact_to_demo_profile();

-- ------------------------------------------------------------
-- 6. File de suppression de fichiers (vidée par le serveur avec la clé service)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_cleanup_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_id text NOT NULL,
  path text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz,
  CONSTRAINT storage_cleanup_queue_reason_length CHECK (char_length(reason) <= 100)
);
CREATE INDEX IF NOT EXISTS storage_cleanup_queue_pending_idx
  ON public.storage_cleanup_queue (created_at) WHERE done_at IS NULL;
ALTER TABLE public.storage_cleanup_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storage_cleanup_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.storage_cleanup_queue TO service_role;
REVOKE ALL ON SEQUENCE public.storage_cleanup_queue_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.storage_cleanup_queue_id_seq TO service_role;

-- ------------------------------------------------------------
-- 5. Suppression d'un profil de démonstration à chaque identité vérifiée
-- ------------------------------------------------------------
ALTER TABLE public.virtual_profile_removals
  ADD COLUMN IF NOT EXISTS reason text;

-- Pays retenu d'un membre : celui de son profil (la tâche « localisation » ajoute la
-- position réelle, prioritaire).
CREATE OR REPLACE FUNCTION public.member_country(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.country FROM public.profiles p WHERE p.user_id = _user_id
$$;
REVOKE EXECUTE ON FUNCTION public.member_country(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_country(uuid) TO service_role;

-- _gender : sexe RECHERCHÉ par le nouveau membre (NULL = les deux, pas de préférence).
CREATE OR REPLACE FUNCTION public.remove_one_virtual_profile(_country text, _gender public.gender)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _key text := lower(btrim(coalesce(_country, '')));
  _origin public.geo_countries%ROWTYPE;
  _target uuid;
  _photo text;
BEGIN
  -- D'abord dans le pays du membre : sexe recherché, puis profils visibles (avec photo).
  SELECT p.user_id INTO _target
  FROM public.profiles p
  WHERE p.is_virtual AND lower(btrim(p.country)) = _key
  ORDER BY (_gender IS NULL OR p.gender = _gender) DESC, (p.demo_photo_path IS NOT NULL) DESC,
           p.created_at, p.user_id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Sinon dans le pays le plus proche.
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
      (_gender IS NULL OR p.gender = _gender) DESC, (p.demo_photo_path IS NOT NULL) DESC,
      p.created_at, p.user_id
    LIMIT 1
    FOR UPDATE OF p SKIP LOCKED;
  END IF;

  IF _target IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.demo_photo_path INTO _photo FROM public.profiles p WHERE p.user_id = _target;

  -- Double vérification : uniquement un compte virtuel (profil ET compte marqués). La
  -- suppression du compte efface en cascade profil, préférences, likes, favoris, visites…
  DELETE FROM auth.users u
  WHERE u.id = _target
    AND u.raw_app_meta_data ->> 'provider' = 'virtual'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id AND p.is_virtual);
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  -- Photo déposée dans le stockage : fichier à supprimer (une image livrée avec le site,
  -- /demo-profils/…, reste en place).
  IF _photo IS NOT NULL AND left(_photo, 1) <> '/' THEN
    INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
    VALUES ('demo-profils', _photo, 'profil de démonstration retiré');
  END IF;
  RETURN _target;
END; $$;
REVOKE EXECUTE ON FUNCTION public.remove_one_virtual_profile(text, public.gender) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_one_virtual_profile(text, public.gender) TO service_role;

CREATE OR REPLACE FUNCTION public.replace_virtual_profile_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _removed uuid;
  _sought public.gender;
BEGIN
  -- Seulement quand l'identité d'un vrai membre vient d'être vérifiée.
  IF NEW.is_virtual OR OLD.verified_at IS NOT NULL OR NEW.verified_at IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Une seule fois par membre.
    INSERT INTO public.virtual_profile_removals (user_id, reason)
    VALUES (NEW.user_id, 'identité vérifiée')
    ON CONFLICT (user_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN NULL;
    END IF;
    SELECT pr.preferred_gender INTO _sought FROM public.preferences pr WHERE pr.user_id = NEW.user_id;
    _removed := public.remove_one_virtual_profile(public.member_country(NEW.user_id), _sought);
    UPDATE public.virtual_profile_removals SET removed_user_id = _removed
    WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Jamais d'échec de vérification à cause des profils de démonstration.
    RAISE WARNING 'replace_virtual_profile_on_signup: %', SQLERRM;
  END;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.replace_virtual_profile_on_signup() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS profiles_replace_virtual ON public.profiles;
CREATE TRIGGER profiles_replace_virtual AFTER UPDATE OF verified_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.replace_virtual_profile_on_signup();

-- ------------------------------------------------------------
-- 7. Administration des profils de démonstration
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_demo_profiles()
RETURNS TABLE (
  user_id uuid, first_name text, gender public.gender, birth_date date, city text,
  country text, demo_photo_path text, demo_photo_source text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT p.user_id, p.first_name, p.gender, p.birth_date, p.city, p.country,
         p.demo_photo_path, p.demo_photo_source, p.created_at
  FROM public.profiles p
  WHERE p.is_virtual
  ORDER BY p.gender DESC, p.country, p.first_name;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_demo_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_demo_profiles() TO authenticated, service_role;

-- Pose (ou retire, _path NULL) la photo d'un profil de démonstration. Renvoie l'ancien
-- chemin (fichier à supprimer par l'application).
CREATE OR REPLACE FUNCTION public.admin_set_demo_photo(_user_id uuid, _path text, _source text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old text;
BEGIN
  PERFORM public.assert_admin();
  SELECT p.demo_photo_path INTO _old FROM public.profiles p
  WHERE p.user_id = _user_id AND p.is_virtual FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'demo_profile_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _path IS NOT NULL THEN
    IF _source IS NULL OR _source NOT IN ('generated', 'licensed', 'consent') THEN
      RAISE EXCEPTION 'attestation_required' USING ERRCODE = '22023';
    END IF;
    IF split_part(_path, '/', 1) <> _user_id::text OR char_length(_path) > 300 THEN
      RAISE EXCEPTION 'invalid_path' USING ERRCODE = '22023';
    END IF;
  END IF;
  UPDATE public.profiles
  SET demo_photo_path = _path,
      demo_photo_source = CASE WHEN _path IS NULL THEN NULL ELSE _source END
  WHERE user_id = _user_id;
  RETURN CASE WHEN _old IS DISTINCT FROM _path THEN _old END;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_set_demo_photo(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_demo_photo(uuid, text, text) TO authenticated, service_role;
