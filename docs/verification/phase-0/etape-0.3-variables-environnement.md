# Phase 0 — Étape 0.3 — Vérifier les variables d'environnement

Date : 2026-09-25 · Statut : **VALIDÉE**

## Inventaire (toutes les variables lues par le code)

| Variable | Côté | Utilisée par | Obligatoire |
|---|---|---|---|
| `VITE_SUPABASE_URL` | navigateur (build) | `integrations/supabase/client.ts` | oui |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | navigateur (build) | `integrations/supabase/client.ts` | oui |
| `VITE_SUPABASE_PROJECT_ID` | — | non lue par le code (informatif) | non |
| `SUPABASE_URL` | serveur | `client.ts` (SSR), `auth-middleware.ts`, `client.server.ts` | oui |
| `SUPABASE_PUBLISHABLE_KEY` | serveur | `client.ts` (SSR), `auth-middleware.ts` | oui |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur, **secret** | `client.server.ts` (non utilisé à ce stade) | non |
| `LOVABLE_CRON_SECRET` / `_PREVIOUS` | serveur, **secret** | `cron-auth.ts` (non utilisé à ce stade) | non |
| `LOVABLE_DB_MIGRATION_URL` | outil, **secret** | `drizzle.config.ts` (drizzle-kit) | non |

## Tests

| Test | Résultat |
|---|---|
| Build avec des secrets « sentinelles » : présence dans le code navigateur | ✅ 0 fichier |
| … présence dans le code serveur buildé (lecture au démarrage uniquement) | ✅ 0 fichier |
| Noms `SUPABASE_SERVICE_ROLE_KEY` / `LOVABLE_CRON_SECRET` dans le code navigateur | ✅ absents |
| Clé publique présente dans le code navigateur (attendu) | ✅ |
| Chromium, variables valides (Supabase local) : `/`, `/login`, `/register`, `/forgot-password` | ✅ pages affichées, aucune erreur liée aux variables |
| Chromium : `/discover` non connecté | ✅ redirection vers `/login` |
| Chromium, variables absentes : message explicite | ✅ `Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY` dans la console |
| `.env` créé à partir du nouveau `.env.example` : lu par le build | ✅ |

## Modification

`.env.example` : liste complète et commentée des variables (publiques, serveur,
secrets optionnels), avec l'avertissement sur le préfixe `VITE_`.

## Constats (hors variables d'environnement)

- Les images de l'accueil (logo, 5 photos) sont servies par le CDN de Lovable
  (`/__l5e/assets-v1/…`) : elles s'affichent sur l'hébergement Lovable, pas sur un
  autre hébergement. À garder en tête si le site quitte Lovable.
- Polices Google et vidéo Vimeo non chargées dans l'environnement de test
  (restriction réseau de l'environnement, pas un défaut du projet).

## Rectificatif (étape 1.1)

Le rapport initial indiquait « l'accueil reste affiché » lorsque les variables
manquent. C'est inexact : seul le titre de l'onglet avait été vérifié. En réalité,
sans `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, **toutes les pages,
accueil compris, affichent la page d'erreur** « Cette page ne s'est pas chargée »
(le fournisseur d'authentification, présent sur toutes les pages, a besoin du
client Supabase). Avec les variables renseignées (cas normal, fourni par Lovable
Cloud), le problème n'existe pas.
