# Phase 10 — Étape 10.5 — Réserver les informations Premium

Date : 2026-09-28 · Statut : **VALIDÉE**

Cahier des charges : « La visibilité des personnes connectées est Premium. »

## Réalisation

- Migration `20260928210000_phase10_presence_premium.sql` (drizzle `0055`) :
  `get_presence` refuse de donner le statut d'un autre membre à une personne sans
  abonnement Premium actif (erreur `premium_required`). Aucune information n'est
  transmise, même pas « inconnu », pour ne rien laisser deviner. Chacun garde l'accès à
  son propre statut. Pour les membres Premium, les règles de l'étape 10.3 sont
  inchangées.
- `src/features/activity/presence.ts` : le refus devient l'état « locked », qui n'est
  plus actualisé tant que la page reste affichée.
- `src/components/PresenceBadge.tsx` : pour un membre gratuit, la mention discrète
  « Statut en ligne réservé aux membres Premium », avec un cadenas, remplace le statut.
- Test 0.7 adapté : statut d'un autre membre refusé à un membre gratuit, son propre
  statut accepté. Tests 10.3 et 10.4 : le membre qui consulte y est désormais Premium.

L'activité de tous les membres continue d'être enregistrée.

## Tests (`etape-10.5-presence-premium.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Base : gratuit, en attente, expiré, annulé, membre inexistant → refus sans information | ✅ ×5 |
| Son propre statut consultable ; lecture directe de la table : rien ; activité du gratuit toujours enregistrée | ✅ ×3 |
| Page gratuite (profil du Match, conversation) : mention réservée, aucun statut, aucun statut dans les réponses serveur | ✅ ×3 |
| Devenu Premium : « En ligne » ; Premium expiré : de nouveau réservé | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Série complète de fin de phase 10

La base a été réinitialisée depuis les migrations : 22 tables, 49 fonctions, 66 règles
d'accès et la tâche planifiée `yona-expirer-deblocages`.

Résultat : **90 séries sur 90 réussies (1 646 / 1 646 vérifications)**. Phase 0 : 3 ·
phase 1 : 15 · phase 2 : 8 · phase 3 : 7 · phase 4 : 10 · phase 5 : 7 · phase 6 : 10 ·
phase 7 : 11 · phase 8 : 9 · phase 9 : 5 · phase 10 : 5. Aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 122
au total.
