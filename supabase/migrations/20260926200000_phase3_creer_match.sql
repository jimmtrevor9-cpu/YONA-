-- ============================================================
-- Phase 3 — Étape 3.2 — Créer le Match
--
-- Constat (voir docs/verification/phase-3/etape-3.2-creer-match.md) : la table
-- matches existait (paire ordonnée user_1_id < user_2_id, unique, lecture par les
-- participants, aucune écriture par les membres) mais rien ne la remplissait.
--
-- Règle : dès qu'un Like actif rencontre un Like actif en sens inverse (sans blocage),
-- la base crée le Match elle-même (déclencheur), quel que soit le chemin d'écriture.
--   • verrou transactionnel sur la paire : deux Likes croisés envoyés au même instant
--     créent bien le Match (sinon chacun ne verrait pas encore l'autre) ;
--   • ON CONFLICT DO NOTHING : un Match déjà existant n'est ni dupliqué ni modifié
--     (règles détaillées des doublons : étape 3.3) ;
--   • la conversation associée est l'objet de l'étape 4.1.
-- Rejouable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_match_on_mutual_like()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _a uuid := least(NEW.sender_id, NEW.receiver_id);
  _b uuid := greatest(NEW.sender_id, NEW.receiver_id);
BEGIN
  IF NEW.kind <> 'like' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.kind = 'like' AND OLD.status = 'active' THEN
    RETURN NEW; -- Like déjà actif : rien de nouveau
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('match:' || _a::text || ':' || _b::text, 0));

  IF EXISTS (
       SELECT 1 FROM public.likes
       WHERE sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id
         AND kind = 'like' AND status = 'active'
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks
       WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
     )
  THEN
    INSERT INTO public.matches (user_1_id, user_2_id)
    VALUES (_a, _b)
    ON CONFLICT (user_1_id, user_2_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_match_on_mutual_like() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS likes_create_match ON public.likes;
CREATE TRIGGER likes_create_match AFTER INSERT OR UPDATE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.create_match_on_mutual_like();

-- Droits techniques : les membres ne font que LIRE leurs Matchs (règles RLS) ; la
-- création passe uniquement par le déclencheur ci-dessus. Les droits d'écriture
-- accordés par défaut sont retirés (sécurité en profondeur, en plus des règles RLS).
REVOKE INSERT, UPDATE, DELETE ON public.matches FROM authenticated, anon;
