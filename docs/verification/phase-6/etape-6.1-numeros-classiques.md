# Phase 6 — Étape 6.1 — Détecter les numéros classiques

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Aucune détection de numéro n'était appliquée. Un détecteur côté application existait
(`src/features/moderation/message-pipeline.ts`) mais il n'est utilisé nulle part et ne
protège rien : l'envoi passe par la fonction de base `send_message`, appelable
directement. La détection doit donc vivre dans la base, au même endroit que l'envoi.

## Réalisation

- Migration `20260927180000_phase6_numeros_classiques.sql` (miroir
  `drizzle/migrations/0028_phase6_numeros_classiques.sql`) : fonction
  `contains_phone_number(texte)` — étape 6.1 : 8 chiffres ou plus à la suite (numéros
  nationaux écrits d'un bloc : France, Cameroun, Côte d'Ivoire, Sénégal, Gabon, RDC,
  Belgique, Suisse…). Déterministe ; réservée au serveur (aucun droit pour les membres
  ni les visiteurs). Complétée aux étapes 6.2 à 6.6, appliquée à l'envoi à l'étape 6.7.
- `docs/verification/outils/detection-telephone.mjs` : outil commun des tests de la
  phase 6 (listes de messages avec / sans numéro).
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 42 fonctions.

Aucun changement visible dans l'application à cette étape.

## Tests (`etape-6.1-numeros-classiques.mjs`) — 6/6

| Test | Résultat |
|---|---|
| 16 numéros classiques détectés (8 à 15 chiffres, seuls ou dans une phrase, 10 pays) | ✅ |
| 14 messages sans numéro acceptés (âge, année, heure, verset, code postal, prix, taille, vide) | ✅ |
| Valeur absente ; fonction déterministe | ✅ ×2 |
| Non appelable par les visiteurs (401) ni les membres | ✅ ×2 |

## Non-régression

La fonction n'est encore utilisée par aucun traitement. Contrôles de la base relancés :
0.6 : 73/73 · 0.7 : 32/32 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
