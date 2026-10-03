SET search_path = '';
\echo == extensions
SELECT extname, extnamespace::regnamespace FROM pg_extension ORDER BY 1;
\echo == déclencheurs hors public
SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT tgisinternal AND c.relnamespace <> 'public'::regnamespace ORDER BY 1;
\echo == règles hors public
SELECT polrelid::regclass, polname, polcmd, polpermissive, polroles::regrole[], pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace <> 'public'::regnamespace ORDER BY 1,2;
\echo == buckets
SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY 1;
\echo == publication
SELECT * FROM pg_publication_tables ORDER BY 1,2,3;
\echo == droits des schémas
SELECT nspname, nspacl FROM pg_namespace WHERE nspname IN ('public','auth','storage','extensions') ORDER BY 1;
\echo == comptes virtuels
SELECT email, aud, role, encrypted_password, raw_app_meta_data, raw_user_meta_data - 'x', email_confirmed_at IS NOT NULL, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token FROM auth.users ORDER BY email;
\echo == données des tables (sans identifiants ni dates)
DO $$ DECLARE r record; h text; BEGIN
FOR r IN SELECT c.oid::regclass AS t, c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY 2 LOOP
  EXECUTE format($q$
    SELECT md5(coalesce(string_agg(j::text, '|' ORDER BY j::text), '')) || ' (' || count(*) || ' lignes)'
    FROM (SELECT (SELECT jsonb_object_agg(k, v) FROM jsonb_each(to_jsonb(x)) AS e(k, v)
                  WHERE k NOT IN (SELECT column_name FROM information_schema.columns
                                  WHERE table_schema='public' AND table_name=%L
                                    AND data_type IN ('uuid','timestamp with time zone','timestamp without time zone')))
                 || jsonb_build_object('_email', (SELECT u.email FROM public.users u WHERE u.id = (to_jsonb(x)->>'user_id')::uuid)) AS j
          FROM %s x) s $q$, r.relname, r.t) INTO h;
  RAISE NOTICE '% %', rpad(r.relname, 28), h;
END LOOP; END $$;
