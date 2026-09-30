# Phase 11 — Étape 11.10 — Filtre objectif relationnel

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

L'objectif relationnel (« Ce que vous recherchez ») est saisi à l'inscription, en texte
libre, dans les préférences du membre (`preferences.relationship_goal`). Ces préférences
ne sont lisibles que par leur propriétaire.

## Réalisation

- Migration `20260929060000_phase11_filtre_objectif.sql` (drizzle `0065`) :
  `search_profiles` accepte le filtre `relationship_goal`.
  - **Validation :** texte de 1 à 100 caractères, sinon refus `invalid_filter`.
  - **Correspondance :** l'objectif du profil doit contenir le texte cherché, sur la
    forme normalisée. Par exemple, « mariage » trouve « Une relation menant au
    mariage ».
  - **Profil sans objectif renseigné :** jamais retenu.
  - **Confidentialité :** les préférences restent privées. Seuls les profils
    correspondants sont renvoyés, jamais le texte de l'objectif, et aucune liste de
    suggestions n'est proposée.
- `src/features/search/filters.ts` et `search.tsx` : champ « Objectif relationnel »
  (exemples : mariage, relation sérieuse), sans suggestions.

## Tests (`etape-11.10-filtre-objectif.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Serveur : casse ignorée, sans accent, combiné au sexe et à l'âge, profil sans objectif | ✅ ×4 |
| Refus `invalid_filter` : vide, plus de 100 caractères, nombre | ✅ ×3 |
| Confidentialité : préférences illisibles, pas de suggestions, objectif jamais renvoyé | ✅ ×3 |
| Page : champ sans suggestions, résultats | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

Au premier passage, le test donnait 13/14. Une apostrophe (« d'abord ») n'était pas
échappée dans la requête de préparation du test. L'application n'était pas en cause.
Après correction du test : 14/14 sur 2 passages.

## Non-régression

0.7 : 33/33 · 1.12 : 18/18 · 11.2 : 18/18 · 11.9 : 13/13 · 11.10 : 14/14. Aucun compte
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
