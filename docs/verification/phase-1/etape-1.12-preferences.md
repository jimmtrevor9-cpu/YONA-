# Phase 1 — Étape 1.12 — Vérifier les préférences

Date : 2026-09-26 · Statut : **VALIDÉE**

Préférences = personne recherchée (table `preferences`, privée), saisies à l'étape
« Vos attentes » de l'onboarding.

## Problèmes trouvés

| # | Problème |
|---|---|
| 1 | Tranche d'âge invalide (min > max, champ vidé, < 18, > 99) : seulement refusée par la base → « Impossible d'enregistrer. Réessayez. » sans explication |
| 2 | « Ce que vous recherchez » : longueur illimitée |
| 3 | **Projet familial** : demandé par le cahier des charges, colonne `family_project` existante, mais absent du formulaire |

## Corrections

- `src/features/profiles/preferences.ts` : bornes (18–99), `validateAgeRange`, limites de
  texte, traduction des refus du serveur.
- Onboarding « Vos attentes » : vérification de la tranche d'âge avant l'envoi (message
  clair) ; limites de saisie ; champ **« Votre projet familial »** ajouté avec les
  composants existants (pré-rempli, enregistré).
- Serveur — `supabase/migrations/20260926120000_phase1_preferences.sql` (+ miroir
  `drizzle/migrations/0009_…`) : `relationship_goal` ≤ 100, `family_project` ≤ 200.
  La tranche d'âge était déjà contrôlée (`preferences_age_range`).

## Tests (`etape-1.12-preferences.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Sexe recherché (Indifférent / Une femme / Un homme), âges 18–99 proposés 25–40, limites 100 / 200 | ✅ ×4 |
| Min 40 > max 30 ; max vidé ; min 17 ; max 120 → message clair, profil non activé | ✅ ×4 |
| Saisie valide enregistrée (espaces retirés) ; onboarding rouvert pré-rempli | ✅ ×2 |
| Un autre membre ne peut pas lire les préférences | ✅ |
| Serveur : min 17, max 100, min > max, textes trop longs refusés ; modification valide acceptée | ✅ ×6 |
| Aucune erreur JavaScript | ✅ |

## Non-régression

Base réinstallée à zéro (11 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16.

## À savoir (non modifié)

- Colonnes prévues mais non saisies : ville / pays recherchés, distance maximale
  (`max_distance_km`), critères chrétiens (`christian_criteria`) → recherche (Phase 11).
- **Personnalité et centres d'intérêt** (cahier des charges §4, colonnes
  `profiles.personality` et `profiles.interests`) ne sont saisis nulle part, alors que
  les cartes de découverte affichent les centres d'intérêt et que le filtre 11.12 en aura
  besoin.
- Les préférences ne sont modifiables que via l'onboarding.
