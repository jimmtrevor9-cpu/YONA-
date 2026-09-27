# Phase 8 — Étape 8.6 — Créer la page Favoris

Date : 2026-09-27 · Statut : **VALIDÉE**

## Réalisation

- `src/routes/_authenticated/favoris.tsx` (nouveau) : page `/favoris` réservée aux membres
  connectés. Elle contient :
  - l'en-tête « Mes favoris » et le lien « Retour au profil » ;
  - un écran de chargement et un message d'erreur ;
  - le nombre réel de favoris ;
  - quand il n'y en a aucun : « Vous n'avez pas encore de favori. Touchez l'étoile d'un
    profil pour le retrouver ici. » et le bouton « Découvrir des profils » ;
  - la navigation du bas.
- `src/routes/_authenticated/profile.tsx` : entrée « Mes favoris » avec le nombre de
  favoris, dans le style des encadrés existants.
- `src/features/favorites/labels.ts` (nouveau) : « 1 profil en favori » / « N profils en
  favori ».

La liste des profils favoris est ajoutée à l'étape 8.7. Aucune donnée fictive.

## Tests (`etape-8.6-page-favoris.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Visiteur non connecté renvoyé vers la connexion | ✅ |
| Profil : lien « Mes favoris » (0) ; clic ouvre /favoris ; titres de page | ✅ ×3 |
| Aucun favori : message et bouton « Découvrir des profils » ; navigation du bas | ✅ ×3 |
| 2 favoris : « 2 profils en favori » (favoris des autres non comptés) ; rechargement direct ; retour au profil (2) | ✅ ×4 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · phase 1 (1.1 à 1.15) : 15/15 séries réussies · 8.1 : 10/10 · 8.2 : 23/23 ·
8.3 : 19/19 · 8.4 : 17/17 · 8.5 : 13/13 · 8.6 : 14/14. Aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
