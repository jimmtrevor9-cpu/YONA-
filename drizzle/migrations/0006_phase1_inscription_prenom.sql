-- ============================================================
-- Phase 1 — Étape 1.2 — Inscription : prénom nettoyé côté serveur
--
-- Avant : un prénom de plus de 60 caractères (contrainte
-- profiles_first_name_length) faisait échouer toute l'inscription avec une
-- erreur générique ; un prénom composé d'espaces était enregistré tel quel.
-- Désormais le prénom reçu à l'inscription est débarrassé de ses espaces
-- superflus, limité à 60 caractères, et vide → NULL.
-- Le reste du provisionnement est inchangé.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.profiles (user_id, first_name)
    VALUES (NEW.id, left(NULLIF(btrim(NEW.raw_user_meta_data ->> 'first_name'), ''), 60));
  INSERT INTO public.christian_profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_activity (user_id, last_login_at, last_seen_at) VALUES (NEW.id, now(), now());
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
