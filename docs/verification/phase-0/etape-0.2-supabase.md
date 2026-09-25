# Phase 0 — Étape 0.2 — Vérifier le projet Supabase connecté

Date : 2026-09-25 · Statut : **NON VALIDÉE** (vérification en ligne en attente)

## Périmètre

Identifier le projet Supabase auquel le code est rattaché et vérifier qu'il est
cohérent et joignable. Les variables d'environnement en détail (0.3), les
migrations (0.4), l'authentification (0.5) et les RLS (0.6) sont hors périmètre.

## Projet identifié

| Élément | Valeur |
|---|---|
| Hébergement | Lovable Cloud (Supabase managé) |
| Identifiant du projet | `gzqgzdlqoyoomabghygj` |
| URL d'API | `https://c--a6bb406e-c993-4676-bfc1-e5974d50c0d7-prod.lovable.cloud` (environnement `prod`) |
| Type de clé côté client | Clé publique `sb_publishable_…` (nouveau format Supabase) |
| Version PostgREST (types générés) | 14.5 |

## Vérifications statiques (sans contacter le projet)

| Test | Résultat |
|---|---|
| `supabase/config.toml` = `SUPABASE_PROJECT_ID` du `.env` | ✅ |
| Variables serveur et `VITE_*` pointent vers le même projet (ID, URL, clé) | ✅ |
| Clé au format publishable, aucune clé secrète / service_role dans le `.env` | ✅ |
| URL HTTPS Lovable Cloud de production | ✅ |
| Format d'identifiant de projet Supabase valide | ✅ |
| `types.ts` (généré depuis le projet connecté) : 21 tables, dont celles de la fondation Phase 2 (`ai_usage`, `conversation_user_usage`, `favorites`, `profile_visits`) | ✅ |
| Un seul projet référencé dans tout le dépôt | ✅ |

## Vérifications en ligne — NON RÉALISÉES

Des requêtes en lecture seule vers le projet (santé de l'API d'authentification,
refus d'accès anonyme aux tables, existence du bucket `photos`) ont été préparées
mais **bloquées par les règles de permission de l'environnement de développement**
(lecture de données de production). Elles n'ont pas été contournées.

### À vérifier manuellement dans Lovable (onglet Cloud)

1. Le projet `gzqgzdlqoyoomabghygj` est actif (pas en pause).
2. Base de données → les 21 tables listées ci-dessus existent.
3. Storage → le bucket `photos` existe et est **privé**.
4. Users → l'authentification email/mot de passe est activée.
