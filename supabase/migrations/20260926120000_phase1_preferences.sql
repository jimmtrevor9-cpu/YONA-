-- ============================================================
-- Phase 1 — Étape 1.12 — Préférences : limites côté serveur
--
-- Avant : « Ce que vous recherchez » (relationship_goal) et le projet familial
-- (family_project) n'avaient aucune limite de longueur. La tranche d'âge était
-- déjà contrôlée (preferences_age_range : 18 ≤ min ≤ max ≤ 99).
-- Mêmes limites dans l'interface (src/features/profiles/preferences.ts). Rejouable.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preferences_relationship_goal_length' AND conrelid = 'public.preferences'::regclass) THEN
    ALTER TABLE public.preferences ADD CONSTRAINT preferences_relationship_goal_length
      CHECK (relationship_goal IS NULL OR char_length(relationship_goal) <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'preferences_family_project_length' AND conrelid = 'public.preferences'::regclass) THEN
    ALTER TABLE public.preferences ADD CONSTRAINT preferences_family_project_length
      CHECK (family_project IS NULL OR char_length(family_project) <= 200);
  END IF;
END $$;
