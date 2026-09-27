-- Phase 6 / Étape 6.4 — Détecter les tirets.
-- Les numéros écrits avec des tirets entre les chiffres sont reconnus :
-- « 06-12-34-56-78 », « 699-887-766 », « +237-699-88-77-66 », « 06 - 12 - 34 - 56 - 78 »,
-- ainsi que les tirets typographiques utilisés pour tromper les filtres (–, —, ‐, ‑, ‒,
-- −, ﹣, －), tous ramenés au tiret simple.
-- Pour ne pas bloquer de messages ordinaires, sont écartés avant l'analyse : les dates
-- avec tirets (« 12-10-2026 », « 2026-10-12 »), les périodes d'années (« 2025-2026 »,
-- « 1990 - 2026 ») ; les références bibliques (« Luc 15:11-32 ») restent trop courtes
-- pour ressembler à un numéro.

CREATE OR REPLACE FUNCTION public.contains_phone_number(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _t text := coalesce(_text, '');
BEGIN
  -- Variantes du signe plus ramenées à « + » (6.2).
  _t := translate(_t, '＋⁺', '++');
  -- 6.3 — Tous les espaces (insécables, fins, tabulations, retours à la ligne…) ramenés
  -- à une espace simple.
  _t := translate(
    _t,
    E'              　\t\r\n\v\f',
    '                     '
  );
  _t := lower(_t);
  -- 6.4 — Tirets typographiques ramenés au tiret simple.
  _t := translate(_t, '‐‑‒–—−﹣－', '--------');

  -- Formes ordinaires écartées : montants avec devise et dates avec espaces.
  _t := regexp_replace(
    _t,
    '[0-9]{1,3}( [0-9]{3})+ ?(f ?cfa|cfa|xaf|xof|francs?|f\M|€|euros?|eur\M|\$|usd|dollars?)',
    ' ', 'g');
  _t := regexp_replace(_t, '(€|\$|usd|eur) ?[0-9]{1,3}( [0-9]{3})+', ' ', 'g');
  _t := regexp_replace(_t, '\m[0-9]{1,2} ?[ -] ?[0-9]{1,2} ?[ -] ?(19|20)[0-9]{2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?- ?[0-9]{1,2} ?- ?[0-9]{1,2}\M', ' ', 'g');
  _t := regexp_replace(_t, '\m(19|20)[0-9]{2} ?- ?(19|20)[0-9]{2}\M', ' ', 'g');

  -- Séparateurs entre les chiffres (et après un « + ») supprimés : espaces (6.3) et
  -- tirets (6.4), seuls ou combinés.
  _t := regexp_replace(_t, '\+[ -]+(?=[0-9])', '+', 'g');
  _t := regexp_replace(_t, '([0-9])[ -]+(?=[0-9])', '\1', 'g');

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
