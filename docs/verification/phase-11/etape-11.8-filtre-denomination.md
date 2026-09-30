# Phase 11 — Étape 11.8 — Filtre dénomination

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

L'église ou la dénomination est saisie en texte libre à l'inscription (profil chrétien,
information publique du profil). Aucun filtre ne l'utilisait.

## Réalisation

- Migration `20260929040000_phase11_filtre_denomination.sql` (drizzle `0063`) :
  - **`search_profiles`, filtre `denomination` :** texte de 1 à 100 caractères, sinon
    refus `invalid_filter`. La dénomination du profil doit contenir le texte cherché,
    comparé sur sa forme normalisée (sans majuscules, accents, tirets ni apostrophes).
    Par exemple, « evangelique » trouve « Église évangélique ». Un profil sans
    dénomination n'est jamais retenu ;
  - **`list_search_values(_field)` :** valeurs réellement renseignées par les profils
    visibles (sans blocage), pour l'aide à la saisie. Seul le champ `denomination` est
    accepté pour l'instant ; tout autre champ donne `invalid_filter`. Les visiteurs non
    connectés sont refusés.
- `src/components/SearchTextField.tsx` (nouveau) : champ texte de recherche, avec
  suggestions éventuelles. Il sera réutilisé par les filtres suivants.
- `src/features/search/filters.ts`, `queries.ts`, `search.tsx` : champ « Église /
  dénomination » avec suggestions.
- `src/integrations/supabase/types.ts` : ajout de `list_search_values`.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 58 fonctions.

## Tests (`etape-11.8-filtre-denomination.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Serveur : sans accents ni casse, mot contenu, « Église », dénomination sans profil, profil sans dénomination, profil masqué exclu, combinaison avec d'autres filtres | ✅ ×7 |
| Refus `invalid_filter` : vide, plus de 100 caractères, nombre, nul | ✅ ×4 |
| Suggestions : valeurs réelles (masqué non compté) ; champ non prévu refusé ; visiteur refusé | ✅ ×3 |
| Page : suggestions, résultats pour « évangélique » | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.11 : 16/16 · 3.7 : 24/24 · 11.1 : 26/26 · 11.6 : 20/20 ·
11.7 : 20/20 · 11.8 : 18/18. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total (fichier généré).
