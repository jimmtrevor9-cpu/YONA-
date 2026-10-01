# Phase 3 — Étape 3.5 — Créer la route /matches

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

Aucune page ni entrée de navigation pour les Matchs. Espace connecté protégé par la mise
en page `_authenticated` (vérification de session côté serveur, étapes 1.7 / 0.5).

## Réalisation

- `src/routes/_authenticated/matches.tsx` : page `/matches` dans l'espace protégé, construite
  comme les autres pages (en-tête `AppHeader` « Mes Matchs », étiquette, panneau, barre du
  bas) ; titre de navigateur et description. La liste des Matchs est l'étape 3.6.
- `src/components/BottomNav.tsx` : onglet « Matchs » (icône cœur) entre « Recherche » et
  « Profil ».
- `src/routeTree.gen.ts` : régénéré automatiquement par la construction (fichier généré).

Aucun changement serveur ni base de données.

## Tests (`etape-3.5-route-matches.mjs`) — 14/14

| Test | Résultat |
|---|---|
| Sans connexion → /login ; après « Quitter » → /login | ✅ ×2 |
| Barre du bas (4 onglets, ordre) ; onglet → /matches ; page et titre affichés ; onglet courant signalé | ✅ ×5 |
| Rechargement, bouton Retour, accès direct dans un nouvel onglet ; onglet présent partout | ✅ ×4 |
| 320 px sans débordement ; aucune erreur JS ni d'hydratation ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 —
aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé ; fichier généré
`routeTree.gen.ts` sans remarque).
