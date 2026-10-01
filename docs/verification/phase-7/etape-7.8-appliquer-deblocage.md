# Phase 7 — Étape 7.8 — Appliquer le déblocage à la conversation

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 7.7, un paiement confirmé crée un déblocage de la conversation, mais ni
le serveur (quota lu par l'application) ni l'écran ne le reflétaient : l'offre de
paiement restait affichée, y compris chez l'autre participant.

## Réalisation

- Migration `20260928070000_phase7_appliquer_deblocage.sql` (miroir
  `drizzle/migrations/0041_phase7_appliquer_deblocage.sql`) : `get_message_quota`
  renvoie en plus, pour chacun des deux participants, `unlocked` (déblocage en cours sur
  la conversation, vérifié par le serveur), `unlocked_by` (qui a payé) et
  `unlock_expires_at` (fin de la période continue, déblocages successifs additionnés) ;
  droits inchangés.
- `src/features/messaging/quota.ts`, `src/integrations/supabase/types.ts` : ces
  informations sont lues par l'application.
- `src/components/UnlockedBanner.tsx` (nouveau) : bandeau doré « Conversation
  débloquée — Débloquée par vous / par …, pour vous deux. », annoncé aux lecteurs
  d'écran.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : bandeau en haut de la
  conversation pour les deux participants ; l'offre de paiement n'est plus proposée
  quand la conversation est débloquée.

L'envoi de messages au-delà des 3 gratuits pendant le déblocage est l'étape 7.9 : à
cette étape, le serveur applique encore le quota (vérifié par le test).

## Tests (`etape-7.8-appliquer-deblocage.mjs`) — 19/19

| Test | Résultat |
|---|---|
| Avant : pas de bandeau, offre affichée ; serveur : non débloquée | ✅ ×2 |
| Serveur : débloquée pour Paul et pour Grace, payée par Paul, fin dans 72 h identique pour les deux | ✅ ×3 |
| Écran : bandeau chez Paul (« par vous ») et chez Grace (« par Qpaul »), offre disparue des deux côtés | ✅ ×4 |
| Quota encore appliqué à l'envoi (7.9) | ✅ |
| Autre conversation non débloquée ; tiers sans information ; nouveau paiement refusé (serveur et écran « déjà débloquée ») | ✅ ×5 |
| Deux déblocages à la suite : fin dans 144 h ; déblocages annulés : plus débloquée | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 · 7.6 : 21/21 · 7.7 : 17/17 ·
7.8 : 19/19 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 111 (+3, toutes dans le fichier généré
`types.ts`).
