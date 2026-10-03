#!/usr/bin/env python3
"""Génère supabase/nouvelle-base/creer-toute-la-base.sql.

Ce fichier crée en une fois toute la base de YONA dans un projet Supabase neuf et vide :
c'est l'état final des migrations de supabase/migrations/, sans l'historique (tables
créées puis modifiées, fonctions remplacées plusieurs fois…).

Méthode : on construit une base de référence sur un PostgreSQL local (imitation de
Supabase : scripts/data/supabase-local-shim.sql) en appliquant toutes les migrations dans
l'ordre, puis on en tire :
  - la structure du schéma public (pg_dump), regroupée par sections ;
  - les droits d'accès exacts, écrits explicitement (les projets Supabase créés depuis
    mai 2026 n'ouvrent plus automatiquement les nouvelles tables à l'API) ;
  - ce qui vit hors du schéma public : déclencheur sur auth.users, espaces de stockage
    et leurs règles, temps réel, tâches planifiées ;
  - les données de départ (pays, profils de démonstration), reprises des migrations.

Utilisation (PostgreSQL local joignable par psql / pg_dump, variables PG* habituelles) :
    python3 scripts/generate-base-complete.py
"""
import json
import os
import re
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(ROOT, "supabase", "migrations")
SHIM = os.path.join(ROOT, "scripts", "data", "supabase-local-shim.sql")
OUT = os.path.join(ROOT, "supabase", "nouvelle-base", "creer-toute-la-base.sql")
DB = os.environ.get("YONA_GEN_DB", "yona_generation_base")
GEO_MIG = "20261002110000_profils_virtuels_donnees.sql"
SEED_MIG = "20261003100100_profils_demo_donnees.sql"
# Lignes de réglages créées par les migrations (une seule ligne par table).
SETTINGS_ROWS = [
    ("20261003150000_publicites.sql",
     r"^INSERT INTO public\.ad_settings \(id\) VALUES \(true\) ON CONFLICT \(id\) DO NOTHING;"),
]
CRON_MIGS = [
    ("20260928090000_phase7_expirer_deblocage.sql", "fin des déblocages de conversation"),
    ("20260930120000_phase14_premium.sql", "fin des abonnements Premium"),
]
API_ROLES = ["PUBLIC", "anon", "authenticated", "service_role"]


# ---------------------------------------------------------------------------
# Base de référence
# ---------------------------------------------------------------------------

def sh(*cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kw).stdout


def psql(*args):
    return sh("psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-d", DB, *args)


def rows(sql):
    """Résultat d'une requête (noms entièrement qualifiés : search_path vide)."""
    out = psql("-At", "-c", "SET search_path = ''",
               "-c", f"SELECT coalesce(json_agg(t), '[]') FROM ({sql}) t")
    return json.loads(out)


def build_reference():
    sh("dropdb", "--if-exists", DB)
    sh("createdb", DB)
    psql("-v", "privileges=classique", "-f", SHIM)
    for name in sorted(os.listdir(MIG)):
        if name.endswith(".sql"):
            psql("--single-transaction", "-f", os.path.join(MIG, name))


# ---------------------------------------------------------------------------
# Structure du schéma public (pg_dump, regroupé par sections)
# ---------------------------------------------------------------------------

HEADER = re.compile(
    r"^--\n-- Name: (?P<name>.*?); Type: (?P<type>[A-Z ]+); Schema: [^;]*; Owner: [^\n]*\n--\n", re.M)

SECTION_TITLES = {
    "TYPE": "Types : listes de valeurs fixes (rôles, statuts, motifs…)",
    "FUNCTION": "Fonctions : les règles du site exécutées par la base",
    "TABLE": "Tables",
    "CONSTRAINT": "Clés primaires et valeurs uniques",
    "INDEX": "Index : recherches rapides",
    "TRIGGER": "Déclencheurs : actions automatiques à chaque ajout ou modification",
    "FK CONSTRAINT": "Liens entre les tables (clés étrangères)",
    "ROW SECURITY": "Sécurité par ligne (RLS) : activée sur toutes les tables",
    "POLICY": "Règles d'accès : qui peut lire ou modifier quelles lignes",
}


