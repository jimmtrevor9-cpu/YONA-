# Phase 10 — Étape 10.4 — Afficher le statut en ligne

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

- `src/components/PresenceBadge.tsx` (nouveau) : statut « En ligne » (pastille verte,
  couleur `success` du thème), « Actif récemment », « Actif cette semaine » ou « Actif il
  y a plusieurs jours » (pastille neutre). Rien n'est affiché si le statut est inconnu ou
  non consultable.
- `src/features/activity/presence.ts` : `presenceQuery`, actualisée chaque minute tant
  que le statut est affiché.
- `src/routes/_authenticated/matches_.$matchId.tsx` : statut sous le prénom, sur le
  profil d'un Match.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : statut sous le prénom, dans
  l'en-tête de la conversation.

Aucune modification de la base de données : la règle et les protections sont celles de
l'étape 10.3. La réservation Premium est l'étape 10.5.

## Tests (`etape-10.4-afficher-statut.mjs`) — 12/12

Une horloge simulée (Playwright `clock`) est utilisée pour la mise à jour automatique.

| Test | Résultat |
|---|---|
| Profil du Match : « En ligne » avec pastille verte, placé avec le prénom | ✅ ×2 |
| Déconnexion de la personne : l'affichage passe à « Actif récemment » en moins d'une minute | ✅ |
| « Actif cette semaine », « Actif il y a plusieurs jours », rien sans activité, rien pour un profil masqué | ✅ ×4 |
| Conversation : « En ligne » sous le prénom, « Voir son profil » intact | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

3.7 : 24/24 · 4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 ·
4.9 : 22/22 · 4.10 : 29/29 · 7.2 : 14/14 · 7.11 : 17/17 · 8.1 : 10/10 · 9.1 : 20/20 ·
10.4 : 12/12. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé, après
la mise en forme d'une ligne du test), 1 122 au total.

> Depuis l'étape 10.5, le statut des autres membres est réservé à Premium : le membre
> qui consulte est désormais Premium dans ce test (12/12).
