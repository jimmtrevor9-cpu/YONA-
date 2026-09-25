#!/usr/bin/env bash
# Build l'application pour le Supabase LOCAL (supabase start) et la sert sur le port 4173.
# Usage : bash docs/verification/outils/demarrer-test-local.sh
set -euo pipefail
cd "$(dirname "$0")/../../.."
URL="${SUPABASE_URL:-http://127.0.0.1:54321}"
KEY="${SUPABASE_PUBLISHABLE_KEY:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}"
for pid in $(pgrep -f "^node docs/verification/outils/serveur-local.mjs" || true); do kill "$pid"; done
VITE_SUPABASE_URL="$URL" VITE_SUPABASE_PUBLISHABLE_KEY="$KEY" npx vite build > /tmp/yona-build-local.log 2>&1
grep -q "$URL" .output/public/assets/index-*.js || { echo "Build sans l'URL Supabase locale" >&2; exit 1; }
SUPABASE_URL="$URL" SUPABASE_PUBLISHABLE_KEY="$KEY" PORT=4173 setsid node docs/verification/outils/serveur-local.mjs > /tmp/yona-serveur-local.log 2>&1 &
for _ in $(seq 1 20); do curl -sf -o /dev/null http://127.0.0.1:4173/ && { echo "Application de test prête sur http://127.0.0.1:4173"; exit 0; }; sleep 0.5; done
echo "Le serveur local n'a pas démarré" >&2; exit 1
