-- Phase 18 — Compatibilité.
-- 18.1 — Données utilisées (déjà saisies dans le profil) : dénomination, importance de la
--        foi, fréquentation de l'église, prière, valeurs chrétiennes, intérêts, objectif
--        relationnel, projet familial, âges recherchés, pays.
-- 18.2 — `compatibility_breakdown(_me, _other)` (interne) : chaque critère renseigné des
--        deux côtés rapporte des points ; le score est le pourcentage obtenu sur les
--        critères comparables. Aucun critère comparable : pas de score.
--        Choix : calcul par règles explicables, dans la base (instantané, gratuit, sans
--        envoyer de données personnelles à un service d'IA).
-- 18.3 / 18.4 — `get_compatibility(_other)` : score, niveau et explication courte pour tous.
-- 18.5 — Le détail critère par critère n'est renvoyé qu'aux membres Premium.
--        `get_compatibility_scores(_user_ids)` : scores seuls, pour les listes de profils.

CREATE OR REPLACE FUNCTION public.compatibility_breakdown(_me uuid, _other uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p1 public.profiles%ROWTYPE;
  p2 public.profiles%ROWTYPE;
  c1 public.christian_profiles%ROWTYPE;
  c2 public.christian_profiles%ROWTYPE;
  f1 public.preferences%ROWTYPE;
  f2 public.preferences%ROWTYPE;
  _details jsonb := '[]'::jsonb;
  _points numeric := 0;
  _max numeric := 0;
  _common text[];
  _age1 integer;
  _age2 integer;
  _pts numeric;
  _score integer;
BEGIN
  SELECT * INTO p1 FROM public.profiles WHERE user_id = _me;
  SELECT * INTO p2 FROM public.profiles WHERE user_id = _other;
  SELECT * INTO c1 FROM public.christian_profiles WHERE user_id = _me;
  SELECT * INTO c2 FROM public.christian_profiles WHERE user_id = _other;
  SELECT * INTO f1 FROM public.preferences WHERE user_id = _me;
  SELECT * INTO f2 FROM public.preferences WHERE user_id = _other;

  -- Critère « même réponse » : ajoute une ligne de détail et les points.
  -- (répété pour chaque champ texte comparable)
  IF nullif(btrim(c1.denomination), '') IS NOT NULL AND nullif(btrim(c2.denomination), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.denomination)) = lower(btrim(c2.denomination)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'denomination', 'label', 'Dénomination',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même dénomination : ' || c2.denomination
                   ELSE 'Dénominations différentes' END);
  END IF;
  IF nullif(btrim(c1.faith_importance), '') IS NOT NULL AND nullif(btrim(c2.faith_importance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.faith_importance)) = lower(btrim(c2.faith_importance)) THEN 15 ELSE 0 END;
    _points := _points + _pts; _max := _max + 15;
    _details := _details || jsonb_build_object('key', 'faith_importance', 'label', 'Place de la foi',
      'points', _pts, 'max', 15, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'La foi a la même place dans vos vies'
                   ELSE 'La foi n''a pas tout à fait la même place' END);
  END IF;
  IF nullif(btrim(c1.church_attendance), '') IS NOT NULL AND nullif(btrim(c2.church_attendance), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.church_attendance)) = lower(btrim(c2.church_attendance)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'church_attendance', 'label', 'Église',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même rythme de fréquentation de l''église'
                   ELSE 'Rythmes de fréquentation de l''église différents' END);
  END IF;
  IF nullif(btrim(c1.prayer_practice), '') IS NOT NULL AND nullif(btrim(c2.prayer_practice), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(c1.prayer_practice)) = lower(btrim(c2.prayer_practice)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'prayer', 'label', 'Prière',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pratique de la prière'
                   ELSE 'Pratiques de la prière différentes' END);
  END IF;

  -- Valeurs chrétiennes et intérêts : points selon le nombre d'éléments en commun (3 = maximum).
  IF cardinality(c1.christian_values) > 0 AND cardinality(c2.christian_values) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(c2.christian_values) v
    WHERE lower(v) IN (SELECT lower(x) FROM unnest(c1.christian_values) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'values', 'label', 'Valeurs chrétiennes',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' valeur(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Aucune valeur en commun indiquée' END);
  END IF;
  IF cardinality(p1.interests) > 0 AND cardinality(p2.interests) > 0 THEN
    SELECT coalesce(array_agg(DISTINCT v), '{}') INTO _common
    FROM unnest(p2.interests) v
    WHERE public.normalize_place(v) IN (SELECT public.normalize_place(x) FROM unnest(p1.interests) x);
    _pts := round(10 * least(cardinality(_common), 3) / 3.0);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'interests', 'label', 'Centres d''intérêt',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN cardinality(_common) > 0
                   THEN cardinality(_common) || ' intérêt(s) en commun : ' || array_to_string(_common[1:3], ', ')
                   ELSE 'Pas d''intérêt en commun' END);
  END IF;

  IF nullif(btrim(f1.relationship_goal), '') IS NOT NULL AND nullif(btrim(f2.relationship_goal), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.relationship_goal)) = lower(btrim(f2.relationship_goal)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'goal', 'label', 'Objectif',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Vous cherchez le même type de relation'
                   ELSE 'Objectifs de relation différents' END);
  END IF;
  IF nullif(btrim(f1.family_project), '') IS NOT NULL AND nullif(btrim(f2.family_project), '') IS NOT NULL THEN
    _pts := CASE WHEN lower(btrim(f1.family_project)) = lower(btrim(f2.family_project)) THEN 10 ELSE 0 END;
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'family', 'label', 'Projet familial',
      'points', _pts, 'max', 10, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même projet familial'
                   ELSE 'Projets familiaux différents' END);
  END IF;

  -- Âges : chacun est-il dans la tranche d'âge recherchée par l'autre ?
  IF f1.user_id IS NOT NULL AND f2.user_id IS NOT NULL
     AND p1.birth_date IS NOT NULL AND p2.birth_date IS NOT NULL THEN
    _age1 := extract(year FROM age(p1.birth_date))::integer;
    _age2 := extract(year FROM age(p2.birth_date))::integer;
    _pts := (CASE WHEN _age2 BETWEEN f1.min_age AND f1.max_age THEN 5 ELSE 0 END)
          + (CASE WHEN _age1 BETWEEN f2.min_age AND f2.max_age THEN 5 ELSE 0 END);
    _points := _points + _pts; _max := _max + 10;
    _details := _details || jsonb_build_object('key', 'age', 'label', 'Âges recherchés',
      'points', _pts, 'max', 10, 'matched', _pts = 10,
      'note', CASE WHEN _pts = 10 THEN 'Chacun correspond à l''âge recherché par l''autre'
                   WHEN _pts = 5 THEN 'Un seul de vous correspond à l''âge recherché par l''autre'
                   ELSE 'Vos âges ne correspondent pas aux tranches recherchées' END);
  END IF;

  IF nullif(p1.country, '') IS NOT NULL AND nullif(p2.country, '') IS NOT NULL THEN
    _pts := CASE WHEN public.normalize_place(p1.country) = public.normalize_place(p2.country) THEN 5 ELSE 0 END;
    _points := _points + _pts; _max := _max + 5;
    _details := _details || jsonb_build_object('key', 'country', 'label', 'Pays',
      'points', _pts, 'max', 5, 'matched', _pts > 0,
      'note', CASE WHEN _pts > 0 THEN 'Même pays : ' || p2.country ELSE 'Pays différents' END);
  END IF;

  IF _max = 0 THEN
    RETURN jsonb_build_object('score', NULL, 'details', '[]'::jsonb);
  END IF;
  _score := round(100 * _points / _max);
  RETURN jsonb_build_object('score', _score, 'details', _details);
