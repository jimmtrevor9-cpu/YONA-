# Phase 8 — Étape 8.1 — Ajouter le bouton Favori

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La table `favorites` existait (un favori par couple, pas de favori de soi-même, règles
d'accès : chacun lit, ajoute et retire ses propres favoris, pas en cas de blocage), ainsi
que `get_favorited_by` (Premium) et des fonctions côté application jamais utilisées par
un écran. Aucun bouton Favori n'existait.

## Réalisation

- `src/components/FavoriteButton.tsx` (nouveau) : bouton étoile « Ajouter … aux favoris »
  / « Retirer … des favoris », état enfoncé et étoile dorée pleine quand le profil est
  favori, état d'attente.
- `src/features/favorites/queries.ts` (nouveau) : favoris de la personne connectée (règles
  d'accès : ses propres favoris seulement).
- `src/components/ProfileCard.tsx` : étoile en haut à droite de la carte (optionnelle).
- `src/routes/_authenticated/discover.tsx` : étoile sur chaque carte, état réel lu en
  base.
- `src/routes/_authenticated/matches_.$matchId.tsx` : étoile à côté du prénom sur le
  profil d'un Match.

- Test 2.5 adapté : il lit désormais seulement la ligne d'actions « Passer » / « Like »
  (l'étoile est dans l'en-tête de la carte).

L'enregistrement est l'étape 8.2 : en attendant, un clic affiche « L'ajout aux favoris
arrive très bientôt. » et n'enregistre rien.

## Tests (`etape-8.1-bouton-favori.mjs`) — 11/11

| Test | Résultat |
|---|---|
| Carte Découvrir : bouton nommé ; non favori (vide) ; déjà favori (plein, « Retirer ») ; Like et Passer présents | ✅ ×4 |
| Clic : message « arrive très bientôt », rien enregistré ; clavier | ✅ ×3 |
| Profil d'un Match : bouton présent | ✅ |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Premier passage : 2.5 arrêté (il comptait l'étoile parmi les boutons Passer / Like) ;
n'ayant pas pu supprimer ses comptes de test, il a faussé 2.7 (7/16) et 2.8 (19/29), qui
voyaient des cartes en trop. Test 2.5 adapté, comptes restants supprimés.

Après correction — séries touchant la découverte, les Likes, les Matchs et les favoris
(phases 0, 1.14, 1.15, 2, 3, 8) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 ·
2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 ·
2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 · 3.5 : 14/14 ·
3.6 : 17/17 · 3.7 : 24/24 · 8.1 : 11/11 — aucun compte ni fichier de test restant.
(Phases 4 à 7 non concernées ; série complète prévue en fin de phase 8.)

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé).
