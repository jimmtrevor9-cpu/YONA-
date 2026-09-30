# Phase 9 — Étape 9.5 — Bloquer l'accès Free

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

- Migration `20260928170000_phase9_visiteurs_reserve_premium.sql` (drizzle `0051`) :
  `get_profile_visitors()` refuse explicitement, avec l'erreur `premium_required`, tout
  membre sans abonnement Premium actif :
  - abonnement en attente ;
  - abonnement expiré ;
  - abonnement pas encore commencé ;
  - abonnement annulé.

  Aucune information n'est transmise, ni liste ni nombre. Les visiteurs non connectés
  restent refusés. Lire la table directement ne donne rien non plus : seul le visiteur
  lit ses propres visites.
- `src/routes/_authenticated/visiteurs.tsx` : pour un membre gratuit, un encart « Réservé
  aux membres Premium » explique : « Avec Premium, découvrez qui a visité votre profil.
  L'abonnement Premium sera bientôt disponible. ». Il n'y a pas de faux bouton de
  paiement.
- `src/features/visits/queries.ts` : un abonnement qui expire entre deux lectures est
  traité comme gratuit.
- Test 0.7 adapté : `get_profile_visitors` pour un membre gratuit est désormais attendu en
  refus `premium_required`.

Les visites vers un membre gratuit restent enregistrées. Elles s'affichent s'il devient
Premium.

## Tests (`etape-9.5-acces-free-bloque.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Base : gratuit, en attente, expiré, pas commencé, annulé → refus `premium_required` sans prénom | ✅ ×5 |
| Lecture directe de la table : rien ; visiteur non connecté refusé | ✅ ×2 |
| Visites vers un membre gratuit enregistrées (dont une visite réelle dans le navigateur) | ✅ |
| Page gratuite : encart verrouillé, sans prénom ni nombre ; aucune réponse serveur ne contient les prénoms | ✅ ×3 |
| Devenu Premium : visites passées affichées ; Premium expiré : de nouveau verrouillé | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Série complète de fin de phase 9

La base a été réinitialisée depuis les migrations : 22 tables, 48 fonctions, 66 règles
d'accès et la tâche planifiée `yona-expirer-deblocages`.

Résultat : **85 séries sur 85 réussies (1 570 / 1 570 vérifications)**. Phase 0 : 3 ·
phase 1 : 15 · phase 2 : 8 · phase 3 : 7 · phase 4 : 10 · phase 5 : 7 · phase 6 : 10 ·
phase 7 : 11 · phase 8 : 9 · phase 9 : 5. Aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 121
au total (fichier généré, voir 9.4).
