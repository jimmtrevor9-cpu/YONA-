-- Phase 13 — Roi Salomon (assistant IA).
--
-- Le quota IA existait déjà (Phase 2 : table `ai_usage`, `consume_ai_quota`, `get_ai_quota`,
-- 3 questions/jour en gratuit, illimité en Premium). Cette migration le complète :
-- 13.4 / 13.8 — Les fonctionnalités IA acceptées sont limitées à une liste connue
--        (`roi_salomon`, `ice_breaker`) : impossible d'inventer une fonctionnalité pour
--        obtenir un quota neuf. Le quota se compte par jour calendaire UTC, sous verrou.
-- 13.9 — `refund_ai_quota(_user_id, _feature)` : si le fournisseur IA échoue après la
--        consommation d'une question, le serveur rend la question (rôle service
--        uniquement, jamais appelable depuis le navigateur).

CREATE OR REPLACE FUNCTION public.ai_usage_day()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'UTC')::date
$$;

CREATE OR REPLACE FUNCTION public.consume_ai_quota(_feature text DEFAULT 'roi_salomon')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := public.ai_usage_day();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  END IF;
  IF _feature IS NULL OR _feature NOT IN ('roi_salomon', 'ice_breaker') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_feature');
  END IF;
  IF NOT public.is_active_account(_uid) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'account_inactive');
  END IF;
  _premium := public.is_premium(_uid);
  INSERT INTO public.ai_usage (user_id, feature, usage_date, usage_count)
  VALUES (_uid, _feature, _day, 0)
  ON CONFLICT (user_id, feature, usage_date) DO NOTHING;
  -- Verrou de la ligne du jour : des questions simultanées sont comptées une par une.
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  FOR UPDATE;
  IF NOT _premium AND _used >= 3 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'quota_exceeded', 'used', _used,
      'limit', 3, 'remaining', 0, 'unlimited', false);
  END IF;
  UPDATE public.ai_usage SET usage_count = usage_count + 1
  WHERE user_id = _uid AND feature = _feature AND usage_date = _day
  RETURNING usage_count INTO _used;
  RETURN jsonb_build_object('allowed', true, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_quota(_feature text DEFAULT 'roi_salomon')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _used integer;
  _premium boolean;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'used', 0, 'limit', 3, 'remaining', 0,
      'unlimited', false);
  END IF;
  _premium := public.is_premium(_uid);
  SELECT usage_count INTO _used FROM public.ai_usage
  WHERE user_id = _uid AND feature = _feature AND usage_date = public.ai_usage_day();
  _used := coalesce(_used, 0);
  RETURN jsonb_build_object('allowed', _premium OR _used < 3, 'used', _used,
    'limit', CASE WHEN _premium THEN NULL ELSE 3 END,
    'remaining', CASE WHEN _premium THEN NULL ELSE greatest(3 - _used, 0) END,
    'unlimited', _premium);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ai_quota(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ai_quota(text) TO authenticated, service_role;

-- 13.9 : question rendue si le fournisseur IA a échoué (serveur uniquement).
CREATE OR REPLACE FUNCTION public.refund_ai_quota(_user_id uuid, _feature text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_usage SET usage_count = usage_count - 1
  WHERE user_id = _user_id AND feature = _feature AND usage_date = public.ai_usage_day()
    AND usage_count > 0
$$;

REVOKE ALL ON FUNCTION public.refund_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_ai_quota(uuid, text) TO service_role;

-- La détection des numéros de téléphone (phase 6) est aussi appliquée aux questions posées
-- à l'IA : la fonction serveur de Roi Salomon l'appelle au nom de la personne connectée.
GRANT EXECUTE ON FUNCTION public.contains_phone_number(text) TO authenticated;
