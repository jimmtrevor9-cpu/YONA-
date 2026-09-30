# Phase 7 — Étape 7.3 — Afficher le prix

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

L'offre de déblocage (7.2) n'indiquait pas son prix. La règle de prix existe dans
`src/features/monetization/rules.ts` (`CONVERSATION_UNLOCK` : 100 cents, soit 1 USD) ;
elle sera revérifiée par le serveur lors du paiement (étapes 7.5 et 7.6).

## Réalisation

- `src/features/monetization/rules.ts` : `formatUsdShort` — prix court « 1 USD »
  (« 1,50 USD » pour un montant non entier).
- `src/components/UnlockOffer.tsx` : prix affiché en grand (« 1 USD »), mention
  « Paiement unique, pour cette conversation seulement. », bouton « Débloquer la
  conversation pour 1 USD » (toujours inactif jusqu'à l'écran de paiement, étape 7.5).

Aucun changement de la base.

## Tests (`etape-7.3-afficher-prix.mjs`) — 11/11

| Test | Résultat |
|---|---|
| Prix « 1 USD » en grand ; « Paiement unique… » ; bouton « … pour 1 USD » ; aucun autre montant ; même prix au panneau et au bouton | ✅ ×5 |
| Rechargement ; conversation non épuisée sans prix ; autre conversation épuisée : 1 USD | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Seul le panneau d'offre change. Tests liés relancés : 5.6 : 18/18 · 7.1 : 12/12 ·
7.2 : 14/14 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 097 (inchangé).
