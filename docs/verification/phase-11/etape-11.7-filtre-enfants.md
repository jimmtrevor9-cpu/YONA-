# Phase 11 — Étape 11.7 — Filtre enfants

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

Les colonnes `profiles.has_children` et `children_count` existaient, sans aucune règle
de cohérence, et aucun écran ne les remplissait.

## Réalisation

- Migration `20260929030000_phase11_filtre_enfants.sql` (drizzle `0062`) :
  - **contrainte `profiles_children_check` :** un nombre d'enfants n'est possible que si
    le membre a des enfants, et il doit être compris entre 1 et 20. Le nombre reste
    facultatif ;
  - **`search_profiles`, filtre `has_children` :** booléen, sinon refus
    `invalid_filter`. Un profil « non précisé » ne correspond jamais au filtre.
- `src/routes/_authenticated/profile.tsx` : champ « Enfants » (« Non précisé », « Pas
  d'enfant », « J'ai des enfants »). Pour « J'ai des enfants », un champ « Combien ?
  (facultatif) » apparaît, avec le message « entre 1 et 20 » si besoin.
- `src/features/profiles/facts.ts`, `personal-info.ts` : limite du nombre d'enfants et
  message clair si la base refuse.
- `src/features/search/filters.ts`, `search.tsx` : champ « Enfants » (« Indifférent »,
  « Sans enfant », « Avec enfants »).

## Tests (`etape-11.7-filtre-enfants.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Base : nombre sans enfants, 0 ou 21 refusés ; 3 ou non précisé acceptés | ✅ ×5 |
| Recherche : avec enfants, sans enfant, non précisé inclus sans filtre, combinée au sexe et à l'âge | ✅ ×4 |
| Refus `invalid_filter` : texte, nombre, nul | ✅ ×3 |
| Profil : valeur affichée, champ nombre selon le choix, 25 refusé avec message, 1 enregistré | ✅ ×4 |
| Recherche (page) : « Avec enfants » tient compte du changement, « Sans enfant » | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

Au premier passage, le test donnait 19/20. Le champ nombre avait des limites (min/max),
donc le navigateur bloquait l'envoi avec sa propre bulle, sans notre message clair.
Ces limites ont été retirées du champ. La vérification (1 à 20) est faite par la page,
puis par la base. Résultat : 20/20.

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.9 : 23/23 · 1.10 : 11/11 · 11.1 : 26/26 · 11.5 : 32/32 ·
11.6 : 20/20 · 11.7 : 20/20. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 173
au total.
