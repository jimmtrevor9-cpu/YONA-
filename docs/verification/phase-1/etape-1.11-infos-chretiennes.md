# Phase 1 — Étape 1.11 — Vérifier les informations chrétiennes

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

| Information (cahier des charges §4) | Colonne | Saisie avant | Après |
|---|---|---|---|
| Dénomination | `denomination` | ✅ | ✅ |
| Fréquentation de l'église | `church_attendance` | ✅ | ✅ |
| Importance de la foi | `faith_importance` | ✅ | ✅ |
| Pratique chrétienne | `faith_commitment` | ❌ absente | ✅ « Votre pratique chrétienne » |
| Prière | `prayer_practice` | ❌ absente | ✅ « Votre vie de prière » |
| Vision du mariage | `marriage_vision` | ✅ | ✅ |
| Valeurs chrétiennes | `christian_values` | ❌ absente | ✅ « Vos valeurs chrétiennes » (séparées par des virgules) |

Aucune limite de longueur n'existait sur ces champs (ni interface, ni serveur).

## Corrections

- **Onboarding, étape « Votre foi »** : 3 champs ajoutés avec les composants et le
  style existants (Label + Input), pré-remplissage et enregistrement ; limites de saisie
  sur tous les champs.
- **Règles** — `src/features/profiles/christian-info.ts` : limites ; `parseChristianValues`
  (virgules, espaces retirés, vides et doublons supprimés sans tenir compte de la casse,
  40 caractères, 10 valeurs au plus).
- **Serveur** — `supabase/migrations/20260926110000_phase1_infos_chretiennes.sql`
  (+ miroir `drizzle/migrations/0008_…`) : réponses courtes ≤ 100, visions ≤ 1000,
  valeurs ≤ 10 de 1 à 40 caractères (fonction `text_items_max_length`).

## Tests (`etape-1.11-infos-chretiennes.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Étape « Votre foi » : les 7 informations ; limites 100 / 1000 ; 320 px | ✅ ×3 |
| Saisie complète → 7 informations enregistrées | ✅ |
| Valeurs en désordre → doublons/vides retirés, 40 caractères, 10 au plus | ✅ |
| Onboarding rouvert → pré-rempli | ✅ |
| Autre membre : voit les informations d'un profil visible, rien d'un profil masqué | ✅ ×2 |
| Serveur : textes trop longs, 11 valeurs, valeur trop longue ou vide refusés ; modification valide acceptée | ✅ ×7 |
| Aucune erreur JavaScript | ✅ |

## Non-régression

Base réinstallée à zéro avec les 10 migrations. 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11.

## À décider plus tard (non modifié)

- **Champs en texte libre** : dénomination, fréquentation, engagement… sont saisis
  librement (« Évangélique », « évangélique », « Eglise évangélique »…). Les filtres de
  recherche (étapes 11.8 et 11.9) seront bien plus fiables avec des listes de choix.
- Les informations chrétiennes ne sont modifiables que via l'onboarding ; la page Profil
  ne les propose pas, et `couple_vision` n'est pas demandée (non listée au cahier).
