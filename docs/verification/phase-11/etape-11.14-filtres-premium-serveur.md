# Phase 11 — Étape 11.14 — Protéger les filtres Premium côté serveur

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

- Migration `20260929100000_phase11_filtres_premium_serveur.sql` (drizzle `0069`) :
  `search_profiles` refuse (erreur `premium_required`) toute recherche qui utilise un
  filtre avancé (`active_within_days`) sans abonnement Premium actif.
  - **Abonnements refusés :** en attente, expiré, pas encore commencé, annulé ou absent.
  - **Portée :** le refus vaut quel que soit l'outil utilisé (écran ou appel direct), y
    compris quand le filtre avancé est mêlé à des filtres de base.
  - **Ordre des contrôles :** les valeurs sont validées d'abord, et le refus arrive
    avant toute lecture de profil. Aucun résultat n'est renvoyé.
  - **Filtres de base :** ils restent ouverts à tous.
- `src/features/search/queries.ts` : `isPremiumRequired`. Pas de nouvelle tentative
  automatique après ce refus.
- `src/routes/_authenticated/search.tsx` :
  - message « Les filtres avancés sont réservés aux membres Premium. » ;
  - si l'abonnement a pris fin, le filtre avancé est retiré du formulaire et de la
    recherche, et le champ est verrouillé.

## Tests (`etape-11.14-filtres-premium-serveur.mjs`) — 15/15

| Test | Résultat |
|---|---|
| Serveur : gratuit, en attente, expiré, pas commencé, annulé → `premium_required` sans aucun profil ; filtre caché parmi d'autres : refusé | ✅ ×6 |
| Gratuit avec filtres de base : accepté ; valeur invalide : `invalid_filter` ; Premium actif : accepté ; visiteur refusé | ✅ ×4 |
| Page : Premium utilise le filtre ; abonnement expiré en cours de session : refus et message ; après rechargement : verrouillé, recherche de base fonctionnelle | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

Au premier passage, le test donnait 14/15. Il oubliait que le compte gratuit du test,
connecté juste avant, était lui aussi « actif cette semaine ». Le résultat de
l'application était correct. Après correction du test : 15/15 sur 2 passages.

## Série complète de fin de phase 11

La base a été réinitialisée depuis les migrations. Elle contient 23 tables, 58
fonctions, 67 règles d'accès, l'extension `unaccent` et la tâche planifiée
`yona-expirer-deblocages`.

Résultat : **104 séries sur 104 réussies (1 920 / 1 920 vérifications)**.

| Phase | Séries |
|---|---|
| 0 | 3 |
| 1 | 15 |
| 2 | 8 |
| 3 | 7 |
| 4 | 10 |
| 5 | 7 |
| 6 | 10 |
| 7 | 11 |
| 8 | 9 |
| 9 | 5 |
| 10 | 5 |
| 11 | 14 |

Aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
