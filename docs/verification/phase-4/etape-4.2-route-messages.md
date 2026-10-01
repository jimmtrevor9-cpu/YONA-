# Phase 4 — Étape 4.2 — Créer /messages

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

Aucune page ni entrée de navigation pour la messagerie. Conversations créées
automatiquement au Match (étape 4.1). Espace connecté protégé par `_authenticated`.

## Réalisation

- `src/routes/_authenticated/messages.tsx` : page `/messages` dans l'espace protégé,
  construite comme les autres pages (en-tête « Messages », étiquette, panneau, barre du
  bas) ; titre de navigateur et description. La liste des conversations est l'étape 4.3.
- `src/components/BottomNav.tsx` : onglet « Messages » (icône bulle) entre « Matchs » et
  « Profil » (5 onglets, vérifiés à 320 px).
- `src/routeTree.gen.ts` : régénéré par la construction.
- Test 3.5 mis à jour (la barre du bas compte désormais 5 onglets).

Aucun changement serveur ni base de données.

## Tests (`etape-4.2-route-messages.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Sans connexion → /login ; après « Quitter » → /login | ✅ ×2 |
| Barre du bas (5 onglets, ordre) ; onglet → /messages ; page et titre ; onglet courant signalé | ✅ ×5 |
| Rechargement, bouton Retour, accès direct dans un nouvel onglet ; onglet présent partout | ✅ ×4 |
| 320 px sans débordement ; aucune erreur JS ni d'hydratation ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 — aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
