-- ============================================================
-- Phase 1 — Étape 1.11 — Informations chrétiennes : limites côté serveur
--
-- Avant : aucune limite sur les textes de christian_profiles.
-- Réponses courtes : 100 caractères ; visions (mariage, couple) : 1000 caractères ;
-- valeurs chrétiennes : 10 au plus, 40 caractères chacune.
-- Mêmes limites dans l'interface (src/features/profiles/christian-info.ts). Rejouable.
-- ============================================================
CREATE OR REPLACE FUNCTION public.text_items_max_length(_items text[], _max integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(bool_and(char_length(item) BETWEEN 1 AND _max), true) FROM unnest(_items) AS item
$$;

DO $$
DECLARE
  _c record;
BEGIN
  FOR _c IN
    SELECT * FROM (VALUES
      ('christian_denomination_length',      'denomination IS NULL OR char_length(denomination) <= 100'),
      ('christian_faith_commitment_length',  'faith_commitment IS NULL OR char_length(faith_commitment) <= 100'),
      ('christian_church_attendance_length', 'church_attendance IS NULL OR char_length(church_attendance) <= 100'),
      ('christian_prayer_practice_length',   'prayer_practice IS NULL OR char_length(prayer_practice) <= 100'),
      ('christian_faith_importance_length',  'faith_importance IS NULL OR char_length(faith_importance) <= 100'),
      ('christian_marriage_vision_length',   'marriage_vision IS NULL OR char_length(marriage_vision) <= 1000'),
      ('christian_couple_vision_length',     'couple_vision IS NULL OR char_length(couple_vision) <= 1000'),
      ('christian_values_count',             'cardinality(christian_values) <= 10'),
      ('christian_values_item_length',       'public.text_items_max_length(christian_values, 40)')
    ) AS t(name, expr)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = _c.name AND conrelid = 'public.christian_profiles'::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.christian_profiles ADD CONSTRAINT %I CHECK (%s)', _c.name, _c.expr);
    END IF;
  END LOOP;
END $$;
