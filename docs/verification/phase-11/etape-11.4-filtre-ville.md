# Phase 11 — Étape 11.4 — Filtre ville

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

La page proposait déjà un champ « Ville ». Côté serveur (étape 11.1), il s'agissait d'une
simple recherche `ILIKE`, avec trois défauts :
- elle tenait compte des accents : « yaounde » ne trouvait pas « Yaoundé » ;
- elle interprétait `%` et `_` comme des jokers ;
- elle ne validait rien.

## Réalisation

Migration `20260929000000_phase11_filtre_ville.sql` (drizzle `0059`) :
- **`search_profiles`, filtre `city` :** texte de 1 à 100 caractères, sinon refus
  `invalid_filter`. La ville du profil doit contenir le texte cherché. La comparaison se
  fait sur la forme normalisée (`normalize_place`), donc sans majuscules, accents,
  tirets, apostrophes ni espaces multiples. `%` et `_` sont du texte ordinaire.
  Ce filtre se combine avec le pays.
- **`list_search_cities(_country)` :** liste des villes réellement renseignées par les
  profils visibles, avec le nombre de profils. Elle peut être limitée à un pays. Chaque
  ville n'apparaît qu'une fois, avec la même règle d'orthographe que les pays. Les
  visiteurs non connectés sont refusés.

Application :
- `src/features/search/filters.ts` : ville limitée à 100 caractères, espaces
  normalisés.
- `src/features/search/queries.ts` : `searchCitiesQuery`.
- `src/routes/_authenticated/search.tsx` : champ « Ville » avec suggestions. Quand un pays
  est saisi, seules les villes de ce pays sont proposées.
- `src/integrations/supabase/types.ts` : ajout de `list_search_cities`.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 53 fonctions.

## Tests (`etape-11.4-filtre-ville.mjs`) — 24/24

| Test | Résultat |
|---|---|
| Serveur : accents et majuscules, « Douala » trouve aussi « Douala 5e », tiret, début de nom, ville sans profil, profil sans ville, `%` et `_` sans effet, combinaison avec le pays | ✅ ×10 |
| Refus `invalid_filter` : vide, espaces, plus de 100 caractères, nombre, nul | ✅ ×5 |
| Liste des villes : dédoublonnée et bien orthographiée, limitée à un pays ; visiteur refusé | ✅ ×3 |
| Page : suggestions du pays saisi, résultats, ville et pays sur la carte, champs vidés | ✅ ×4 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.7 : 33/33 · 2.7 : 16/16 · 11.1 : 26/26 · 11.2 : 18/18 · 11.3 : 22/22 · 11.4 : 24/24.
Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 144 au total (fichier généré).
