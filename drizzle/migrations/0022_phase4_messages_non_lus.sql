-- Phase 4 / Étape 4.10 — Gérer les messages non lus.
-- Chaque participant a sa date de dernière lecture par conversation. Un message est « non
-- lu » s'il a été délivré par l'autre personne après cette date (ou s'il n'y a jamais eu
-- de lecture). La date est écrite uniquement par le serveur (`mark_conversation_read`),
-- jamais directement par un membre.

CREATE TABLE IF NOT EXISTS public.conversation_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversation_reads_select_own ON public.conversation_reads;
CREATE POLICY conversation_reads_select_own ON public.conversation_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE ALL ON public.conversation_reads FROM anon, authenticated;
GRANT SELECT ON public.conversation_reads TO authenticated;

-- Marque la conversation comme lue par la personne connectée (date du serveur).
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _at timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND _uid IN (c.user_1_id, c.user_2_id)
  ) THEN
    RAISE EXCEPTION 'conversation_unavailable' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversation_reads AS r (conversation_id, user_id, last_read_at)
  VALUES (_conversation_id, _uid, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET last_read_at = greatest(r.last_read_at, excluded.last_read_at)
  RETURNING r.last_read_at INTO _at;
  RETURN _at;
END;
$$;

-- Nombre de messages non lus par conversation, pour la personne connectée, limité aux
-- conversations affichées dans « Messages » (non fermées, Match actif, aucun blocage,
-- profil de l'autre personne visible). Seules les conversations avec au moins un non-lu.
CREATE OR REPLACE FUNCTION public.get_unread_counts()
RETURNS TABLE (conversation_id uuid, unread integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, count(m.id)::integer
  FROM public.conversations c
  JOIN public.matches ma ON ma.id = c.match_id AND ma.status = 'active'
  CROSS JOIN LATERAL (
    SELECT CASE WHEN c.user_1_id = auth.uid() THEN c.user_2_id ELSE c.user_1_id END AS other_id
  ) o
  LEFT JOIN public.conversation_reads r ON r.conversation_id = c.id AND r.user_id = auth.uid()
  JOIN public.messages m ON m.conversation_id = c.id
    AND m.status = 'delivered'
    AND m.sender_id = o.other_id
    AND m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  WHERE auth.uid() IN (c.user_1_id, c.user_2_id)
    AND c.status <> 'closed'
    AND public.is_discoverable_profile(o.other_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = o.other_id)
         OR (b.blocker_id = o.other_id AND b.blocked_id = auth.uid())
    )
  GROUP BY c.id
$$;

REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unread_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unread_counts() TO authenticated, service_role;
