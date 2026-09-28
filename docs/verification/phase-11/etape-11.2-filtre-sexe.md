# Phase 11 — Étape 11.2 — Filtre sexe

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

Le filtre « Je cherche » existait. Côté serveur (étape 11.1), il acceptait toute valeur
convertible, et une valeur nulle revenait à « indifférent ». La page partait toujours de
« Indifférent », même quand la personne avait enregistré le sexe recherché dans ses
préférences.

## Réalisation

- Migration `20260928230000_phase11_filtre_sexe.sql` (drizzle `0057`) : dans
  `search_profiles`, le filtre `gender` n'accepte plus que le texte `female` ou `male`.
  Tout autre type ou valeur (majuscules, vide, nul, nombre, liste…) donne le refus
  `invalid_filter`. Sans filtre, le sexe est indifférent. Un profil sans sexe renseigné
  ne correspond jamais à un filtre de sexe.
- `src/features/search/queries.ts` : `searchDefaultsQuery` lit le sexe recherché dans les
  préférences de la personne (ses propres données uniquement).
- `src/routes/_authenticated/search.tsx` : le champ « Sexe — je cherche » est présélectionné
  avec cette préférence, et la première recherche l'applique. La personne peut toujours
  choisir « Indifférent », « Une femme » ou « Un homme ».

## Tests (`etape-11.2-filtre-sexe.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Serveur : femmes, hommes (jamais soi-même), indifférent, profil sans sexe jamais filtré | ✅ ×4 |
| Refus `invalid_filter` : « other », « FEMALE », vide, nombre, nul, liste | ✅ ×6 |
| Sexe combiné à l'âge | ✅ |
| Page : préférence « une femme » présélectionnée et appliquée ; « Un homme » ; « Indifférent » ; options ; sans préférence : « Indifférent » | ✅ ×5 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.7 : 33/33 · 1.12 : 18/18 · 2.7 : 16/16 · 11.1 : 26/26 · 11.2 : 18/18. Aucun compte
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 133
au total.
