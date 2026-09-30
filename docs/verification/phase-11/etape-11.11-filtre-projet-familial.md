# Phase 11 — Étape 11.11 — Filtre projet familial

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

Le projet familial (« Votre projet familial ») est saisi à l'inscription dans les
préférences du membre (`preferences.family_project`, 200 caractères au plus). Ces
préférences sont privées.

- Migration `20260929070000_phase11_filtre_projet_familial.sql` (drizzle `0066`) :
  `search_profiles` accepte le filtre `family_project`.
  - **Validation :** texte de 1 à 200 caractères, sinon refus `invalid_filter`.
  - **Correspondance :** le projet du profil doit contenir le texte cherché, comparé sur
    sa forme normalisée.
  - **Profil sans projet renseigné :** jamais retenu.
  - **Confidentialité :** comme pour l'objectif relationnel, le texte n'est jamais
    renvoyé et aucune suggestion n'est proposée.
- `src/features/search/filters.ts`, `search.tsx` : champ « Projet familial ».
- `src/components/SearchTextField.tsx` : longueur maximale paramétrable.

## Tests (`etape-11.11-filtre-projet-familial.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Serveur : casse ignorée, mot contenu, sans accent, combiné à l'objectif relationnel, profil sans projet, 200 caractères acceptés | ✅ ×6 |
| Refus `invalid_filter` : vide, plus de 200 caractères, objet | ✅ ×3 |
| Projet jamais renvoyé | ✅ |
| Page : champ (200 caractères, sans suggestions), résultats | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.7 : 33/33 · 11.8 : 18/18 · 11.10 : 14/14 · 11.11 : 14/14. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