END;
$$;
REVOKE ALL ON FUNCTION public.compatibility_breakdown(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Profil qu'un membre a le droit de voir (hors lui-même).
CREATE OR REPLACE FUNCTION public.can_view_profile(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND _other IS NOT NULL AND _other <> auth.uid()
    AND public.can_browse_profiles()
    AND public.is_discoverable_profile(_other)
    AND NOT public.is_blocked_between(auth.uid(), _other)
$$;
REVOKE ALL ON FUNCTION public.can_view_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_compatibility(_other uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _b jsonb;
  _score integer;
  _premium boolean;
  _strong text[];
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_view_profile(_other) THEN
    RAISE EXCEPTION 'profile_unavailable' USING ERRCODE = '42501';
  END IF;
  _b := public.compatibility_breakdown(_me, _other);
  _score := (_b->>'score')::integer;
  _premium := public.is_premium(_me);
  -- Explication courte (pour tous) : les points forts, sans le détail des réponses.
  SELECT coalesce(array_agg(lower(d->>'label')), '{}') INTO _strong
  FROM jsonb_array_elements(_b->'details') d
  WHERE (d->>'matched')::boolean;
  RETURN jsonb_build_object(
    'score', _score,
    'level', CASE WHEN _score IS NULL THEN NULL
                  WHEN _score >= 80 THEN 'excellent'
                  WHEN _score >= 60 THEN 'good'
                  WHEN _score >= 40 THEN 'medium'
                  ELSE 'low' END,
    'summary', CASE
      WHEN _score IS NULL THEN 'Pas encore assez d''informations dans vos profils pour calculer la compatibilité.'
      WHEN cardinality(_strong) = 0 THEN 'Peu de points communs dans vos profils pour le moment.'
      ELSE 'Points forts : ' || array_to_string(_strong[1:3], ', ') || '.'
    END,
    'premium', _premium,
    'details', CASE WHEN _premium THEN _b->'details' ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_compatibility(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compatibility(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_compatibility_scores(_user_ids uuid[])
RETURNS TABLE (user_id uuid, score integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u, (public.compatibility_breakdown(auth.uid(), u)->>'score')::integer
  FROM (SELECT DISTINCT unnest(_user_ids[1:60]) AS u) ids
  WHERE public.can_view_profile(u)
$$;
REVOKE ALL ON FUNCTION public.get_compatibility_scores(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_compatibility_scores(uuid[]) TO authenticated, service_role;
