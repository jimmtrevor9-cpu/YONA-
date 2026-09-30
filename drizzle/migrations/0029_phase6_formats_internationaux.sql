-- Phase 6 / Étape 6.2 — Détecter les formats internationaux.
-- En plus des numéros classiques (6.1), la détection reconnaît les numéros écrits avec
-- leur indicatif international :
--   - préfixe « + » : +33612345678, +237699887766, +1 écrit collé… ; un « + » suivi d'au
--     moins 7 chiffres suffit (indicatif + numéro court) ;
--   - préfixe « 00 » : 0033612345678, 00237699887766 (déjà 8 chiffres ou plus) ;
--   - signes plus « ＋ » (pleine largeur) et « ⁺ » (exposant) assimilés à « + ».

CREATE OR REPLACE FUNCTION public.contains_phone_number(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _t text := coalesce(_text, '');
BEGIN
  -- Variantes du signe plus ramenées à « + ».
  _t := translate(_t, '＋⁺', '++');

  -- 6.1 — Numéro classique : au moins 8 chiffres à la suite.
  IF _t ~ '[0-9]{8,}' THEN
    RETURN true;
  END IF;

  -- 6.2 — Format international : « + » suivi d'au moins 7 chiffres.
  IF _t ~ '\+[0-9]{7,}' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contains_phone_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contains_phone_number(text) TO service_role;
