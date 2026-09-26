-- ============================================================
-- Phase 3 — Étape 3.3 — Empêcher les Matchs en double
--
-- Déjà en place (étape 3.2, vérifié dans docs/verification/phase-3/etape-3.3-matchs-doublons.md) :
--   • unicité (user_1_id, user_2_id) + paire ordonnée user_1_id < user_2_id :
--     (A,B) et (B,A) ne peuvent pas coexister ;
--   • verrou transactionnel sur la paire, création uniquement par le déclencheur.
--
-- Cas non couvert : un Match défait (statut « unmatched ») restait défait si les deux
-- membres s'aimaient de nouveau. Pour garder UN seul Match par couple, c'est ce même
-- Match qui est réactivé (aucune nouvelle ligne). Un Match « blocked » (modération /
-- blocage) n'est jamais réactivé automatiquement ; un Match actif n'est pas modifié.
-- Seule la fonction du déclencheur change. Rejouable.
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
    ON CONFLICT (user_1_id, user_2_id) DO UPDATE SET status = 'active'
      WHERE public.matches.status = 'unmatched';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_match_on_mutual_like() FROM PUBLIC, anon, authenticated;
