#!/usr/bin/env python3
"""Génère supabase/rattrapage/verifier-migrations.sql.

Ce fichier SQL (lecture seule) indique, pour une base Supabase existante, quelles
migrations de supabase/migrations/ n'y ont pas été appliquées. Pour chaque migration,
on relève les objets qu'elle crée (tables, colonnes, fonctions, déclencheurs, politiques,
index, contraintes, espaces de stockage), en tenant compte des suppressions faites par les
migrations suivantes, puis la requête vérifie leur présence dans la base.

Utilisation : python3 scripts/generate-check-migrations.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIG = os.path.join(ROOT, "supabase", "migrations")
OUT = os.path.join(ROOT, "supabase", "rattrapage", "verifier-migrations.sql")
COMBINED = os.path.join(ROOT, "supabase", "rattrapage", "50-profils-virtuels-et-verification.sql")
DATA = "20261002110000_profils_virtuels_donnees.sql"

IDENT = r'"?([A-Za-z_][A-Za-z0-9_]*)"?'
QUAL = r'(?:"?(public|storage|auth)"?\.)?' + IDENT


def strip_comments(sql: str) -> str:
    # Retire les commentaires « -- » (hors chaînes, approximation suffisante ici).
    return re.sub(r"--[^\n]*", "", sql)


def bodies_removed(sql: str) -> str:
    # Les corps de fonctions ($$ … $$) ne créent pas d'objets : on les ignore.
    return re.sub(r"\$([A-Za-z_]*)\$.*?\$\1\$", "''", sql, flags=re.S)


PATTERNS = [
    ("table", re.compile(r"\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?" + QUAL, re.I)),
    ("function", re.compile(r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+" + QUAL + r"\s*\(", re.I)),
    ("trigger", re.compile(r"\bCREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+" + IDENT + r"\s+.*?\bON\s+" + QUAL, re.I | re.S)),
    ("policy", re.compile(r'\bCREATE\s+POLICY\s+"?([^"\s]+)"?\s+ON\s+' + QUAL, re.I)),
    ("index", re.compile(r"\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?" + IDENT + r"\s+ON\b", re.I)),
    ("bucket", re.compile(r"\bINSERT\s+INTO\s+storage\.buckets\s*\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'", re.I)),
]
DROPS = [
    ("table", re.compile(r"\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?" + QUAL, re.I)),
    ("function", re.compile(r"\bDROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?" + QUAL, re.I)),
    ("trigger", re.compile(r"\bDROP\s+TRIGGER\s+(?:IF\s+EXISTS\s+)?" + IDENT + r"\s+ON\s+" + QUAL, re.I)),
    ("policy", re.compile(r'\bDROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([^"\s]+)"?\s+ON\s+' + QUAL, re.I)),
    ("index", re.compile(r"\bDROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?" + QUAL, re.I)),
]
ALTER = re.compile(r"\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?" + QUAL + r"(.*?);", re.I | re.S)
ADD_COL = re.compile(r"\bADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?" + IDENT, re.I)
DROP_COL = re.compile(r"\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?" + IDENT, re.I)
ADD_CON = re.compile(r"\bADD\s+CONSTRAINT\s+" + IDENT, re.I)
DROP_CON = re.compile(r"\bDROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?" + IDENT, re.I)


def key(kind, *parts):
    return (kind,) + tuple(p.lower() for p in parts if p)


def events(sql: str):
    """Liste (position, action, clé) des créations / suppressions d'objets."""
    text = bodies_removed(strip_comments(sql))
    out = []
    for kind, rx in PATTERNS:
        for m in rx.finditer(text):
            g = [x for x in m.groups()]
            if kind in ("table", "function"):
                schema, name = g[0] or "public", g[1]
                out.append((m.start(), "add", key(kind, schema, name)))
            elif kind == "trigger":
                out.append((m.start(), "add", key(kind, g[0], g[2])))
            elif kind == "policy":
                out.append((m.start(), "add", key(kind, g[0], g[2])))
            elif kind == "index":
                out.append((m.start(), "add", key(kind, g[0])))
            elif kind == "bucket":
                out.append((m.start(), "add", key(kind, g[0])))
    for kind, rx in DROPS:
        for m in rx.finditer(text):
            g = list(m.groups())
            if kind in ("table", "function"):
                out.append((m.start(), "drop", key(kind, g[0] or "public", g[1])))
            elif kind == "trigger":
                out.append((m.start(), "drop", key(kind, g[0], g[2])))
            elif kind == "policy":
                out.append((m.start(), "drop", key(kind, g[0], g[2])))
            elif kind == "index":
                out.append((m.start(), "drop", key(kind, g[1])))
    for m in ALTER.finditer(text):
        table, body = m.group(2), m.group(3)
        for c in ADD_COL.finditer(body):
            out.append((m.start() + c.start(), "add", key("column", table, c.group(1))))
        for c in DROP_COL.finditer(body):
            out.append((m.start() + c.start(), "drop", key("column", table, c.group(1))))
        for c in ADD_CON.finditer(body):
            out.append((m.start() + c.start(), "add", key("constraint", c.group(1))))
        for c in DROP_CON.finditer(body):
            out.append((m.start() + c.start(), "drop", key("constraint", c.group(1))))
    # Contraintes nommées dans CREATE TABLE (… CONSTRAINT nom …).
    for m in re.finditer(r"\bCONSTRAINT\s+" + IDENT + r"\s+(?:CHECK|UNIQUE|PRIMARY|FOREIGN)", text, re.I):
        out.append((m.start(), "add", key("constraint", m.group(1))))
    out.sort(key=lambda e: (e[0], 0 if e[1] == "drop" else 1))
    return out


