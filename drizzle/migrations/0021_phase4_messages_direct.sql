-- Phase 4 / Étape 4.9 — Afficher le nouveau message (réception en direct).
-- Les nouveaux messages sont diffusés en direct (Supabase Realtime) aux personnes qui ont
-- le droit de les lire : la diffusion applique les mêmes règles d'accès (RLS) que la
-- lecture normale — participants pour les messages délivrés, auteur seul pour un message
-- retenu par la modération, personne d'autre.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
