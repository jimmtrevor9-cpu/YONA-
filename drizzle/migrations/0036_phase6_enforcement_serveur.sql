-- Phase 6 / Étape 6.10 — Garantir l'enforcement serveur.
-- Dernier verrou de la protection des numéros, au niveau de la table elle-même : une
-- règle de la base interdit qu'un message soit à la fois « délivré » et marqué comme
-- contenant un numéro (l'indicateur est calculé par le serveur, étape 6.8). Elle
-- s'ajoute au refus à l'envoi (`send_message`, 6.7) et au déclencheur de la table (6.8).
-- Chemins d'écriture d'un message, tous contrôlés par le serveur :
--   - membres : uniquement `send_message` (aucun droit d'écriture directe, 4.8) ;
--   - rôle service, administration, code futur : déclencheur + règle ci-dessous.

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_no_phone_number_delivered;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_no_phone_number_delivered
  CHECK (NOT (status = 'delivered' AND contains_phone_number));
