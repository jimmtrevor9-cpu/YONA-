# Phase 0 — Étape 0.4 — Vérifier les migrations existantes

Date : 2026-09-25 · Statut : **VALIDÉE**

## Constat initial

| Migration | Contenu | Problème |
|---|---|---|
| `20260908214236` | Schéma Phase 1 (17 tables, fonctions, RLS) | — |
| `20260909003751` | Droits d'exécution des fonctions | — |
| `20260909003817` | Politiques de stockage `photos` | le bucket `photos` n'est créé nulle part |
| `20260917210826` | **Copie** de `20260908214236` (sans 1 contrainte et 3 index) | **échec** sur base neuve : `type "app_role" already exists` → toute l'installation s'arrête |
| `20260918001810` | Fondations Phase 2 (quotas, favoris, visites, IA, USD) | — |

- Reproduit sur un Supabase local complet (CLI 2.118.0, PostgreSQL 17.6) : `supabase db reset` s'arrête à la 4ᵉ migration.
- `drizzle/migrations` (0000 → 0003) est un miroir de 0908 / 0909 / 0909 / 0918 (0003 = 0918 au formatage près) : il ne contient pas `20260917210826`.
- Conséquence pour une base créée uniquement avec 0917 + 0918 (cas probable de la base Lovable actuelle) : pas de politiques de stockage, fonctions internes exécutables par `anon`, 1 contrainte et 3 index manquants.

## Corrections

1. `20260917210826_…sql` **neutralisée** (`SELECT 1;` + explication). Nom conservé pour l'historique.
2. Nouvelle migration **`20260925120000_phase0_rattrapage_schema.sql`**, idempotente :
   contrainte `reports_description_length`, 3 index, droits d'exécution (identiques à 0909),
   bucket `photos` **privé**, 4 politiques de stockage (identiques à 0909, rendues rejouables).

## Tests (Supabase local complet)

| Test | Résultat |
|---|---|
| A. Base neuve : les 6 migrations dans l'ordre | ✅ toutes appliquées |
| Résultat : 21 tables, 21 fonctions, 66 politiques RLS, 0 table sans RLS | ✅ |
| Bucket `photos` privé + 4 politiques de stockage | ✅ |
| Aucune fonction publique exécutable par `anon`/`PUBLIC` | ✅ 0 |
| Migration de rattrapage rejouée une 2ᵉ fois | ✅ sans erreur |
| B. Base « héritée » (ancien 0917 + 0918 + rattrapage) → schéma identique à A | ✅ identique (hors espaces dans les corps de fonctions) |
| Inscription réelle (GoTrue) → users, profiles, christian_profiles, preferences, user_activity, rôle `user`, prénom | ✅ |
| L'utilisateur lit son propre profil via l'API ; `anon` ne lit rien | ✅ `[{"first_name":"TestLocalA","status":"incomplete"}]` / `[]` |
| Application (`likeProfile`) avec un vrai jeton → atteint les tables | ✅ réponse métier « Ce profil n'est plus disponible. » |
| Tests SQL de l'étape 0.1 (T1–T20) rejoués sur base vide | ✅ tous conformes |

## Point d'attention

Le miroir `drizzle/migrations` n'a pas été modifié (non utilisé pour appliquer le
schéma Supabase). La source de vérité est `supabase/migrations/`.
