-- ============================================================
-- Vérification d'identité automatique (tâche F)
--
-- La décision n'est plus prise à la main : le serveur du site compare le visage du selfie
-- (pris avec la caméra en direct, consigne aléatoire « tournez la tête ») aux photos du
-- profil et, si elle est fournie, à la photo de la pièce (carte d'identité, passeport,
-- carte d'étudiant ou carte scolaire), puis enregistre ici le résultat :
--   - ressemblance ≥ seuil d'acceptation  → vérifié (profiles.verified_at, badge, retrait
--     d'un profil de démonstration) ;
--   - sous le seuil de refus, aucun visage, plusieurs visages, image floue, consigne non
--     suivie → refusé avec un message clair ; nouvel essai possible (essais limités par jour) ;
--   - entre les deux (zone grise) ou moteur indisponible → « en attente », visible dans
--     l'administration. Jamais « vérifié » sans comparaison réelle.
-- Consentement obligatoire (données biométriques). Images supprimées après la décision
-- (délai réglable, 0 h par défaut) : seuls le résultat, la date, les scores et le type de
-- pièce sont gardés.
-- Tant que l'identité n'est pas vérifiée : ni découverte, ni messages, ni demandes de
-- contact (contrôlé ici, côté base). Les pages publiques et légales restent accessibles.
-- Rejouable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Réglages (une seule ligne, modifiable par l'administration)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  -- Ressemblance de 0 à 1 (moteur local : 1 − distance entre les visages).
  accept_similarity numeric(4,3) NOT NULL DEFAULT 0.550 CHECK (accept_similarity BETWEEN 0 AND 1),
  reject_similarity numeric(4,3) NOT NULL DEFAULT 0.400 CHECK (reject_similarity BETWEEN 0 AND 1),
  -- Service externe AWS Rekognition (ressemblance donnée de 0 à 100 %, ramenée de 0 à 1).
  aws_accept_similarity numeric(4,3) NOT NULL DEFAULT 0.950 CHECK (aws_accept_similarity BETWEEN 0 AND 1),
  aws_reject_similarity numeric(4,3) NOT NULL DEFAULT 0.800 CHECK (aws_reject_similarity BETWEEN 0 AND 1),
  -- Vivacité : rotation minimale de la tête entre les deux images (moteur local).
  liveness_min_shift numeric(4,3) NOT NULL DEFAULT 0.080 CHECK (liveness_min_shift BETWEEN 0 AND 0.5),
  -- Netteté minimale du visage (variance du laplacien) ; en dessous : « image floue ».
  min_sharpness numeric(8,2) NOT NULL DEFAULT 15 CHECK (min_sharpness >= 0),
  max_attempts_per_day integer NOT NULL DEFAULT 5 CHECK (max_attempts_per_day BETWEEN 1 AND 50),
  -- Conservation des images après la décision (0 = suppression immédiate).
  file_retention_hours integer NOT NULL DEFAULT 0 CHECK (file_retention_hours BETWEEN 0 AND 720),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT verification_settings_local_order CHECK (reject_similarity <= accept_similarity),
  CONSTRAINT verification_settings_aws_order CHECK (aws_reject_similarity <= aws_accept_similarity)
);
COMMENT ON TABLE public.verification_settings IS
  'Vérification d''identité automatique : seuils de ressemblance, vivacité, netteté, essais par jour, conservation des images.';
INSERT INTO public.verification_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_settings_admin_select ON public.verification_settings;
CREATE POLICY verification_settings_admin_select ON public.verification_settings FOR SELECT TO authenticated
  USING (public.is_admin());
DROP POLICY IF EXISTS verification_settings_admin_update ON public.verification_settings;
CREATE POLICY verification_settings_admin_update ON public.verification_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.verification_settings FROM anon;
GRANT SELECT, UPDATE ON public.verification_settings TO authenticated;
GRANT ALL ON public.verification_settings TO service_role;
DROP TRIGGER IF EXISTS verification_settings_set_updated_at ON public.verification_settings;
CREATE TRIGGER verification_settings_set_updated_at BEFORE UPDATE ON public.verification_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS verification_settings_audit_admin ON public.verification_settings;
CREATE TRIGGER verification_settings_audit_admin AFTER UPDATE ON public.verification_settings
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_change();

-- ------------------------------------------------------------
-- 2. Tentatives de vérification (table existante, colonnes ajoutées)
-- ------------------------------------------------------------
ALTER TABLE public.profile_verifications
  ADD COLUMN IF NOT EXISTS document_type text
    CONSTRAINT profile_verifications_document_type_check
    CHECK (document_type IS NULL OR document_type IN ('id_card', 'passport', 'student_card', 'school_card')),
  ADD COLUMN IF NOT EXISTS challenge text
    CONSTRAINT profile_verifications_challenge_check CHECK (challenge IS NULL OR challenge IN ('turn_left', 'turn_right')),
  ADD COLUMN IF NOT EXISTS challenge_path text,
  ADD COLUMN IF NOT EXISTS document_path text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS automatic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS engine text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS profile_similarity numeric(5,4),
  ADD COLUMN IF NOT EXISTS document_similarity numeric(5,4),
  ADD COLUMN IF NOT EXISTS liveness_similarity numeric(5,4),
  ADD COLUMN IF NOT EXISTS liveness_shift numeric(5,4),
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS files_deleted_at timestamptz;
-- Nouvel état « processing » : envoi en cours d'analyse (pas encore de décision).
ALTER TABLE public.profile_verifications DROP CONSTRAINT IF EXISTS profile_verifications_status_check;
ALTER TABLE public.profile_verifications ADD CONSTRAINT profile_verifications_status_check
  CHECK (status IN ('processing', 'pending', 'approved', 'rejected'));
ALTER TABLE public.profile_verifications DROP CONSTRAINT IF EXISTS profile_verifications_files_owner;
ALTER TABLE public.profile_verifications ADD CONSTRAINT profile_verifications_files_owner CHECK (
  (challenge_path IS NULL OR split_part(challenge_path, '/', 1) = user_id::text)
  AND (document_path IS NULL OR split_part(document_path, '/', 1) = user_id::text));
CREATE INDEX IF NOT EXISTS profile_verifications_user_created_idx
  ON public.profile_verifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS profile_verifications_status_idx
  ON public.profile_verifications (status, created_at) WHERE status IN ('processing', 'pending');
COMMENT ON COLUMN public.profile_verifications.reason IS
  'Motif de la décision : match, no_face, multiple_faces, blurry, not_frontal, liveness_failed, wrong_direction, no_profile_face, document_no_face, mismatch, gray_zone, engine_unavailable, files_missing, abandoned, manual.';

-- Les membres ne créent plus eux-mêmes une demande à examiner à la main : tout passe par
-- le serveur (essais comptés, consentement, analyse automatique).
DROP POLICY IF EXISTS verifications_insert_own ON public.profile_verifications;
REVOKE INSERT ON public.profile_verifications FROM authenticated;

-- ------------------------------------------------------------
-- 3. Fonctions appelées par le serveur du site (clé service)
-- ------------------------------------------------------------
-- Fichiers d'une tentative → file de suppression du stockage.
CREATE OR REPLACE FUNCTION public.queue_verification_files(_id uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
BEGIN
  INSERT INTO public.storage_cleanup_queue (bucket_id, path, reason)
  SELECT 'verifications', p, _reason
  FROM public.profile_verifications v,
       unnest(ARRAY[v.storage_path, v.challenge_path, v.document_path]) AS p
  WHERE v.id = _id AND v.files_deleted_at IS NULL AND p IS NOT NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE public.profile_verifications SET files_deleted_at = now() WHERE id = _id AND files_deleted_at IS NULL;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.queue_verification_files(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_verification_files(uuid, text) TO service_role;

-- Tentatives restées sans analyse (page fermée) : refusées après 30 minutes, images supprimées.
CREATE OR REPLACE FUNCTION public.expire_verification_attempts(_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _n integer := 0;
BEGIN
  FOR _id IN
    UPDATE public.profile_verifications
    SET status = 'rejected', reason = 'abandoned', decided_at = now()
    WHERE status = 'processing' AND created_at < now() - interval '30 minutes'
      AND (_user_id IS NULL OR user_id = _user_id)
    RETURNING id
  LOOP
    PERFORM public.queue_verification_files(_id, 'vérification abandonnée');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.expire_verification_attempts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_verification_attempts(uuid) TO service_role;

-- Nouvelle tentative : consentement, essais du jour, consigne aléatoire, chemins des images.
CREATE OR REPLACE FUNCTION public.start_identity_verification(
  _user_id uuid, _with_selfie boolean, _document_type text DEFAULT NULL, _consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s public.verification_settings%ROWTYPE;
  _used integer;
  _id uuid := gen_random_uuid();
  _challenge text;
  _main text;
  _challenge_path text;
  _document_path text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND NOT p.is_virtual) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_active_account(_user_id) THEN
    RAISE EXCEPTION 'account_inactive' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'already_verified' USING ERRCODE = '22023';
  END IF;
  IF _consent IS NOT TRUE THEN
    RAISE EXCEPTION 'consent_required' USING ERRCODE = '22023';
  END IF;
  IF NOT coalesce(_with_selfie, false) AND _document_type IS NULL THEN
    RAISE EXCEPTION 'nothing_to_check' USING ERRCODE = '22023';
  END IF;
  IF _document_type IS NOT NULL AND _document_type NOT IN ('id_card', 'passport', 'student_card', 'school_card') THEN
    RAISE EXCEPTION 'invalid_document_type' USING ERRCODE = '22023';
  END IF;
  PERFORM public.expire_verification_attempts(_user_id);
  IF EXISTS (SELECT 1 FROM public.profile_verifications v
             WHERE v.user_id = _user_id AND v.status IN ('processing', 'pending')) THEN
    RAISE EXCEPTION 'verification_in_progress' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _s FROM public.verification_settings WHERE id;
  SELECT count(*) INTO _used FROM public.profile_verifications v
  WHERE v.user_id = _user_id AND v.automatic AND v.created_at > now() - interval '24 hours'
    AND v.reason IS DISTINCT FROM 'engine_unavailable';
  IF _used >= coalesce(_s.max_attempts_per_day, 5) THEN
    RAISE EXCEPTION 'too_many_attempts' USING ERRCODE = '22023';
  END IF;

  IF _with_selfie THEN
    _challenge := CASE WHEN random() < 0.5 THEN 'turn_left' ELSE 'turn_right' END;
    _main := _user_id || '/' || _id || '/selfie.jpg';
    _challenge_path := _user_id || '/' || _id || '/consigne.jpg';
  END IF;
  IF _document_type IS NOT NULL THEN
    _document_path := _user_id || '/' || _id || '/piece.jpg';
  END IF;
  -- clock_timestamp : deux tentatives gardent leur ordre, même dans une seule transaction.
  INSERT INTO public.profile_verifications (id, user_id, method, storage_path, status, document_type,
                                            challenge, challenge_path, document_path, consent_at, automatic,
                                            created_at)
  VALUES (_id, _user_id, CASE WHEN _with_selfie THEN 'selfie' ELSE 'id_document' END,
          coalesce(_main, _document_path), 'processing', _document_type, _challenge, _challenge_path,
          CASE WHEN _with_selfie THEN _document_path END, now(), true, clock_timestamp());
  RETURN jsonb_build_object(
    'id', _id, 'challenge', _challenge,
    'selfie_path', _main, 'challenge_path', _challenge_path, 'document_path', _document_path,
    'attempts_left', greatest(coalesce(_s.max_attempts_per_day, 5) - _used - 1, 0));
END;
$$;
REVOKE ALL ON FUNCTION public.start_identity_verification(uuid, boolean, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_identity_verification(uuid, boolean, text, boolean) TO service_role;

-- Résultat de l'analyse. « approved » : profil vérifié ; images supprimées après une
-- décision (sauf délai de conservation réglé) ; « pending » : images gardées pour l'examen.
CREATE OR REPLACE FUNCTION public.record_verification_result(
  _id uuid, _status text, _reason text, _engine text,
  _profile_similarity numeric DEFAULT NULL, _document_similarity numeric DEFAULT NULL,
  _liveness_similarity numeric DEFAULT NULL, _liveness_shift numeric DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _v public.profile_verifications%ROWTYPE;
  _retention integer;
BEGIN
  IF _status NOT IN ('approved', 'rejected', 'pending') THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profile_verifications v SET
    status = _status, reason = left(_reason, 40), engine = left(_engine, 20),
    profile_similarity = _profile_similarity, document_similarity = _document_similarity,
    liveness_similarity = _liveness_similarity, liveness_shift = _liveness_shift,
    details = coalesce(_details, '{}'::jsonb),
    decided_at = CASE WHEN _status = 'pending' THEN NULL ELSE now() END
  WHERE v.id = _id AND v.status = 'processing'
  RETURNING * INTO _v;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _status = 'approved' THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _v.user_id AND verified_at IS NULL;
  END IF;
  SELECT file_retention_hours INTO _retention FROM public.verification_settings WHERE id;
  IF _status <> 'pending' AND coalesce(_retention, 0) = 0 THEN
    PERFORM public.queue_verification_files(_id, 'décision automatique');
  END IF;
  RETURN jsonb_build_object('status', _v.status, 'reason', _v.reason,
                            'verified', _status = 'approved');
END;
$$;
REVOKE ALL ON FUNCTION public.record_verification_result(uuid, text, text, text, numeric, numeric, numeric, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_verification_result(uuid, text, text, text, numeric, numeric, numeric, numeric, jsonb) TO service_role;

-- Nettoyage régulier : tentatives abandonnées, images gardées au-delà du délai réglé.
CREATE OR REPLACE FUNCTION public.purge_verification_files()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
  _id uuid;
  _retention integer;
BEGIN
  _n := public.expire_verification_attempts(NULL);
  SELECT file_retention_hours INTO _retention FROM public.verification_settings WHERE id;
  FOR _id IN
    SELECT v.id FROM public.profile_verifications v
    WHERE v.status IN ('approved', 'rejected') AND v.files_deleted_at IS NULL
      AND coalesce(v.decided_at, v.reviewed_at, v.created_at) < now() - make_interval(hours => coalesce(_retention, 0))
  LOOP
    PERFORM public.queue_verification_files(_id, 'fin du délai de conservation');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.purge_verification_files() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_verification_files() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-verifications-fichiers';
    PERFORM cron.schedule('yona-verifications-fichiers', '*/15 * * * *', 'select public.purge_verification_files()');
  ELSE
    RAISE NOTICE 'pg_cron indisponible : nettoyage des vérifications à lancer par le serveur.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : nettoyage à lancer par le serveur.', SQLERRM;
END;
$cron$;

-- ------------------------------------------------------------
-- 4. Fonctions du membre et de l'administration
-- ------------------------------------------------------------
-- État de la vérification du membre connecté (page « Vérifie ton identité »).
CREATE OR REPLACE FUNCTION public.my_verification_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _max integer;
  _used integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  SELECT max_attempts_per_day INTO _max FROM public.verification_settings WHERE id;
  SELECT count(*) INTO _used FROM public.profile_verifications v
  WHERE v.user_id = _me AND v.automatic AND v.created_at > now() - interval '24 hours'
    AND v.reason IS DISTINCT FROM 'engine_unavailable';
  RETURN jsonb_build_object(
    'verified', EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _me AND p.verified_at IS NOT NULL),
    'verified_at', (SELECT p.verified_at FROM public.profiles p WHERE p.user_id = _me),
    'attempts_left', greatest(coalesce(_max, 5) - _used, 0),
    'max_attempts', coalesce(_max, 5),
    'latest', (SELECT jsonb_build_object('id', v.id, 'status', v.status, 'reason', v.reason,
                                         'document_type', v.document_type, 'created_at', v.created_at)
               FROM public.profile_verifications v WHERE v.user_id = _me
               ORDER BY v.created_at DESC LIMIT 1)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_verification_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_verification_status() TO authenticated, service_role;

-- Cas incertains à examiner (zone grise, moteur indisponible), avec scores et images.
CREATE OR REPLACE FUNCTION public.admin_verification_queue()
RETURNS TABLE (
  id uuid, user_id uuid, first_name text, method text, document_type text, reason text,
  engine text, profile_similarity numeric, document_similarity numeric, liveness_similarity numeric,
  liveness_shift numeric, challenge text, storage_path text, challenge_path text, document_path text,
  details jsonb, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
  SELECT v.id, v.user_id, p.first_name, v.method, v.document_type, v.reason, v.engine,
         v.profile_similarity, v.document_similarity, v.liveness_similarity, v.liveness_shift,
         v.challenge, v.storage_path, v.challenge_path, v.document_path, v.details, v.created_at
  FROM public.profile_verifications v LEFT JOIN public.profiles p ON p.user_id = v.user_id
  WHERE v.status = 'pending'
  ORDER BY v.created_at
  LIMIT 200;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_verification_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_verification_queue() TO authenticated, service_role;

-- Décision de l'administration sur un cas incertain : toutes les images partent ensuite en
-- file de suppression (la photo principale est aussi renvoyée, comme avant).
CREATE OR REPLACE FUNCTION public.admin_review_verification(_verification_id uuid, _approve boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _path text;
BEGIN
  PERFORM public.assert_admin();
  UPDATE public.profile_verifications
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      decided_at = now(),
      reason = CASE WHEN automatic THEN 'manual' ELSE reason END
  WHERE id = _verification_id AND status = 'pending'
  RETURNING user_id, storage_path INTO _owner, _path;
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF _approve THEN
    UPDATE public.profiles SET verified_at = now() WHERE user_id = _owner AND verified_at IS NULL;
  END IF;
  PERFORM public.queue_verification_files(_verification_id, 'décision de l''administration');
  RETURN _path;
END;
$$;

-- ------------------------------------------------------------
-- 5. Accès réservés aux membres dont l'identité est vérifiée
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_identity_verified(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.user_id = _user_id AND (p.verified_at IS NOT NULL OR p.is_virtual))
         OR public.has_role(_user_id, 'admin')
$$;
REVOKE ALL ON FUNCTION public.is_identity_verified(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_identity_verified(uuid) TO authenticated, service_role;

-- Découverte, recherche, profils : seulement après la vérification d'identité.
CREATE OR REPLACE FUNCTION public.can_browse_profiles()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid() AND u.status = 'active' AND p.status IN ('active', 'hidden')
      AND p.verified_at IS NOT NULL
  )
$$;

-- Messages et demandes de contact : refusés tant que l'identité n'est pas vérifiée.
CREATE OR REPLACE FUNCTION public.require_verified_sender()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sender_id IS NOT NULL AND NOT public.is_identity_verified(NEW.sender_id) THEN
    RAISE EXCEPTION 'identity_not_verified' USING ERRCODE = '42501',
      HINT = 'Vérifiez votre identité pour envoyer des messages.';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.require_verified_sender() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS messages_require_verified ON public.messages;
CREATE TRIGGER messages_require_verified BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.require_verified_sender();
DROP TRIGGER IF EXISTS contact_requests_require_verified ON public.contact_requests;
CREATE TRIGGER contact_requests_require_verified BEFORE INSERT ON public.contact_requests
FOR EACH ROW EXECUTE FUNCTION public.require_verified_sender();
