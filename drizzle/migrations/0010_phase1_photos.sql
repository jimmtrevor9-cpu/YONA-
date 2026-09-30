-- ============================================================
-- Phase 1 — Étape 1.13 — Photos : règles côté serveur
--
-- Avant : le bucket « photos » acceptait tout type de fichier, de toute taille ;
-- la photo principale était gérée à la main par le client (index unique
-- photos_one_primary_idx), sans règle en cas d'ajout ou de suppression.
-- Rejouable.
-- ============================================================

-- 1. Bucket : images uniquement (JPEG, PNG, WebP), 5 Mo maximum
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'photos';

-- 2. Photo principale automatique : la première photo ajoutée devient principale ;
--    une photo ajoutée ne peut pas en « voler » la place (voir set_primary_photo).
CREATE OR REPLACE FUNCTION public.photos_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.is_primary := NOT EXISTS (
    SELECT 1 FROM public.photos WHERE user_id = NEW.user_id AND is_primary
  );
  NEW.position := coalesce(
    (SELECT max(position) + 1 FROM public.photos WHERE user_id = NEW.user_id), 0
  );
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.photos_before_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS photos_set_primary_on_insert ON public.photos;
CREATE TRIGGER photos_set_primary_on_insert BEFORE INSERT ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.photos_before_insert();

-- 3. Suppression de la photo principale : la plus ancienne restante la remplace.
CREATE OR REPLACE FUNCTION public.photos_after_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.is_primary THEN
    UPDATE public.photos SET is_primary = true
    WHERE id = (
      SELECT id FROM public.photos WHERE user_id = OLD.user_id ORDER BY position, created_at LIMIT 1
    );
  END IF;
  RETURN NULL;
END; $$;
REVOKE EXECUTE ON FUNCTION public.photos_after_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS photos_promote_primary_on_delete ON public.photos;
CREATE TRIGGER photos_promote_primary_on_delete AFTER DELETE ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.photos_after_delete();

-- 4. Choisir sa photo principale (une seule opération, uniquement ses propres photos)
CREATE OR REPLACE FUNCTION public.set_primary_photo(_photo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.photos WHERE id = _photo_id AND user_id = _uid) THEN
    RAISE EXCEPTION 'photo_not_found' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.photos SET is_primary = false WHERE user_id = _uid AND is_primary AND id <> _photo_id;
  UPDATE public.photos SET is_primary = true WHERE id = _photo_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_primary_photo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_primary_photo(uuid) TO authenticated, service_role;
