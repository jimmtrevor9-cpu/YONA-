# Phase 1 — Étape 1.4 — Vérifier la déconnexion

Date : 2026-09-25 · Statut : **VALIDÉE** (aucune modification de code nécessaire)

Le bouton « Quitter » (`AppHeader`) est présent sur `/discover`, `/search`, `/profile`.
`useSignOut` : annule les requêtes, vide le cache, ferme la session Supabase
(portée globale), remplace l'historique par `/login`.

## Tests (`etape-1.4-deconnexion.mjs`, Chromium) — 14/14

| Test | Résultat |
|---|---|
| « Quitter » depuis `/discover`, `/search`, `/profile` → `/login` | ✅ ×3 |
| Session effacée du navigateur (localStorage) après chaque déconnexion | ✅ ×3 |
| Ancien jeton de renouvellement refusé par le serveur après déconnexion | ✅ HTTP 400 |
| Bouton « Retour » du navigateur → pas de retour dans l'espace membre | ✅ |
| Deux onglets : déconnexion dans l'un → l'autre est renvoyé vers `/login` | ✅ |
| Même navigateur, membre suivant : aucune donnée du membre précédent | ✅ |
| Réseau coupé pendant la déconnexion → déconnecté quand même, session effacée | ✅ (coupure confirmée : 1 requête interceptée) |
| Aucune erreur JavaScript | ✅ |

## Limites connues (comportement standard de Supabase, non modifié)

- **Jeton d'accès** : après déconnexion, le jeton d'accès déjà émis reste accepté
  par l'API de données jusqu'à son expiration (`jwt_expiry` = 3600 s, soit 1 h au
  plus). Il est effacé du navigateur ; le risque ne concerne qu'un jeton volé avant
  la déconnexion. L'API du compte (`/auth/v1/user`) le refuse immédiatement (403).
- **Réseau coupé** : la session est effacée localement, mais la session serveur
  reste ouverte (la requête n'est jamais arrivée) jusqu'à son expiration normale.

## Constat pour une étape suivante (non modifié)

- La page `/onboarding` n'affiche pas le bouton « Quitter » : une personne en cours
  de création de profil ne peut pas se déconnecter depuis cette page → étape 1.8.

## Outil ajouté

`docs/verification/outils/demarrer-test-local.sh` : build de l'application pour le
Supabase local et démarrage du serveur de test en une commande (évite de tester
par erreur un build sans variables).