def dump_entries():
    dump = sh("pg_dump", "-d", DB, "-s", "-n", "public", "-x", "--no-owner", "--no-tablespaces")
    heads = list(HEADER.finditer(dump))
    entries = []
    for i, h in enumerate(heads):
        end = heads[i + 1].start() if i + 1 < len(heads) else len(dump)
        body = dump[h.end():end]
        body = re.sub(r"^SET default_table_access_method = heap;\n", "", body, flags=re.M)
        body = re.sub(r"--\n-- PostgreSQL database dump complete\n--.*", "", body, flags=re.S)
        body = body.strip()
        typ, name = h["type"], h["name"]
        if typ == "SCHEMA" or (typ == "COMMENT" and name == "SCHEMA public"):
            continue
        if typ in ("COMMENT", "SEQUENCE") and entries:
            # Commentaire d'un objet, ou compteur d'une colonne « identity » : gardé juste
            # après l'objet qu'il complète.
            prev_typ, prev_name, prev_body = entries[-1]
            entries[-1] = (prev_typ, prev_name, prev_body + "\n" + body)
            continue
        if typ not in SECTION_TITLES:
            raise SystemExit(f"Type d'objet inattendu dans pg_dump : {typ} ({name})")
        entries.append((typ, name, body))
    return entries


def schema_sections(entries, out):
    """Écrit la structure. Les activations RLS passent avant les règles d'accès ; le
    reste garde l'ordre de pg_dump, qui respecte les dépendances."""
    main = [e for e in entries if e[0] not in ("ROW SECURITY", "POLICY")]
    rls = [e for e in entries if e[0] == "ROW SECURITY"]
    policies = [e for e in entries if e[0] == "POLICY"]

    runs = []
    for e in main:
        if runs and runs[-1][0] == e[0]:
            runs[-1][1].append(e)
        else:
            runs.append((e[0], [e]))
    seen = set()
    for i, (typ, items) in enumerate(runs):
        title = SECTION_TITLES[typ]
        nxt = runs[i + 1][0] if i + 1 < len(runs) else None
        if typ == "TABLE" and nxt == "FUNCTION" and len(items) < 3:
            title = "Table utilisée par les fonctions qui suivent"
        else:
            if typ in seen:
                title += " (suite)"
            seen.add(typ)
        out.section(title)
        out.write("\n\n".join(body for _, _, body in items))

    out.section(SECTION_TITLES["ROW SECURITY"])
    out.write("\n".join(body for _, _, body in rls))

    out.section(SECTION_TITLES["POLICY"])
    by_table = {}
    for _, name, body in policies:
        by_table.setdefault(name.split(" ", 1)[0], []).append(body)
    out.write("\n\n".join(
        f"-- {table}\n" + "\n\n".join(bodies) for table, bodies in sorted(by_table.items())))


# ---------------------------------------------------------------------------
# Droits d'accès explicites
# ---------------------------------------------------------------------------

TABLE_PRIVS = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
ROLE_LABELS = {"PUBLIC": "tout le monde", "anon": "visiteurs", "authenticated": "membres connectés",
               "service_role": "serveur du site"}
PRIV_LABELS = {"SELECT": "lecture", "INSERT": "ajout", "UPDATE": "modification", "DELETE": "suppression",
               "TRUNCATE": "vidage", "REFERENCES": "références", "TRIGGER": "déclencheurs",
               "EXECUTE": "exécution"}


def acl_rows(kind):
    if kind == "table":
        return rows("""
          SELECT c.oid::regclass::text AS obj,
                 CASE c.relkind WHEN 'S' THEN 'SEQUENCE' ELSE 'TABLE' END AS kw,
                 coalesce((SELECT json_agg(json_build_object('g', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                                   ELSE a.grantee::regrole::text END, 'p', a.privilege_type))
                           FROM aclexplode(coalesce(c.relacl, acldefault(
                             (CASE c.relkind WHEN 'S' THEN 's' ELSE 'r' END)::"char", c.relowner))) a
                           WHERE a.grantee <> c.relowner), '[]') AS acl
          FROM pg_class c
          WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
          ORDER BY c.relkind = 'S', 1""")
    return rows("""
      SELECT p.oid::regprocedure::text AS obj, CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS kw,
             coalesce((SELECT json_agg(json_build_object('g', CASE WHEN a.grantee = 0 THEN 'PUBLIC'
                               ELSE a.grantee::regrole::text END, 'p', a.privilege_type))
                       FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                       WHERE a.grantee <> p.proowner), '[]') AS acl
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
      ORDER BY 1""")


