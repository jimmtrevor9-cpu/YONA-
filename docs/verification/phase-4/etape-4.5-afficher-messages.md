# Phase 4 — Étape 4.5 — Afficher les messages

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La page d'une conversation (étape 4.4) n'affichait que « Début de votre conversation
avec … ». Côté base, les règles existantes suffisent : les participants lisent les
messages livrés ; l'auteur lit en plus ses propres messages retenus par la modération ;
personne d'autre ne lit rien. Aucune modification de la base.

## Réalisation

- `src/features/messaging/queries.ts` : `conversationMessagesQuery` — les 200 messages
  les plus récents de la conversation (supprimés exclus), remis dans l'ordre
  chronologique.
- `src/components/MessageThread.tsx` (nouveau) : fil des messages — bulles dorées à
  droite pour ses propres messages, bulles sombres à gauche pour l'autre personne ;
  heure sous chaque message ; séparateurs de jour (« Aujourd'hui », « Hier », date
  complète) ; retours à la ligne conservés, mots très longs coupés ; son propre message
  retenu par la modération marqué « Non envoyé : bloqué par la modération » ; auteur
  annoncé aux lecteurs d'écran ; ouverture sur le message le plus récent ; chargement,
  erreur, et « Début de votre conversation avec … » si aucun message.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : la zone de conversation
  affiche ce fil.

L'écriture et l'envoi de messages sont les étapes 4.6 à 4.8.

## Tests (`etape-4.5-afficher-messages.mjs`) — 21/21

| Test | Résultat |
|---|---|
| Ordre chronologique ; côtés (moi à droite, l'autre à gauche) ; heure ; séparateurs de jour | ✅ ×4 |
| Retour à la ligne ; message bloqué de l'autre jamais montré ; le sien marqué « Non envoyé » ; supprimé jamais affiché | ✅ ×4 |
| Auteur annoncé (accessibilité) ; texte d'accueil masqué quand il y a des messages | ✅ ×2 |
| L'autre participant : mêmes échanges, côtés inversés, ses propres messages bloqués seulement | ✅ ×2 |
| Conversation vide ; 40 messages → ouverture sur le plus récent ; rechargement | ✅ ×3 |
| Tiers et visiteur : aucun message lisible (API) ; tiers sur la page : non disponible | ✅ ×3 |
| 320 px avec mot très long ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
