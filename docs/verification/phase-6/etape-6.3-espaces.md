# Phase 6 — Étape 6.3 — Détecter les espaces

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Un numéro écrit avec des espaces (« 06 12 34 56 78 », « 699 887 766 ») échappait à la
détection des étapes 6.1 et 6.2, qui ne regardaient que des chiffres collés.

## Réalisation

- Migration `20260927200000_phase6_espaces.sql` (miroir
  `drizzle/migrations/0030_phase6_espaces.sql`) : `contains_phone_number`
  - tous les espaces (insécables, fins, tabulations, retours à la ligne, espaces
    Unicode) ramenés à une espace simple ;
  - espaces entre deux chiffres, et après un « + », supprimés avant l'analyse ;
  - formes ordinaires écartées pour ne pas bloquer de messages normaux : montants avec
    séparateurs de milliers et devise (FCFA, CFA, XAF, XOF, F, francs, €, euros, $,
    USD, dollars) et dates écrites avec des espaces (« 12 10 2026 ») ;
  - règles de 6.1 et 6.2 conservées ; toujours réservée au serveur.

Limite connue : une suite d'au moins quatre petits nombres séparés par des espaces
(« psaumes 23 24 25 26 ») ressemble à un numéro à 8 chiffres et sera considérée comme
tel ; l'expéditeur pourra reformuler (« 23 à 26 »).

Aucun changement visible dans l'application.

## Tests (`etape-6.3-espaces.mjs`) — 5/5

| Test | Résultat |
|---|---|
| 19 numéros avec espaces détectés (paires, triplets, un par un, espaces multiples, tabulations, retours à la ligne, insécables, fins, +237 / + 237 / +33 / 00 33) | ✅ |
| 13 messages sans numéro acceptés (âges, montants en FCFA / F / XAF / € / euros, date, heure, verset, taille) | ✅ |
| Exemples de 6.1 et 6.2 toujours corrects ; fonction réservée au serveur | ✅ ×3 |

## Non-régression

Tests 6.1 : 6/6 · 6.2 : 5/5. La fonction n'est encore utilisée par aucun traitement.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