def check_no_other_acl():
    extra = rows("""
      SELECT 'colonne ' || a.attrelid::regclass::text || '.' || a.attname FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        WHERE c.relnamespace = 'public'::regnamespace AND a.attacl IS NOT NULL
      UNION ALL
      SELECT 'type ' || t.oid::regtype::text FROM pg_type t
        WHERE t.typnamespace = 'public'::regnamespace AND t.typacl IS NOT NULL""")
    if extra:
        raise SystemExit("Droits non pris en charge par le générateur : " + ", ".join(r["obj"] for r in extra))


SEQUENCE_PRIVS = ["USAGE", "SELECT", "UPDATE"]


def privs_sql(privs, kind, kw="TABLE"):
    full = SEQUENCE_PRIVS if kw == "SEQUENCE" else TABLE_PRIVS
    if kind == "table" and set(privs) == set(full):
        return "ALL"
    order = TABLE_PRIVS + ["USAGE", "EXECUTE"]
    return ", ".join(sorted(privs, key=order.index))


def privs_label(privs, kind, kw="TABLE"):
    full = SEQUENCE_PRIVS if kw == "SEQUENCE" else TABLE_PRIVS
    if kind == "table" and set(privs) == set(full):
        return "tout"
    if kind == "function":
        return "exécution"
    order = TABLE_PRIVS + ["USAGE"]
    labels = dict(PRIV_LABELS, USAGE="utilisation")
    return ", ".join(labels[p] for p in sorted(privs, key=order.index))


def grants_section(out):
    check_no_other_acl()
    out.section("Droits d'accès : écrits un par un (aucun droit automatique)")
    out.write(
        "-- Chaque objet reçoit exactement les droits voulus. Les tables restent en plus\n"
        "-- filtrées ligne par ligne par les règles d'accès ci-dessus.\n"
        "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;")
    for kind in ("table", "function"):
        groups = {}
        for r in acl_rows(kind):
            per_role = {}
            for a in r["acl"]:
                per_role.setdefault(a["g"], set()).add(a["p"])
            unknown = set(per_role) - set(API_ROLES)
            if unknown:
                raise SystemExit(f"Rôle inattendu dans les droits de {r['obj']} : {unknown}")
            sig = tuple(sorted((g, tuple(sorted(p))) for g, p in per_role.items()))
            groups.setdefault((r["kw"], sig), []).append(r["obj"])
        for (kw, sig), objs in sorted(groups.items(), key=lambda g: (-len(g[1]), g[0])):
            label = " · ".join(f"{ROLE_LABELS[g]} : {privs_label(p, kind, kw)}" for g, p in
                               sorted(sig, key=lambda s: API_ROLES.index(s[0]))) or "propriétaire seulement"
            noun = {"TABLE": "tables", "SEQUENCE": "compteurs"}.get(kw, "fonctions")
            listing = ",\n  ".join(objs)
            block = [f"-- {len(objs)} {noun} — {label}",
                     f"REVOKE ALL ON {kw}\n  {listing}\nFROM {', '.join(API_ROLES)};"]
            by_privs = {}
            for g, p in sig:
                by_privs.setdefault(p, []).append(g)
            for p, grantees in sorted(by_privs.items()):
                grantees.sort(key=API_ROLES.index)
                block.append(f"GRANT {privs_sql(p, kind, kw)} ON {kw}\n  {listing}\nTO {', '.join(grantees)};")
            out.write("\n" + "\n".join(block))


# ---------------------------------------------------------------------------
# Hors du schéma public : comptes, stockage, temps réel, tâches planifiées
# ---------------------------------------------------------------------------

def extensions_sql():
    exts = rows("""SELECT e.extname, n.nspname FROM pg_extension e
                   JOIN pg_namespace n ON n.oid = e.extnamespace
                   WHERE e.extname <> 'plpgsql' ORDER BY 1""")
    return "\n".join(f"CREATE EXTENSION IF NOT EXISTS {e['extname']} WITH SCHEMA {e['nspname']};"
                     for e in exts)


