# Phase 7 — Étape 7.9 — Autoriser les messages pendant le déblocage

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis les étapes 7.7 et 7.8, une conversation débloquée est reconnue par le serveur et
affichée comme telle aux deux participants, mais `send_message` appliquait toujours le
quota de 3 messages gratuits : le déblocage n'avait pas encore d'effet sur l'envoi.

## Réalisation

- Migration `20260928080000_phase7_messages_pendant_deblocage.sql` (miroir
  `drizzle/migrations/0042_phase7_messages_pendant_deblocage.sql`) : dans
  `send_message`, quand un déblocage est en cours sur la conversation (vérifié par le
  serveur), l'envoi est autorisé sans limite et sans consommer le quota gratuit, pour les
  deux participants ; les messages gratuits restants sont conservés pour après le
  déblocage. Toutes les autres règles restent appliquées (participant, conversation
  ouverte, Match actif, blocage, profils, longueur, numéros de téléphone). Droits
  inchangés.
- `src/components/MessageComposer.tsx` : en conversation débloquée, champ ouvert même si
  le quota gratuit est épuisé, texte « Conversation débloquée : messages illimités ».
- `src/routes/_authenticated/messages_.$conversationId.tsx` : transmet l'état débloqué au
  champ.
- Test 7.8 adapté (pendant le déblocage, l'envoi est désormais accepté).

## Tests (`etape-7.9-messages-deblocage.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Avant : 4e message refusé ; pendant : « messages illimités », champ ouvert | ✅ ×2 |
| 3 messages depuis l'application, 15 de plus, 10 en même temps : tous acceptés ; compteur de Paul inchangé | ✅ ×4 |
| Grace (n'a pas payé) : illimitée aussi ; son quota gratuit préservé | ✅ ×2 |
| Numéro, message vide, personne extérieure, blocage : toujours refusés ; autre conversation : quota appliqué | ✅ ×5 |
| Fin de la période : Paul refusé, Grace retrouve ses 2 messages gratuits ; champ refermé à l'écran | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 · 7.6 : 21/21 · 7.7 : 17/17 ·
7.8 : 19/19 · 7.9 : 18/18 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 111 (inchangé).
