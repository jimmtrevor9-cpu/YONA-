-- ============================================================
-- Phase 3 — Étape 3.1 — Détecter un Like réciproque
--
-- Constat (voir docs/verification/phase-3/etape-3.1-like-reciproque.md) : rien ne
-- détectait qu'un Like répondait à un Like reçu. Le membre ne peut pas le vérifier
-- lui-même : il ne lit que ses Likes envoyés (likes_select_sent), et c'est voulu.
--
-- has_mutual_like(_other) : vrai seulement si la personne connectée ET _other ont
-- chacune un Like actif envers l'autre, sans blocage entre elles. Ne répond que pour
-- la personne connectée : sans son propre Like actif, la réponse est toujours
-- « faux » — impossible de savoir qui vous a aimé sans l'aimer soi-même.
-- La création du Match est l'objet de l'étape 3.2. Rejouable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_mutual_like(_other uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL
    AND _other IS NOT NULL
    AND _other <> auth.uid()
    AND NOT public.is_blocked_between(auth.uid(), _other)
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = auth.uid() AND receiver_id = _other AND kind = 'like' AND status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.likes
      WHERE sender_id = _other AND receiver_id = auth.uid() AND kind = 'like' AND status = 'active'
    )
$$;
REVOKE EXECUTE ON FUNCTION public.has_mutual_like(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_mutual_like(uuid) TO authenticated, service_role;