def auth_triggers_sql():
    trig = rows("""SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
                   JOIN pg_class c ON c.oid = t.tgrelid
                   WHERE NOT t.tgisinternal AND c.relnamespace <> 'public'::regnamespace
                   ORDER BY c.oid::regclass::text, t.tgname""")
    return "\n".join(t["def"] + ";" for t in trig)


def storage_sql():
    buckets = rows("""SELECT format('  (%L, %L, %s, %s, %L)', id, name, CASE WHEN public THEN 'true' ELSE 'false' END,
                                    coalesce(file_size_limit::text, 'NULL'), allowed_mime_types) AS v, id
                      FROM storage.buckets ORDER BY id""")
    policies = rows("""
      SELECT format(E'CREATE POLICY %I ON %s%s\\n  FOR %s TO %s%s%s;',
               pol.polname, pol.polrelid::regclass::text,
               CASE WHEN pol.polpermissive THEN '' ELSE ' AS RESTRICTIVE' END,
               CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                               WHEN 'd' THEN 'DELETE' ELSE 'ALL' END,
               (SELECT string_agg(CASE WHEN r = 0 THEN 'public' ELSE r::regrole::text END, ', ')
                  FROM unnest(pol.polroles) r),
               CASE WHEN pol.polqual IS NULL THEN ''
                    ELSE E'\\n  USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')' END,
               CASE WHEN pol.polwithcheck IS NULL THEN ''
                    ELSE E'\\n  WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')' END) AS def,
             pol.polname AS name
      FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
      WHERE c.relnamespace <> 'public'::regnamespace
      ORDER BY pol.polrelid::regclass::text, pol.polname""")
    return (
        "INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES\n"
        + ",\n".join(b["v"] for b in buckets)
        + "\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, public = EXCLUDED.public,\n"
        "  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;\n\n"
        + "\n\n".join(p["def"] for p in policies)
    ), [b["id"] for b in buckets], [p["name"] for p in policies]


def realtime_sql():
    tables = rows("""SELECT schemaname, tablename FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' ORDER BY 1, 2""")
    parts = []
    for t in tables:
        parts.append(
            "DO $$\nBEGIN\n"
            "  IF EXISTS (SELECT 1 FROM pg_catalog.pg_publication WHERE pubname = 'supabase_realtime')\n"
            "     AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_publication_tables\n"
            f"                     WHERE pubname = 'supabase_realtime' AND schemaname = '{t['schemaname']}'"
            f" AND tablename = '{t['tablename']}')\n"
            "  THEN\n"
            f"    ALTER PUBLICATION supabase_realtime ADD TABLE {t['schemaname']}.{t['tablename']};\n"
            "  END IF;\nEND $$;")
    return "\n\n".join(parts), [t["tablename"] for t in tables]


def read_mig(name):
    with open(os.path.join(MIG, name), encoding="utf-8") as f:
        return f.read()


def cron_sql():
    blocks = []
    for name, label in CRON_MIGS:
        found = re.findall(r"^DO \$cron\$\n.*?^\$cron\$;", read_mig(name), flags=re.S | re.M)
        if len(found) != 1:
            raise SystemExit(f"Bloc pg_cron introuvable dans {name}")
        blocks.append(f"-- Toutes les 5 minutes : {label}.\n" + found[0])
    return "\n\n".join(blocks)


def seed_sql():
    geo = re.findall(r"^INSERT INTO public\.geo_countries .*?lng = EXCLUDED\.lng;", read_mig(GEO_MIG),
                     flags=re.S | re.M)
    seed = re.findall(r"^DO \$do\$\n.*?^\$do\$;", read_mig(SEED_MIG), flags=re.S | re.M)
    if len(geo) != 1 or len(seed) != 1:
        raise SystemExit(f"Données de départ introuvables dans {GEO_MIG} / {SEED_MIG}")
    # Base neuve : aucun ancien profil virtuel à retirer (étape 0 de la migration).
    seed_block, n = re.subn(r"\n  -- 0\. Profils virtuels .*?= u\.email\);\n", "\n", seed[0], flags=re.S)
    if n != 1:
        raise SystemExit("Étape 0 (retrait des anciens profils virtuels) introuvable")
    return geo[0], seed_block


