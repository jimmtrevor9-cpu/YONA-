-- Phase 8 / Étape 8.2 — Enregistrer le favori.
-- Règle d'ajout renforcée (`favorites_insert_own`) : la personne connectée ajoute pour
-- elle-même (déjà), jamais elle-même (déjà), sans blocage entre les deux (déjà), et
-- désormais seulement si son propre compte et son profil sont actifs (`can_browse_profiles`)
-- et si le profil ajouté est visible et actif (`is_discoverable_profile`).
-- La date d'ajout est toujours fixée par le serveur. Aucune modification d'un favori
-- existant n'est possible (droit UPDATE retiré ; l'ajout et le retrait suffisent).

DROP POLICY IF EXISTS favorites_insert_own ON public.favorites;
CREATE POLICY favorites_insert_own ON public.favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND user_id <> favorite_user_id
    AND NOT public.is_blocked_between(user_id, favorite_user_id)
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(favorite_user_id)
  );

CREATE OR REPLACE FUNCTION public.set_favorite_created_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS favorites_set_created_at ON public.favorites;
CREATE TRIGGER favorites_set_created_at
  BEFORE INSERT ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.set_favorite_created_at();

REVOKE UPDATE ON public.favorites FROM authenticated, anon;
