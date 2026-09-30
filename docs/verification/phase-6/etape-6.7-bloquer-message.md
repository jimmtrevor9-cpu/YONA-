# Phase 6 — Étape 6.7 — Bloquer le message

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La détection (`contains_phone_number`, étapes 6.1 à 6.6) existait mais n'était appliquée
à aucun envoi : un message contenant un numéro partait normalement.

## Réalisation

- Migration `20260928000000_phase6_bloquer_message.sql` (miroir
  `drizzle/migrations/0034_phase6_bloquer_message.sql`) : dans `send_message` (seul
  chemin d'envoi des membres, depuis l'application comme par appel direct), tout message
  où un numéro est détecté est refusé avec le code `phone_number_detected`, avant toute
  écriture : ni enregistré, ni délivré, quota non consommé, rien reçu par l'autre
  personne. Droits de la fonction conservés.

À cette étape, l'application affiche encore le message générique d'échec d'envoi (« Le
message n'a pas pu être envoyé… ») ; le message clair destiné à l'expéditeur est l'étape
6.9.

## Tests (`etape-6.7-bloquer-message.mjs`) — 13/13

| Test | Résultat |
|---|---|
| 7 messages avec numéro (espaces, +237, en lettres, points, parenthèses et tirets, pleine largeur, lettres o/l) : refusés, rien enregistré, quota intact | ✅ ×3 |
| Messages ordinaires (date, heure, âges) acceptés ; personne extérieure refusée | ✅ ×2 |
| Depuis l'application : refus affiché, message retiré du fil, texte remis, rien reçu par l'autre, quota intact, message suivant envoyé | ✅ ×5 |
| Appel direct du serveur de l'application avec un numéro : refusé | ✅ |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Séries touchant la base et la messagerie (phases 0, 4, 5, 6) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 — aucun compte ni fichier de test restant.
(Phases 1 à 3 n'envoient pas de messages ; série complète prévue en fin de phase 6.)

Base réinstallée à zéro (36 migrations). Type-check : 0 erreur · Build : réussi (aucun
changement de code applicatif) · Lint : 1 098 (inchangé).
