#!/bin/sh
# Tâche G — Vérifie YONA_base_de_donnees_complete.sql et ses parties.
# Prérequis : PostgreSQL 16 local (variables PGHOST, PGPORT, PGUSER), Node.js avec le paquet
# « pg » (npm i -g pg puis NODE_PATH="$(npm root -g)"), python3. À lancer depuis la racine du projet :
#   sh docs/verification/ajouts-2026-10/g-base-rejouable/tester.sh
# Étapes, en projet Supabase « classique » et « 2026 sans droits automatiques » (strict) :
#  0. base de référence = toutes les migrations de supabase/migrations/ ;
#  1. le fichier exécuté comme le SQL Editor de Supabase (une seule requête) dans une base
#     neuve → structure, droits et données comparés à la référence ;
#  2. 2e exécution (rejeu) → bilan ✅ et base toujours identique ;
#  3. parcours réels (37 tests) sur une copie, puis 3e exécution sur cette base utilisée →
#     aucune donnée modifiée ;
#  4. les parties 01…05 dans une base neuve, deux fois → identique à la référence.
# Puis : refus d'une base YONA plus ancienne et d'une base étrangère (rien de modifié).
set -u
R=$(pwd); T=$(cd "$(dirname "$0")" && pwd); W=${TMPDIR:-/tmp}/yona-g; mkdir -p $W
F=$R/YONA_base_de_donnees_complete.sql; P=$R/supabase/nouvelle-base/parties
SHIM=$R/scripts/data/supabase-local-shim.sql
PARCOURS=$R/docs/verification/ajouts-2026-10/parcours-base-complete.sql
node -e "require('pg')" 2>/dev/null || { echo "Paquet Node « pg » introuvable (voir Prérequis)."; exit 1; }
python3 scripts/generate-base-complete.py || exit 1
editor() { node $T/executer-comme-sql-editor.cjs "$1" "$2"; }
bilan() { editor "$1" "$2" | grep -E "✅|⚠|❌|ERREUR|INDICE" | sed 's/│/|/g' | tr -s ' '; }
empreintes() {
  psql -X -At -d $1 -f $T/acl_cmp.sql > $W/acl_$2.txt
  pg_dump -d $1 -s -n public --no-owner | grep -v '^\\restrict\|^\\unrestrict\|^-- Dumped' | awk '/^-- Name: .*Type: DEFAULT ACL/{skip=1} /^-- Name: / && !/DEFAULT ACL/{skip=0} !skip' | grep -v "^GRANT\|^REVOKE\|^-- PostgreSQL database dump complete\|^--$\|^$" | md5sum > $W/s_$2.md5
  psql -X -q -d $1 -f $T/compare.sql > $W/$2.cmp 2>&1
}
identique() {
  echo "    structure / droits / hors public + données identiques aux migrations : $(cmp -s $W/s_$1.md5 $W/s_ref.md5 && echo oui || echo NON) / $(cmp -s $W/acl_$1.txt $W/acl_ref.txt && echo oui || echo NON) / $(cmp -s $W/$1.cmp $W/ref.cmp && echo oui || echo NON)"
}
neuve() { dropdb --if-exists $1 2>/dev/null; createdb $1; psql -X -q -v ON_ERROR_STOP=1 -v privileges=$2 -d $1 -f $SHIM >/dev/null 2>&1; }
migrations() { for f in $(ls $R/supabase/migrations/*.sql | head -n ${2:-1000}); do psql -X -q -v ON_ERROR_STOP=1 --single-transaction -d $1 -f $f >/dev/null 2>&1 || { echo "échec $f"; exit 1; }; done; }

echo "=== référence : toutes les migrations"
neuve g_ref classique; migrations g_ref; empreintes g_ref ref
for mode in strict classique; do
  neuve g_$mode $mode
  echo "=== $mode : 1re exécution"; bilan g_$mode $F; empreintes g_$mode $mode; identique $mode
  echo "=== $mode : 2e exécution (rejeu)"; bilan g_$mode $F | grep -v "✅"; empreintes g_$mode ${mode}2; identique ${mode}2
  dropdb --if-exists g_t_$mode 2>/dev/null; createdb -T g_$mode g_t_$mode
  echo "    parcours : $(psql -X -d g_t_$mode -f $PARCOURS 2>&1 | grep -E 'tests réussis|ÉCHEC|ERROR' | tr -s ' ' | tr '\n' ' ')"
  psql -X -q -d g_t_$mode -f $T/compare.sql > $W/avant.cmp 2>&1
  echo "=== $mode : 3e exécution sur la base utilisée par le parcours"; bilan g_t_$mode $F | grep -v "✅"
  psql -X -q -d g_t_$mode -f $T/compare.sql > $W/apres.cmp 2>&1
  echo "    données inchangées : $(cmp -s $W/avant.cmp $W/apres.cmp && echo oui || echo NON)"
  neuve g_p_$mode $mode
  for tour in 1 2; do for part in $P/*.sql; do editor g_p_$mode $part | grep -E "ERREUR" | sed "s|^|    ❌ tour $tour $(basename $part) : |"; done; done
  echo "=== $mode : parties exécutées deux fois"; empreintes g_p_$mode p_$mode; identique p_$mode
done
echo "=== refus d'une base YONA plus ancienne (sans la dernière migration)"
neuve g_ancienne classique; migrations g_ancienne $(( $(ls $R/supabase/migrations/*.sql | wc -l) - 1 ))
psql -X -q -d g_ancienne -f $T/compare.sql > $W/avant.cmp 2>&1
editor g_ancienne $F | grep -E "ERREUR|INDICE" | cut -c1-160
psql -X -q -d g_ancienne -f $T/compare.sql > $W/apres.cmp 2>&1
echo "    base inchangée : $(cmp -s $W/avant.cmp $W/apres.cmp && echo oui || echo NON)"
echo "=== refus d'une base étrangère"
neuve g_autre classique; psql -X -q -d g_autre -c "CREATE TABLE public.clients (id int)"
editor g_autre $F | grep -E "ERREUR|INDICE"
