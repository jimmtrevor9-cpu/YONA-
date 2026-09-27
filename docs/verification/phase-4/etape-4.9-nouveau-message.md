# Phase 4 — Étape 4.9 — Afficher le nouveau message

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Après l'étape 4.8, un message envoyé n'apparaissait qu'après un nouveau chargement du fil
(et avec un léger délai) ; l'autre personne ne le voyait qu'en rechargeant la page. La
table `messages` n'était pas diffusée en direct, et le service de diffusion
(Supabase Realtime) n'était pas démarré dans l'environnement de test local.

## Réalisation

- Migration `20260927110000_phase4_messages_direct.sql` (miroir
  `drizzle/migrations/0021_phase4_messages_direct.sql`) : `messages` ajoutée à la
  diffusion en direct (`supabase_realtime`). La diffusion applique les règles d'accès
  existantes : participants pour les messages délivrés, auteur seul pour un message
  retenu par la modération, personne d'autre.
- `src/features/messaging/live.ts` : `useLiveConversation` — abonnement aux nouveaux
  messages de la conversation ouverte ; ajout dans le fil sans doublon ; liste des
  conversations rafraîchie ; rattrapage à la (re)connexion.
- `src/components/MessageThread.tsx` : réception en direct ; si le direct est
  indisponible, nouvelle vérification toutes les 10 s ; défilement automatique vers le
  nouveau message si l'on est en bas de page ou si l'on vient d'écrire ; pendant la
  lecture de l'historique, pas de saut mais un bouton « Nouveau message » ; état
  « Envoi… » affiché sous un message en cours d'envoi.
- `src/features/messaging/queries.ts` : `toThreadMessage`, `mergeThreadMessage` (ajout
  trié, sans doublon), état « sending ».
- `src/routes/_authenticated/messages_.$conversationId.tsx` : le message apparaît dès le
  clic (« Envoi… »), puis est remplacé par le message enregistré ; en cas d'échec il est
  retiré du fil.
- `src/components/MessageComposer.tsx` : le champ se vide dès l'envoi ; si l'envoi
  échoue, le texte y est remis.

Environnement de test : service Realtime local démarré (`supabase start` sans l'exclure).

## Tests (`etape-4.9-nouveau-message.mjs`) — 22/22

| Test | Résultat |
|---|---|
| Envoi : affiché tout de suite (« Envoi… », champ vidé, à droite), puis confirmé ; aucun doublon ; visible en bas | ✅ ×5 |
| Réception en direct par l'autre personne (à gauche, heure) ; 5 messages dans l'ordre ; réponse reçue | ✅ ×4 |
| Message retenu par la modération : jamais reçu par l'autre, affiché chez l'auteur ; supprimé : jamais affiché | ✅ ×3 |
| Lecture de l'historique : pas de saut, bouton « Nouveau message », clic → en bas ; déjà en bas → défilement auto | ✅ ×3 |
| Échec d'envoi : message provisoire retiré, texte remis, raison affichée | ✅ |
| Direct impossible : message reçu quand même (vérification toutes les 10 s) | ✅ |
| Diffusion : la participante reçoit ; un tiers abonné à la conversation ne reçoit rien | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

Première exécution : 21/22 — le texte restait dans le champ pendant l'envoi alors que le
message était déjà affiché ; corrigé (champ vidé aussitôt, texte remis en cas d'échec).
Tests 4.6, 4.7 et 4.8 relancés après la correction : 26/26, 25/25, 42/42.

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 — aucun compte ni
fichier de test restant.

Remarque : une première série a été faussée par deux exécutions lancées en même temps
(journal mélangé, 36 comptes et 3 photos de test laissés) ; tout a été nettoyé et la
série relancée seule : résultat ci-dessus.

Base réinstallée à zéro (23 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 060 (inchangé).
