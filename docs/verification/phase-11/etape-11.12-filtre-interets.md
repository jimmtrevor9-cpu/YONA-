# Phase 11 — Étape 11.12 — Filtre centres d'intérêt

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

La colonne `profiles.interests` (liste) existait et s'affichait sur les cartes, mais
aucun écran ne la remplissait, et aucune limite n'était imposée.

## Réalisation

- Migration `20260929080000_phase11_filtre_interets.sql` (drizzle `0067`) :
  - **contraintes :** 10 centres d'intérêt au plus (`profiles_interests_count`), de 1 à
    40 caractères chacun (`profiles_interests_item_length`) ;
  - **`search_profiles`, filtre `interests` :** liste de 1 à 5 textes de 1 à 40
    caractères, sinon refus `invalid_filter`. Le profil doit avoir au moins l'un d'eux.
    La comparaison est exacte sur la forme normalisée : « Musique » = « musique », mais
    « musi » ne correspond pas ;
  - **`list_search_values` :** champ `interests` ajouté aux suggestions (information
    publique).
- `src/features/profiles/facts.ts` : `parseInterests` découpe « musique, randonnée… »,
  réduit les espaces, retire les doublons sans tenir compte des majuscules, et vérifie
  les limites.
- `src/routes/_authenticated/profile.tsx` : champ « Centres d'intérêt », séparés par des
  virgules, 10 au plus, avec message clair. `personal-info.ts` : message si la base
  refuse.
- `src/features/search/filters.ts`, `queries.ts`, `search.tsx` : champ « Centres
  d'intérêt » (5 au plus) avec suggestions réelles.

## Tests (`etape-11.12-filtre-interets.mjs`) — 24/24

| Test | Résultat |
|---|---|
| Base : 11 éléments, 41 caractères, élément vide refusés ; 2 valides acceptés | ✅ ×4 |
| Recherche : casse et accents ignorés, « ou » entre plusieurs intérêts, pas de correspondance partielle, profil sans intérêt | ✅ ×5 |
| Refus `invalid_filter` : texte, liste vide, 6 éléments, 41 caractères, vide, nombre | ✅ ×6 |
| Suggestions : chaque intérêt une seule fois, avec le nombre de profils | ✅ |
| Profil : valeurs affichées, liste nettoyée et enregistrée, 11 intérêts refusés avec message | ✅ ×3 |
| Recherche (page) : suggestions, résultats à jour, 6 intérêts refusés avec message | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

Au premier passage, le test donnait 23/24. Il attendait la suggestion « Musique » alors
que l'orthographe « musique » était devenue la plus fréquente pendant le test. C'est
bien la règle voulue : l'application était correcte, le test a été corrigé. Résultat :
24/24 sur 2 passages.

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.9 : 23/23 · 1.10 : 11/11 · 2.1 : 20/20 · 3.7 : 24/24 ·
11.7 : 20/20 · 11.8 : 18/18 · 11.9 : 13/13 · 11.12 : 24/24. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
