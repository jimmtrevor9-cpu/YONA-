SET search_path = '';
SELECT 'rel ' || c.oid::regclass::text, string_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END || ':' || a.privilege_type, ',' ORDER BY 1, a.grantee::regrole::text, a.privilege_type)
FROM pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a WHERE c.relnamespace='public'::regnamespace GROUP BY 1
UNION ALL
SELECT 'fn ' || p.oid::regprocedure::text, string_agg(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END || ':' || a.privilege_type, ',' ORDER BY 1, a.grantee::regrole::text, a.privilege_type)
FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.pronamespace='public'::regnamespace GROUP BY 1
UNION ALL
SELECT 'type ' || t.oid::regtype::text, coalesce(t.typacl::text, 'défaut') FROM pg_type t WHERE t.typnamespace='public'::regnamespace AND t.typtype='e'
ORDER BY 1;
