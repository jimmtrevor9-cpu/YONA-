# Phase 3 — Étape 3.6 — Afficher les Matchs

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

La page `/matches` (étape 3.5) n'affichait qu'un texte. Tout le nécessaire existait déjà
côté base : Matchs lisibles par leurs seuls participants ; profils et photos lisibles selon
les règles de visibilité (profil actif et visible, compte actif, sans blocage, photo
validée) — aucune modification de la base nécessaire.

## Réalisation

- `src/features/matches/queries.ts` : `myMatchesQuery` — Matchs **actifs** de la personne
  connectée (plus récents d'abord), prénom / date de naissance / ville / pays de l'autre
  personne et lien temporaire vers sa photo principale validée. Un Match dont l'autre
  profil n'est plus visible pour elle (masqué, suspendu, compte suspendu, blocage) n'est pas
  affiché.
- `src/routes/_authenticated/matches.tsx` : liste (panneaux dorés existants, avatar photo ou
  initiale, prénom · âge, ville, « Match le … » en français), chargement, erreur, et liste
  vide avec bouton « Découvrir des profils ».
- `src/routes/_authenticated/discover.tsx` : après un nouveau Match, la liste des Matchs est
  rafraîchie (visible immédiatement dans l'onglet).

L'ouverture du profil depuis un Match est l'étape 3.7.

**Observations pour plus tard** (non modifiées, hors de cette étape) :
- en cas de panne réseau, deux niveaux de nouvelles tentatives automatiques (client de
  base de données + page) font attendre ~35 s avant le message d'erreur, sur toutes les
  pages ;
- la suppression d'un compte n'efface pas ses fichiers photos (à traiter avec la
  suppression de compte, Phase 20).

## Tests (`etape-3.6-liste-matchs.mjs`) — 17/17

| Test | Résultat |
|---|---|
| Aucun Match : message et bouton vers Découvrir | ✅ |
| 7 Matchs du plus récent au plus ancien ; prénom, âge, ville, date en français | ✅ ×3 |
| Photo validée affichée ; photo en attente → initiale | ✅ ×2 |
| Non affichés : sens unique, Match défait / bloqué, profil masqué, compte suspendu, blocage | ✅ ×2 |
| L'autre personne voit le Match ; un tiers n'en voit aucun | ✅ ×2 |
| Nouveau Match fait dans Découvrir : en tête de liste sans recharger | ✅ |
| Nouvelle session ; 320 px avec prénom très long ; compte supprimé → retiré | ✅ ×3 |
| Panne réseau → message d'erreur ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
