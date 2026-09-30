-- Phase 24 — Sécurité finale.
-- Audit complet (script docs/verification/phase-24) : RLS active sur toutes les tables,
-- toutes les fonctions SECURITY DEFINER ont un search_path fixe, les fonctions internes
-- (déclencheurs, calcul, activation après paiement) ne sont pas appelables par l'API.
-- Seul écart trouvé : la fonction de déclencheur `activate_premium_subscription` restait
-- exécutable par tout le monde (sans effet réel, un déclencheur ne peut pas être appelé
-- directement, mais on retire le droit par principe).
REVOKE ALL ON FUNCTION public.activate_premium_subscription() FROM PUBLIC, anon, authenticated;
