# Phase 13 — Roi Salomon (étapes 13.1 à 13.10)

Date : 2026-09-30 · Statut : **VALIDÉES**

## Réalisation

- **13.1 à 13.3 — Page `/roi-salomon`** : présentation, idées de questions, champ de
  question (1 000 caractères au plus), bouton d'envoi, discussion affichée en bulles. La
  discussion est gardée dans l'onglet du navigateur (rien n'est stocké sur le serveur).
  Accès par la couronne dans l'en-tête de toutes les pages connectées.
- **13.4 / 13.5 / 13.8 — Quota** (migration `20260930110000_phase13_roi_salomon.sql`,
  drizzle `0072`) : réutilise `ai_usage` et `consume_ai_quota` (Phase 2). Ajouts : liste
  fermée des fonctionnalités (`roi_salomon`, `ice_breaker`), jour calendaire UTC, compte
  actif obligatoire, verrou sur la ligne du jour. 3 questions/jour en gratuit.
- **13.6 — Questions restantes** affichées sous le champ ; champ fermé à 0.
- **13.7 — Premium illimité** (`is_premium`).
- **13.9 — Fournisseur IA réel** : Claude (Anthropic) via le SDK officiel
  `@anthropic-ai/sdk`, modèle `claude-opus-5-5` (modifiable avec `AI_MODEL`), effort bas
  (réponses rapides et moins chères), secours automatique si une demande est refusée.
  Si l'IA échoue, la question est rendue (`refund_ai_quota`, rôle service uniquement).
  `AI_PROVIDER=test` donne des réponses fixes pour les tests.
- **13.10 — Clé API protégée** : `ANTHROPIC_API_KEY` n'est lue que dans la fonction serveur
  (`src/features/ai/claude.server.ts`, importé dynamiquement) ; elle n'est jamais dans le
  code du navigateur ni dans une réponse. Sans clé : « pas encore disponible », rien n'est
  décompté.
- Les numéros de téléphone sont aussi refusés dans les questions (protection de la phase 6).

## Tests (`etape-13.1-a-13.10-roi-salomon.mjs`) — 25/25

| Test | Résultat |
|---|---|
| Base : fonctionnalité inconnue, quota initial, remboursement et écriture directe refusés, visiteur | ✅ ×5 |
| Page : accès, présentation, envoi désactivé à vide, question → réponse, quota 2, numéro refusé | ✅ ×6 |
| 3 questions → champ fermé ; 4e envoyée directement au serveur refusée ; discussion conservée ; lendemain | ✅ ×4 |
| Premium : illimité, 4e question acceptée | ✅ ×2 |
| Sans fournisseur : indisponible, rien de décompté ; clé invalide : question rendue | ✅ ×3 |
| Clé jamais renvoyée ; code du navigateur sans SDK ni clé ; 320 px ; aucune erreur JS ; nettoyage | ✅ ×5 |

Type-check : 0 erreur · Build : réussi.
