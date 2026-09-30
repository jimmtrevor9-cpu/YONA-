# Phase 6 — Étape 6.5 — Détecter les parenthèses

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Les parenthèses et crochets autour d'une partie du numéro (« (06) 12 34 56 78 »,
« (+237) 699 88 77 66 », « +33 (0)6… ») coupaient la suite de chiffres et échappaient à
la détection des étapes 6.1 à 6.4.

## Réalisation

- Migration `20260927220000_phase6_parentheses.sql` (miroir
  `drizzle/migrations/0032_phase6_parentheses.sql`) : `contains_phone_number`
  - crochets, accolades et parenthèses pleine largeur ramenés à ( et ) ;
  - parenthèses qui n'entourent que des chiffres (avec « + », espaces ou tirets
    éventuels) retirées, leur contenu est gardé ; les parenthèses de texte restent et
    coupent les suites de chiffres (« (34 ans) », « (Jean 3:16) ») ;
  - règles de 6.1 à 6.4 conservées ; toujours réservée au serveur.

Aucun changement visible dans l'application.

## Tests (`etape-6.5-parentheses.mjs`) — 5/5

| Test | Résultat |
|---|---|
| 16 numéros avec parenthèses détectés ((06), (+237), (0), (0033), [237], {06}, pleine largeur, mêlés d'espaces et de tirets, chaque groupe entre parenthèses) | ✅ |
| 9 messages avec parenthèses sans numéro acceptés (âge, verset, enfants, jour, prix, date, (+3), taille, chapitre) | ✅ |
| Exemples des étapes 6.1 à 6.4 toujours corrects ; fonction réservée au serveur | ✅ ×3 |

## Non-régression

Tests 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5. La fonction n'est encore utilisée
par aucun traitement.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
