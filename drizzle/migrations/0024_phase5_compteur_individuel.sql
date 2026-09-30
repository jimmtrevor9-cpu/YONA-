-- Phase 5 / Étape 5.1 — Initialiser le compteur individuel.
-- Chaque participant d'une conversation a son propre compteur de messages gratuits
-- (`conversation_user_usage`, 0 à 3), créé à 0 dès la création de la conversation (au
-- Match). Un Match défait puis refait rouvre la même conversation : les compteurs
-- existants sont conservés (pas de remise à zéro).
-- Les compteurs ne sont modifiables que par le serveur : droits d'écriture directe
-- retirés aux membres, et l'ancienne fonction `consume_free_message` (qui augmentait le
-- compteur sans message) n'est plus appelable par les membres.

CREATE OR REPLACE FUNCTION public.init_conversation_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
  VALUES (NEW.id, NEW.user_1_id, 0), (NEW.id, NEW.user_2_id, 0)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.init_conversation_usage() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS conversations_init_usage ON public.conversations;
CREATE TRIGGER conversations_init_usage
  AFTER INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.init_conversation_usage();

-- Conversations existantes : compteurs manquants créés à 0.
INSERT INTO public.conversation_user_usage (conversation_id, user_id, free_messages_used)
SELECT c.id, u.user_id, 0
FROM public.conversations c
CROSS JOIN LATERAL (VALUES (c.user_1_id), (c.user_2_id)) AS u(user_id)
ON CONFLICT (conversation_id, user_id) DO NOTHING;

REVOKE INSERT, UPDATE, DELETE ON public.conversation_user_usage FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.consume_free_message(uuid) FROM authenticated;