def settings_sql():
    found = []
    for name, pattern in SETTINGS_ROWS:
        rows_found = re.findall(pattern, read_mig(name), flags=re.M)
        if len(rows_found) != 1:
            raise SystemExit(f"Ligne de réglages introuvable dans {name}")
        found.append(rows_found[0])
    return "\n".join(found)


# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------

class Out:
    def __init__(self):
        self.parts = []
        self.n = 0

    def write(self, text):
        self.parts.append(text.rstrip() + "\n")

    def section(self, title):
        self.n += 1
        self.parts.append(f"\n-- {'=' * 76}\n-- {self.n}. {title}\n-- {'=' * 76}\n\n")

    def text(self):
        return re.sub(r"\n{3,}", "\n\n", "".join(self.parts)).lstrip("\n")


def main():
    build_reference()
    expected = rows("""
      SELECT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS tables,
             (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace) AS functions,
             (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies,
             (SELECT count(*) FROM pg_policies WHERE schemaname <> 'public') AS storage_policies,
             (SELECT count(*) FROM public.geo_countries) AS countries,
             (SELECT count(*) FROM public.profiles WHERE is_virtual) AS virtual""")[0]
    entries = dump_entries()
    storage, bucket_names, storage_policy_names = storage_sql()
    n_buckets = len(bucket_names)
    n_migrations = len([n for n in os.listdir(MIG) if n.endswith(".sql")])
    realtime, realtime_tables = realtime_sql()
    geo, seed = seed_sql()

    out = Out()
    out.write(f"""-- ============================================================================
-- YONA — CRÉER TOUTE LA BASE DE DONNÉES (projet Supabase neuf et vide)
--
-- Ce fichier installe en une seule fois tout ce dont le site a besoin :
--   {expected['tables']} tables, {expected['functions']} fonctions, {expected['policies'] + expected['storage_policies']} règles d'accès, les droits de chaque rôle,
--   la création automatique du profil à l'inscription (e-mail ou Google), {n_buckets} espaces de
--   fichiers (privés : photos, messages vocaux, vérifications ; publics : images des profils
--   de démonstration, publicités), les messages en temps réel,
--   les tâches automatiques, les {expected['countries']} pays et les {expected['virtual']} profils virtuels.
--
-- Mode d'emploi : Supabase → SQL Editor → New query → coller TOUT le fichier → Run.
-- Si Supabase affiche un avertissement (« destructive operation »), choisir
-- « Run this query » : rien n'est supprimé, ce sont des mots présents dans les fonctions.
-- Le tableau affiché à la fin doit indiquer ✅ sur chaque ligne.
--
-- Tout ou rien : en cas d'erreur, rien n'est enregistré. Le fichier refuse de s'exécuter
-- dans une base qui contient déjà des tables.
--
-- Les comptes, mots de passe, connexions et e-mails « mot de passe oublié » sont gérés par
-- Supabase Auth (schéma auth, mots de passe chiffrés) : aucune table à créer pour eux.
-- Le déclencheur de la section « Comptes » relie chaque nouveau compte à son profil.
--
-- Fichier généré par scripts/generate-base-complete.py à partir de supabase/migrations/
-- ({n_migrations} migrations). Ne pas modifier à la main.
-- ============================================================================""")

    out.section("Vérification : la base doit être vide")
    out.write("""DO $garde$
DECLARE
  _tables text;
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    RAISE EXCEPTION 'YONA est déjà installé dans cette base : rien n''a été modifié.'
      USING HINT = 'Ce fichier sert uniquement à remplir un projet Supabase neuf et vide.';
  END IF;
  SELECT string_agg(relname, ', ' ORDER BY relname) INTO _tables
  FROM pg_catalog.pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p', 'v', 'm');
  IF _tables IS NOT NULL THEN
    RAISE EXCEPTION 'Cette base n''est pas vide (tables : %) : rien n''a été modifié.', _tables
      USING HINT = 'Ce fichier est prévu pour un projet Supabase neuf et vide.';
  END IF;
END
$garde$;

SET check_function_bodies = false;
SET client_min_messages = warning;
-- Pendant la création de la structure, tous les noms sont écrits en entier (public.…).
SET search_path = pg_catalog;""")

    out.section("Extensions")
    out.write("-- unaccent : recherche sans accents (villes, prénoms).\n" + extensions_sql())

    schema_sections(entries, out)
    grants_section(out)
    out.write("\n-- Fin de la structure : retour aux réglages habituels de la session.\n"
              "RESET search_path;\nRESET check_function_bodies;")

    out.section("Comptes : chaque nouveau compte (e-mail ou Google) reçoit son profil")
    out.write(auth_triggers_sql())

    out.section("Fichiers : espaces de stockage (privés et publics) et leurs règles")
    out.write(storage)

    out.section("Temps réel : nouveaux messages affichés sans recharger la page")
    out.write(realtime)

    out.section("Tâches automatiques (pg_cron, si Supabase le permet ; sinon les dates suffisent)")
    out.write(cron_sql())

    out.section("Données de départ : réglages (fréquence des publicités)")
    out.write(settings_sql())

    out.section(f"Données de départ : {expected['countries']} pays (position, pour le pays le plus proche)")
    out.write(geo)

    out.section(f"Données de départ : {expected['virtual']} profils virtuels (comptes sans mot de passe)")
    out.write(seed)

    out.section("Bilan")
    rt = realtime_tables[0] if realtime_tables else "messages"
    bucket_ids = ", ".join("'" + b + "'" for b in bucket_names)
    policy_names = ",\n      ".join("'" + n.replace("'", "''") + "'" for n in storage_policy_names)
    out.write(f"""-- Tâches automatiques : comptées à part (pg_cron peut être absent ou non lisible).
DO $$
BEGIN
  PERFORM pg_catalog.set_config('yona.taches',
    (SELECT count(*)::text FROM cron.job WHERE jobname LIKE 'yona-%'), false);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('yona.taches', 'pg_cron non activé', false);
END $$;

RESET client_min_messages;

SELECT b.element AS "Élément", b.trouve AS "Dans la base", b.attendu AS "Attendu",
       CASE WHEN b.trouve = b.attendu THEN '✅'
            WHEN b.facultatif THEN '⚠️ facultatif'
            ELSE '❌' END AS "État"
FROM (VALUES
  (1, 'Tables', (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname = 'public')::text, '{expected['tables']}', false),
  (2, 'Fonctions', (SELECT count(*) FROM pg_catalog.pg_proc WHERE pronamespace = 'public'::regnamespace)::text, '{expected['functions']}', false),
  (3, 'Règles d''accès des tables', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'public')::text, '{expected['policies']}', false),
  (4, 'Tables protégées (RLS)', (SELECT count(*) FROM pg_catalog.pg_class WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relrowsecurity)::text, '{expected['tables']}', false),
  (5, 'Profil créé à l''inscription', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_trigger WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created'), 'oui', false),
  (6, 'Espaces de fichiers', (SELECT count(*) FROM storage.buckets WHERE id IN ({bucket_ids}))::text, '{n_buckets}', false),
  (7, 'Règles d''accès des fichiers', (SELECT count(*) FROM pg_catalog.pg_policies WHERE schemaname = 'storage' AND policyname IN ({policy_names}))::text, '{len(storage_policy_names)}', false),
  (8, 'Messages en temps réel', (SELECT CASE WHEN count(*) > 0 THEN 'oui' ELSE 'non' END FROM pg_catalog.pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = '{rt}'), 'oui', false),
  (9, 'Tâches automatiques', current_setting('yona.taches', true), '{len(CRON_MIGS)}', true),
  (10, 'Pays', (SELECT count(*) FROM public.geo_countries)::text, '{expected['countries']}', false),
  (11, 'Profils virtuels', (SELECT count(*) FROM public.profiles WHERE is_virtual)::text, '{expected['virtual']}', false)
) AS b(n, element, trouve, attendu, facultatif)
ORDER BY b.n;""")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(out.text())
    sh("dropdb", "--if-exists", DB)
    print(f"{os.path.relpath(OUT, ROOT)} : {len(out.text().encode())} octets")


if __name__ == "__main__":
    main()
