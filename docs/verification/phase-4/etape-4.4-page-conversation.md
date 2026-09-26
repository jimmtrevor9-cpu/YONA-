# Phase 4 — Étape 4.4 — Créer /messages/:conversationId

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

La liste des conversations (étape 4.3) n'ouvrait rien. Les règles d'accès existantes
suffisent : conversation lisible par ses deux participants seulement ; Match et profil de
l'autre personne selon les règles déjà vérifiées. Aucune modification de la base.

## Réalisation

- `src/features/messaging/queries.ts` : `conversationQuery(conversationId)` — `null` si
  l'adresse est mal formée, si la conversation n'existe pas, est fermée, n'appartient pas
  à la personne connectée, si le Match n'est plus actif ou si l'autre profil n'est plus
  visible (mêmes conditions que la liste).
- `src/routes/_authenticated/messages_.$conversationId.tsx` : page `/messages/<id>`
  (espace protégé) — lien « Messages », bandeau avec photo / initiale, prénom et lien
  « Voir son profil » (profil du Match, étape 3.7), zone de conversation (« Début de votre
  conversation avec … » ; les messages s'y afficheront à l'étape 4.5) ; « Cette
  conversation n'est pas disponible. » avec retour aux messages.
- `src/routes/_authenticated/messages.tsx` : chaque conversation de la liste est un lien
  « Ouvrir la conversation avec … ».
- `src/routeTree.gen.ts` : régénéré par la construction.

## Tests (`etape-4.4-page-conversation.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Clic depuis la liste → /messages/<id> ; prénom ; zone de conversation ; onglet courant | ✅ ×4 |
| « Voir son profil » ; Retour du navigateur ; rechargement ; lien « Messages » | ✅ ×4 |
| L'autre participant voit la conversation ; tiers, identifiant inexistant ou mal formé → non disponible | ✅ ×4 |
| Conversation fermée, Match défait, profil masqué, blocage → non disponible | ✅ ×4 |
| Sans connexion → /login ; 320 px ; aucune erreur JS ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 —
aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
