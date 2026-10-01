# Phase 0 — Étape 0.7 — Vérifier la cohérence code / backend

Date : 2026-09-25 · Statut : **VALIDÉE**

## 1. Types du code (`types.ts`) ↔ base réelle

Types générés depuis le Supabase local (`supabase gen types typescript --local`,
CLI 2.118.0, 7 migrations appliquées) puis comparés **structurellement** à
`src/integrations/supabase/types.ts` avec le compilateur TypeScript.

| Élément | Résultat |
|---|---|
| 21 tables (colonnes, types, relations) | ✅ identiques — seul écart : format du générateur (`NonNullable<Json>` au lieu de `Json` pour les colonnes jsonb non nulles) |
| 25 énumérations | ✅ identiques |
| Fonctions | ⚠️ 2 absentes du code : `is_active_account`, `is_discoverable_profile` (ajoutées à l'étape 0.6) → **ajoutées** à `types.ts`. Autre écart de format uniquement : `Args: never` vs `Record<PropertyKey, never>` |

Après correction : fonctions du code = fonctions de la base.

## 2. Miroir `drizzle/migrations` ↔ `supabase/migrations`

Le miroir (0000 → 0003) ne contenait pas les migrations des étapes 0.4 et 0.6.
Si Lovable s'en sert pour construire la base, ces corrections n'y seraient pas
arrivées. Ajout de `0004_phase0_rattrapage_schema.sql` et
`0005_phase0_corrections_rls.sql` (copies exactes), des instantanés `0004`/`0005`
(vides, comme les précédents) et des entrées du journal.

Test : base neuve construite uniquement avec le miroir drizzle → schéma, règles de
stockage et bucket **identiques** à la base construite avec `supabase/migrations`
(hors espaces et commentaires).

## 3. Requêtes réelles du code ↔ base (`etape-0.7-requetes-code.mjs`) — 32/32

Chaque requête de `src/` rejouée avec `@supabase/supabase-js` et un vrai compte :
onboarding (3 mises à jour), page profil, mon profil, découverte (avec filtres sexe
+ ville), Like (vérification de la cible + upsert, sans doublon), Likes envoyés,
favoris (ajout, liste, retrait) et les 11 fonctions appelées
(`has_role`, `touch_activity`, `get_presence`, `get_ai_quota`, `consume_ai_quota`,
`get_conversation_quota`, `consume_free_message`, `has_active_conversation_unlock`,
`record_profile_visit`, `get_favorited_by`, `get_profile_visitors`). Aucune erreur.

## 4. Règles métier : code (`rules.ts`, `presence.ts`) ↔ base

| Règle | Code | Base | |
|---|---|---|---|
| Messages gratuits par participant | 3 | `consume_free_message` : 3 | ✅ |
| Questions Roi Salomon / jour (gratuit) | 3 | `consume_ai_quota` : 3 | ✅ |
| Photos gratuit / Premium | 3 / 10 | `enforce_photo_limit` : 3 / 10 | ✅ |
| Déblocage | 100 cents USD | défaut 100, `USD` | ✅ |
| Premium mensuel | 500 cents USD | défaut 500, `USD` | ✅ |
| Premium annuel | 3500 cents USD | plan `premium_yearly` présent | ✅ |
| Devise des paiements | USD | défaut `USD` | ✅ |
| Niveaux de présence | online, recent, this_week, inactive, unknown | `get_presence` : mêmes valeurs | ✅ |

## À savoir pour la suite

- Les raisons renvoyées par la base (`free_limit_reached`, `not_participant`,
  `conversation_closed`…) et les décisions de `features/messaging/policy.ts`
  (`DENY_FREE_LIMIT`…) n'ont pas le même vocabulaire : correspondance à établir
  lors de l'envoi de messages (Phases 4–5).
- Les durées (3 jours, 30 jours, 365 jours) sont définies dans le code uniquement ;
  elles seront appliquées côté serveur lors des paiements (Phases 7 et 14).
