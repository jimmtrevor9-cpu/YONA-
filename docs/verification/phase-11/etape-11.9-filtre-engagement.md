# Phase 11 — Étape 11.9 — Filtre engagement chrétien

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

L'engagement chrétien correspond au champ « Votre pratique chrétienne » du profil
chrétien (`faith_commitment`). C'est une information publique, saisie en texte libre à
l'inscription.

- Migration `20260929050000_phase11_filtre_engagement.sql` (drizzle `0064`) :
  - **`search_profiles`, filtre `faith_commitment` :** texte de 1 à 100 caractères, sinon
    refus `invalid_filter`. La pratique du profil doit contenir le texte cherché, comparé
    sur sa forme normalisée (sans accents ni casse). Un profil sans pratique renseignée
    n'est jamais retenu ;
  - **`list_search_values` :** champ `faith_commitment` ajouté aux suggestions.
- `src/features/search/filters.ts`, `queries.ts`, `search.tsx` : champ « Engagement
  chrétien » avec suggestions réelles (composant `SearchTextField`).

## Tests (`etape-11.9-filtre-engagement.mjs`) — 13/13

| Test | Résultat |
|---|---|
| Serveur : sans accent, mot contenu, combiné à la dénomination, sans profil, profil sans engagement | ✅ ×5 |
| Refus `invalid_filter` : vide, plus de 100 caractères, liste | ✅ ×3 |
| Suggestions : les valeurs réelles | ✅ |
| Page : suggestions, résultats | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.7 : 33/33 · 11.1 : 26/26 · 11.8 : 18/18 · 11.9 : 13/13. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
