# Phase 5 — Étape 5.3 — Autoriser le deuxième message gratuit

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 5.2, `send_message` compte chaque message dans le compteur individuel de
l'expéditeur (plafonné à 3). Le deuxième message suit donc la même règle : autorisé,
compteur de 1 à 2. Analyse faite : aucune modification du code ni de la base n'est
nécessaire ; l'étape consiste à le vérifier dans toutes les situations.

## Réalisation

- Aucune modification du code, de la base ni de l'interface.
- `docs/verification/phase-5/etape-5.3-deuxieme-message-gratuit.mjs` : test du deuxième
  message.

## Tests (`etape-5.3-deuxieme-message-gratuit.mjs`) — 13/13

| Test | Résultat |
|---|---|
| Deuxième message depuis l'application (après rechargement, Ctrl+Entrée) : autorisé, enregistré, délivré, dans l'ordre, affiché ; compteur 1 → 2 | ✅ ×5 |
| Réponses de l'autre personne entre-temps : compteurs séparés ; son deuxième message autorisé | ✅ ×2 |
| Autre conversation : compteur séparé ; tentative refusée non comptée puis deuxième message autorisé | ✅ ×3 |
| 1er et 2e message partis en même temps : tous deux autorisés, compteur exact | ✅ |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Aucun fichier de l'application ni de la base modifié depuis l'étape 5.2 (série validée).
Relancés : 5.1 : 13/13 · 5.2 : 15/15 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 092 (inchangé).
