-- Phase 9 / Étape 9.1 — Enregistrer une visite.
-- Une visite n'est enregistrée que par le serveur, via `record_profile_visit` :
-- - membre connecté (sinon refus `not_authenticated`) dont le compte et le profil
--   permettent de consulter les profils (`can_browse_profiles`) ;
-- - profil visité visible et actif (`is_discoverable_profile`), jamais soi-même,
--   aucun blocage dans un sens ou dans l'autre ;
-- - date fixée par le serveur.
-- La fonction renvoie `true` si la visite a été enregistrée, `false` si elle est ignorée.
-- Toute écriture directe dans `profile_visits` est retirée aux membres (aucune règle
-- d'accès ne l'autorisait déjà ; le droit lui-même est désormais retiré).

REVOKE INSERT, UPDATE, DELETE ON public.profile_visits FROM authenticated, anon;

DROP FUNCTION IF EXISTS public.record_profile_visit(uuid);
CREATE FUNCTION public.record_profile_visit(_visited_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _visitor uuid := auth.uid();
BEGIN
  IF _visitor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF _visited_user_id IS NULL OR _visited_user_id = _visitor THEN
    RETURN false;
  END IF;
  IF NOT public.can_browse_profiles()
     OR NOT public.is_discoverable_profile(_visited_user_id)
     OR public.is_blocked_between(_visitor, _visited_user_id) THEN
    RETURN false;
  END IF;
  -- Anti-répétition existant : une visite par heure et par profil visité.
  IF EXISTS (
    SELECT 1 FROM public.profile_visits v
    WHERE v.visitor_id = _visitor
      AND v.visited_user_id = _visited_user_id
      AND v.visited_at > now() - interval '1 hour'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.profile_visits (visitor_id, visited_user_id)
  VALUES (_visitor, _visited_user_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_profile_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_profile_visit(uuid) TO authenticated, service_role;
