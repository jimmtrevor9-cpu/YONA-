-- Phase 6 / Étape 6.1 — Détecter les numéros classiques.
-- Fonction de détection des numéros de téléphone, construite étape par étape (6.1 à
-- 6.6) et appliquée par le serveur à l'envoi des messages (6.7 et suivantes).
-- Étape 6.1 : numéros écrits d'un seul bloc de chiffres, au format national (France
-- 06 12 34 56 78 écrit 0612345678 ; Cameroun 699887766 ; Côte d'Ivoire 0707070707 ;
-- Sénégal 771234567 ; Gabon, Burkina Faso, Bénin… 8 chiffres) : 8 chiffres ou plus à la
-- suite. Les nombres courts de la vie courante (âge, année, heure, prix jusqu'à 7
-- chiffres) ne sont pas concernés.
-- Fonction interne : non appelable par les membres (seulement par le serveur).

CREATE OR REPLACE FUNCTION public.contains_phone_number(_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _t text := coalesce(_text, '');
BEGIN
  -- Numéro classique : au moins 8 chiffres à la suite.
  RETURN _t ~ '[0-9]{8,}';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contains_phone_number(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contains_phone_number(text) TO service_role;
