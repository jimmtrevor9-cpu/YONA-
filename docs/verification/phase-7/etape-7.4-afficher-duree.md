# Phase 7 — Étape 7.4 — Afficher la durée

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

L'offre de déblocage affichait le prix (7.3) mais pas la durée. La règle
`CONVERSATION_UNLOCK.durationDays` (3 jours) existe dans
`src/features/monetization/rules.ts` ; l'expiration réelle sera appliquée par le serveur
(étape 7.10).

## Réalisation

- `src/features/monetization/rules.ts` : `formatDays` (« 1 jour », « 3 jours »).
- `src/components/UnlockOffer.tsx` : « Messages illimités pendant 3 jours » mis en avant
  sous le prix ; texte « Continuez à écrire à … sans limite dans cette conversation
  pendant 3 jours. » ; précision « Sans abonnement ni renouvellement automatique. »
- Test 7.2 adapté (la phrase d'accroche se termine désormais par « pendant 3 jours »).

Aucun changement de la base.

## Tests (`etape-7.4-afficher-duree.mjs`) — 10/10

| Test | Résultat |
|---|---|
| « Messages illimités pendant 3 jours » ; phrase avec « pendant 3 jours » ; sans abonnement ni renouvellement ; prix et bouton inchangés ; aucune autre durée | ✅ ×5 |
| Rechargement ; conversation non épuisée sans durée | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Seul le panneau d'offre change. Tests liés relancés : 5.6 : 18/18 · 7.1 : 12/12 ·
7.2 : 14/14 (adapté) · 7.3 : 11/11 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 097 (inchangé).
