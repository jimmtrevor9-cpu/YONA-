# Phase 8 — Étape 8.9 — Bloquer l'accès Free

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

- Migration `20260928130000_phase8_favoris_reserve_premium.sql` (drizzle `0047`) :
  `get_favorited_by()` refuse explicitement tout membre sans abonnement Premium actif
  (erreur `premium_required`). C'est le cas d'un abonnement en attente, expiré, pas encore
  commencé ou annulé. Aucune information n'est transmise, ni liste ni nombre. Les
  visiteurs non connectés restent refusés.
- `src/routes/_authenticated/favoris.tsx` : pour un membre gratuit, encart verrouillé
  « Ils vous ont mis en favori », avec le message « Réservé aux membres Premium — Avec
  Premium, découvrez qui vous a mis en favori. L'abonnement Premium sera bientôt
  disponible. ». Il n'y a pas de faux bouton de paiement, car l'abonnement Premium n'est
  pas encore vendu.
- `src/features/favorites/queries.ts` : un abonnement qui expire entre deux lectures est
  traité comme gratuit.
- Test 0.7 adapté : `get_favorited_by` pour un membre gratuit est désormais attendu en
  refus `premium_required`.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 48 fonctions, dont la fonction de date
  d'ajout de l'étape 8.2.

Les favoris eux-mêmes (ajouter, retirer, voir ses favoris) restent ouverts à tous les
membres.

## Tests (`etape-8.9-acces-free-bloque.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Base : gratuit, en attente, expiré, pas commencé, annulé → refus `premium_required` sans prénom | ✅ ×5 |
| Se déclarer Premium soi-même : refusé ; toujours refusé ensuite ; visiteur refusé | ✅ ×3 |
| Page gratuite : encart verrouillé, sans prénom ni nombre ; aucune réponse serveur ne contient les prénoms | ✅ ×3 |
| Favoris toujours utilisables par un membre gratuit (ajout et liste) | ✅ ×2 |
| Devenu Premium, la liste s'affiche ; Premium expiré, de nouveau verrouillé | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Série complète de fin de phase 8

La base a été réinitialisée depuis les migrations : 22 tables, 48 fonctions, 66 règles
d'accès et la tâche planifiée `yona-expirer-deblocages`.

Résultat : **80 séries sur 80 réussies (1 493 / 1 493 vérifications)**. Phase 0 : 3 ·
phase 1 : 15 · phase 2 : 8 · phase 3 : 7 · phase 4 : 10 · phase 5 : 7 · phase 6 : 10 ·
phase 7 : 11 · phase 8 : 9. Aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 116
au total (fichier généré, voir 8.8).
