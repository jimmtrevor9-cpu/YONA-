-- Phase 6 / Étape 6.8 — Empêcher le stockage.
-- Garantie au niveau de la table `messages`, quel que soit le chemin d'écriture
-- (fonction d'envoi, rôle service, administration, code futur) :
--   - l'indicateur `contains_phone_number` est toujours calculé par le serveur à partir
--     du contenu (il ne peut pas être fourni ni falsifié) ;
--   - un message contenant un numéro ne peut jamais être enregistré comme délivré : ni à
--     la création, ni par modification du contenu, ni par passage au statut « délivré »
--     (erreur `phone_number_detected`).
-- Messages déjà enregistrés avant la phase 6 : ceux qui contiennent un numéro ne sont
-- plus délivrés (statut « bloqué », motif `phone_number_detected`, modération
-- « rejeté ») — l'autre personne ne les voit plus, leur auteur les voit marqués « non
-- envoyé ».

CREATE OR REPLACE FUNCTION public.messages_block_phone_numbers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.contains_phone_number := public.contains_phone_number(NEW.content);
  IF NEW.contains_phone_number AND NEW.status = 'delivered' THEN
    RAISE EXCEPTION 'phone_number_detected' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.messages_block_phone_numbers() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messages_block_phone_numbers ON public.messages;
CREATE TRIGGER messages_block_phone_numbers
  BEFORE INSERT OR UPDATE OF content, status, contains_phone_number ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_block_phone_numbers();

-- Rattrapage des messages existants.
UPDATE public.messages
   SET status = 'blocked',
       moderation_status = 'rejected',
       blocked_reason = 'phone_number_detected'
 WHERE status = 'delivered' AND public.contains_phone_number(content);
UPDATE public.messages
   SET contains_phone_number = public.contains_phone_number(content)
 WHERE contains_phone_number IS DISTINCT FROM public.contains_phone_number(content);
