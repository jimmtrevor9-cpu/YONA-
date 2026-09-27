# Phase 6 — Étape 6.2 — Détecter les formats internationaux

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La détection de l'étape 6.1 repérait 8 chiffres à la suite, ce qui couvre déjà les
formats « 00 » + indicatif. Elle manquait les numéros internationaux courts écrits avec
« + » (7 chiffres après le « + ») et les variantes du signe plus (pleine largeur,
exposant) utilisées pour tromper les filtres.

## Réalisation

- Migration `20260927190000_phase6_formats_internationaux.sql` (miroir
  `drizzle/migrations/0029_phase6_formats_internationaux.sql`) : `contains_phone_number`
  — signes « ＋ » et « ⁺ » ramenés à « + » ; « + » suivi d'au moins 7 chiffres détecté ;
  règles de 6.1 conservées ; toujours réservée au serveur.

Aucun changement visible dans l'application.

## Tests (`etape-6.2-formats-internationaux.mjs`) — 5/5

| Test | Résultat |
|---|---|
| 16 formats internationaux détectés (+33, +237, +225, +221, +241, +243, +32, +41, +1, +44, 0033, 00237, ＋, ⁺, + court) | ✅ |
| 8 messages avec « + » sans numéro acceptés (+3, +10, +25 degrés, +300, 2 + 2, « Douala +237 ») | ✅ |
| Exemples de 6.1 toujours corrects ; fonction toujours réservée au serveur | ✅ ×3 |

## Non-régression

Test 6.1 : 6/6. La fonction n'est encore utilisée par aucun traitement.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
