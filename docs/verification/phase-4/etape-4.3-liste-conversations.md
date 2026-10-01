# Phase 4 — Étape 4.3 — Afficher la liste des conversations

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

La page `/messages` (étape 4.2) n'affichait qu'un texte. Côté base, tout existait :
conversations lisibles par leurs participants (créées au Match, étape 4.1) ; messages
lisibles par les participants s'ils sont livrés, et par leur auteur quel que soit leur
statut ; profils et photos selon les règles de visibilité. Aucune modification de la base.

## Réalisation

- `src/features/messaging/queries.ts` : `myConversationsQuery` — conversations non fermées
  de la personne connectée dont le Match est actif et dont l'autre profil reste visible ;
  prénom, photo principale validée, dernier message lisible ; tri par activité (dernier
  message, sinon création de la conversation).
- `src/routes/_authenticated/messages.tsx` : liste (panneaux dorés, avatar, prénom, heure
  du jour ou date courte, aperçu du dernier message avec « Vous : » pour ses propres
  messages, « Nouveau Match : dites bonjour à … ! » sans message) ; chargement, erreur,
  liste vide avec bouton « Découvrir des profils ».
- `src/routes/_authenticated/discover.tsx` : après un nouveau Match, la liste des
  conversations est rafraîchie.

L'ouverture d'une conversation est l'étape 4.4 ; les messages non lus, l'étape 4.10.

## Tests (`etape-4.3-liste-conversations.mjs`) — 15/15

| Test | Résultat |
|---|---|
| Aucune conversation : message et bouton | ✅ |
| Tri par activité ; aperçu reçu ; « Vous : » ; heure / date courte | ✅ ×4 |
| Message bloqué par la modération (de l'autre) jamais en aperçu | ✅ |
| Non affichées : sens unique, fermée, Match défait, profil masqué, blocage | ✅ ×2 |
| L'autre participant voit la conversation ; un tiers n'en voit aucune | ✅ ×2 |
| Nouveau Match fait dans Découvrir : conversation en tête sans recharger | ✅ |
| 320 px avec aperçu très long ; aucune erreur JS ; panne réseau → message ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 — aucun compte ni
fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé ; fichiers créés ou
modifiés sans remarque).
