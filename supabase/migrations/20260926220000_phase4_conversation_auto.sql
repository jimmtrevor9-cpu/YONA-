-- ============================================================
-- Phase 4 — Étape 4.1 — Créer automatiquement la conversation après Match
--
-- Constat (voir docs/verification/phase-4/etape-4.1-conversation-auto.md) : la table
-- conversations existait (une conversation par Match : match_id unique, paire ordonnée,
-- lecture par les participants) mais rien ne la créait.
--
-- Règle : dès qu'un Match devient actif (création, ou réactivation d'un Match défait),
-- la base crée sa conversation — même paire, même ordre — si elle n'existe pas ;
-- une conversation « closed » est rouverte à la réactivation (« locked » inchangé).
-- Les Matchs actifs déjà existants reçoivent leur conversation (rattrapage).
-- Les droits d'écriture accordés par défaut aux membres sur conversations sont retirés
-- (lecture seule ; la RLS l'imposait déjà). Rejouable.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_conversation_for_match()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.conversations (match_id, user_1_id, user_2_id)
  VALUES (NEW.id, NEW.user_1_id, NEW.user_2_id)
  ON CONFLICT (match_id) DO UPDATE SET status = 'open'
    WHERE public.conversations.status = 'closed';
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.create_conversation_for_match() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_create_conversation ON public.matches;
CREATE TRIGGER matches_create_conversation AFTER INSERT OR UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.create_conversation_for_match();

-- Rattrapage : Matchs actifs sans conversation
INSERT INTO public.conversations (match_id, user_1_id, user_2_id)
SELECT m.id, m.user_1_id, m.user_2_id
FROM public.matches m
WHERE m.status = 'active'
  AND NOT EXISTS (SELECT 1 FROM public.conversations c WHERE c.match_id = m.id)
ON CONFLICT (match_id) DO NOTHING;

REVOKE INSERT, UPDATE, DELETE ON public.conversations FROM authenticated, anon;