def main():
    files = sorted(f for f in os.listdir(MIG) if f.endswith(".sql"))
    alive = {}  # clé -> migration qui l'a introduit
    for f in files:
        sql = open(os.path.join(MIG, f), encoding="utf-8").read()
        for _, action, k in events(sql):
            if action == "drop":
                alive.pop(k, None)
            elif k not in alive:
                alive[k] = f
    rows = []
    for k, f in sorted(alive.items(), key=lambda kv: (kv[1], kv[0])):
        kind = k[0]
        if kind in ("table", "function"):
            rows.append((f, kind, k[1], k[2], ""))
        elif kind in ("trigger", "policy", "column"):
            rows.append((f, kind, k[1], k[2], ""))
        else:
            rows.append((f, kind, k[1], "", ""))

    def q(s):
        return "'" + s.replace("'", "''") + "'"

    values = ",\n".join(f"  ({q(f[:-4])}, {q(kind)}, {q(a)}, {q(b)})" for f, kind, a, b, _ in rows)
    sql = f"""-- ============================================================
-- YONA — VÉRIFIER quelles mises à jour (migrations) manquent dans la base
--
-- Lecture seule : ce fichier NE MODIFIE RIEN. À coller dans Supabase → SQL Editor,
-- puis « Run ». Le tableau affiché liste les migrations incomplètes ou absentes
-- (avec le nombre d'éléments manquants et quelques exemples). Si tout est à jour,
-- une seule ligne s'affiche : « Tout est à jour ».
-- Généré par scripts/generate-check-migrations.py ({len(rows)} éléments contrôlés,
-- {len(files)} migrations).
-- ============================================================
WITH attendu(migration, nature, a, b) AS (VALUES
{values}
),
controle AS (
  SELECT migration, nature, a, b,
    CASE nature
      WHEN 'table' THEN to_regclass(quote_ident(a) || '.' || quote_ident(b)) IS NOT NULL
      WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                   WHERE n.nspname = a AND p.proname = b)
      WHEN 'column' THEN EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema IN ('public', 'storage') AND table_name = a AND column_name = b)
      WHEN 'trigger' THEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                                  WHERE t.tgname = a AND c.relname = b)
      WHEN 'policy' THEN EXISTS (SELECT 1 FROM pg_policies WHERE policyname = a AND tablename = b)
      WHEN 'index' THEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = a)
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint WHERE conname = a)
      WHEN 'bucket' THEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = a)
    END AS present
  FROM attendu
),
bilan AS (
  SELECT migration,
         count(*) FILTER (WHERE present) AS presents,
         count(*) FILTER (WHERE NOT present) AS manquants,
         string_agg(CASE WHEN NOT present THEN nature || ' ' || a || CASE WHEN b <> '' THEN '.' || b ELSE '' END END, ', '
                    ORDER BY nature, a, b) AS exemples
  FROM controle GROUP BY migration
)
SELECT migration, presents, manquants, left(exemples, 160) AS elements_manquants
FROM bilan WHERE manquants > 0
UNION ALL
SELECT 'Tout est à jour', NULL, 0, NULL
WHERE NOT EXISTS (SELECT 1 FROM bilan WHERE manquants > 0)
ORDER BY 1;
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(sql)
    print(f"{len(rows)} éléments, {len(files)} migrations -> {OUT} ({len(sql)} octets)")

    # Variante : les 50 profils virtuels, puis la même vérification, avec en plus le
    # nombre de profils virtuels présents (un seul fichier à coller).
    data = open(os.path.join(MIG, DATA), encoding="utf-8").read()
    check = sql.split("-- ============================================================\n", 2)[2]
    check = check.replace(
        "UNION ALL\nSELECT 'Tout est à jour', NULL, 0, NULL",
        "UNION ALL\nSELECT '→ Profils virtuels dans la base', count(*), 0, NULL\n"
        "FROM public.profiles WHERE is_virtual\n"
        "UNION ALL\nSELECT 'Tout est à jour', NULL, 0, NULL",
    )
    combined = f"""-- ============================================================
-- YONA — 50 PROFILS VIRTUELS + VÉRIFICATION des mises à jour de la base
--
-- À coller EN ENTIER dans Supabase → SQL Editor, puis « Run ».
-- 1. Ajoute les 50 profils virtuels (contenu de {DATA}) :
--    5 par pays pour Gabon, Cameroun, Côte d'Ivoire, Congo-Brazzaville, Togo, Bénin,
--    Sénégal et Mali, et 10 pour la France. Rejouable sans risque.
-- 2. Affiche le tableau de vérification (lecture seule) : la ligne
--    « → Profils virtuels dans la base » donne le nombre de profils virtuels, les autres
--    lignes listent les mises à jour (migrations) qui manquent encore dans la base.
-- Supabase peut afficher « Potential issue detected » / « opérations destructives » :
-- le fichier retire seulement d'anciens profils virtuels (jamais un vrai membre).
-- Il faut alors confirmer avec « Run this query » / « Exécuter la requête ».
-- ============================================================

-- ############################################################
-- PARTIE 1 : les 50 profils virtuels
-- ############################################################
{data}
-- ############################################################
-- PARTIE 2 : vérification (lecture seule)
-- ############################################################
{check}"""
    with open(COMBINED, "w", encoding="utf-8") as fh:
        fh.write(combined)
    print(f"-> {COMBINED} ({len(combined)} octets)")


if __name__ == "__main__":
    main()
