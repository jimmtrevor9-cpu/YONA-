-- Phase 7 / Étape 7.10 — Expirer après 3 jours.
-- Un déblocage n'est « en cours » que tant que sa date de fin (3 jours après son début,
-- étape 7.7) n'est pas passée : dès cette date, le serveur ne le compte plus
-- (`has_active_conversation_unlock`), sans intervention — l'expiration est automatique
-- et exacte à la seconde.
-- Pour que l'historique reste juste (administration, statistiques), les déblocages
-- terminés passent aussi au statut « expiré » :
--   - `expire_conversation_unlocks()` : marque « expiré » tout déblocage actif dont la date
--     de fin est passée ; renvoie le nombre de déblocages concernés ; réservée au serveur ;
--   - tâche planifiée toutes les 5 minutes dans la base (pg_cron) quand l'extension est
--     disponible chez l'hébergeur ; sinon la migration continue (l'expiration par date
--     reste exacte) et la fonction peut être appelée par une tâche planifiée externe.

CREATE OR REPLACE FUNCTION public.expire_conversation_unlocks()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.conversation_unlocks u
     SET status = 'expired'
   WHERE u.status = 'active' AND u.expires_at IS NOT NULL AND u.expires_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_conversation_unlocks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_conversation_unlocks() TO service_role;

DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'yona-expirer-deblocages';
    PERFORM cron.schedule(
      'yona-expirer-deblocages',
      '*/5 * * * *',
      'select public.expire_conversation_unlocks()'
    );
  ELSE
    RAISE NOTICE 'pg_cron indisponible : expiration par date seulement (statut mis à jour par appel externe).';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification pg_cron impossible (%) : expiration par date seulement.', SQLERRM;
END;
$cron$;

-- Rattrapage immédiat des déblocages déjà terminés.
SELECT public.expire_conversation_unlocks();
