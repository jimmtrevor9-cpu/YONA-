# Phase 2 — Étape 2.5 — Ajouter le bouton Pass

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Aucun bouton ni action « Pass » dans l'application (seul le type `pass` existe dans la
  table `likes`, inutilisé).
- Cahier des charges : Pass enregistré côté serveur, auteur et cible vérifiés, pas de
  doublon — objet de l'étape 2.6 ; exclusion des profils traités — étape 2.7.

## Réalisation

- `src/components/ProfileCard.tsx` : bouton « Passer » (icône croix, style discret
  `ghost` existant) à gauche de « Like », libellé accessible « Passer le profil de … » ;
  masqué pour un profil déjà aimé ; désactivé pendant l'envoi d'un Like sur cette carte.
  Affiché seulement si la page fournit l'action (la page Recherche n'en a pas).
- `src/routes/_authenticated/discover.tsx` : un profil passé est retiré de la liste
  affichée.

**Portée volontairement limitée** : le Pass n'est pas encore enregistré ; après
rechargement, le profil réapparaît. L'enregistrement est l'étape 2.6.

Tests des étapes 2.1 à 2.4 ajustés : ils visent désormais explicitement le bouton Like
(chaque carte a maintenant deux boutons).

## Tests (`etape-2.5-bouton-pass.mjs`) — 19/19

| Test | Résultat |
|---|---|
| Bouton sur chaque carte non aimée, libellé accessible, ordre Passer / Like, 36 px | ✅ ×4 |
| Profil aimé : pas de « Passer » | ✅ |
| Clic et clavier : carte retirée, autres intactes, aucun Like créé | ✅ ×3 |
| Pendant un Like : « Passer » désactivé, puis retiré une fois aimé | ✅ ×2 |
| Tout passé → message de liste vide | ✅ ×2 |
| Portée : aucune écriture ; réapparition après rechargement ; autres membres non affectés | ✅ ×3 |
| Recherche inchangée ; 320 px ; aucune erreur JS ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 — aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
