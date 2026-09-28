# Phase 11 — Étape 11.13 — Ajouter un filtre avancé Premium

Date : 2026-09-28 · Statut : **VALIDÉE**

## Choix du filtre

Le cahier des charges prévoit des « filtres avancés » pour Premium, sans les détailler.
Le filtre retenu est « Activité récente » : membres actifs dans les dernières 24 heures,
cette semaine ou ce mois-ci. Il s'appuie sur la dernière activité enregistrée en phase
10. Il est cohérent avec la présence, déjà réservée à Premium, et ne dévoile aucune
date.

## Réalisation

- Migration `20260929090000_phase11_filtre_avance_premium.sql` (drizzle `0068`) :
  `search_profiles` accepte le filtre `active_within_days`.
  - **Valeurs acceptées :** 1, 7 ou 30 jours ; toute autre valeur donne le refus
    `invalid_filter`.
  - **Profils retenus :** ceux dont la dernière activité est plus récente que la période
    choisie. Un profil sans activité connue n'est jamais retenu.
  - **Confidentialité :** aucune date n'est renvoyée.
- `src/features/search/filters.ts` : périodes et libellés.
- `src/features/search/queries.ts` : `searchPremiumQuery` (statut Premium lu en base).
- `src/routes/_authenticated/search.tsx` : section « Filtres avancés », avec un badge
  « Premium » et le champ « Activité récente ».
  - **Membre Premium :** le champ est utilisable.
  - **Membre gratuit :** le champ est désactivé, avec la mention « Réservé aux membres
    Premium. L'abonnement Premium sera bientôt disponible. ». Il n'y a pas de faux
    bouton de paiement.

La protection côté serveur (refus pour un membre gratuit) est l'objet de l'étape 11.14.

## Tests (`etape-11.13-filtre-avance-premium.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Serveur : 24 h, 7 jours, 30 jours (60 jours et sans activité exclus) ; combiné à d'autres filtres ; aucune date renvoyée | ✅ ×5 |
| Refus `invalid_filter` : 2 jours, texte, nul | ✅ ×3 |
| Page Premium : section, champ actif, 3 périodes ; résultats | ✅ ×2 |
| Page gratuite : champ désactivé avec la mention ; autres filtres disponibles | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

Au premier passage, le test donnait 10/14. Le second compte du test, créé à l'instant,
était « actif » et apparaissait donc à juste titre dans les résultats. Le test fixe
désormais son activité à 90 jours. Résultat : 14/14 sur 2 passages.

## Non-régression

0.7 : 33/33 · 10.1 : 15/15 · 11.1 : 26/26 · 11.12 : 24/24 · 11.13 : 14/14. Aucun compte
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 178
au total.
