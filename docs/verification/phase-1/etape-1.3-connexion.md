# Phase 1 — Étape 1.3 — Vérifier la connexion

Date : 2026-09-25 · Statut : **VALIDÉE** (aucune modification de code nécessaire)

Complète les tests de l'étape 0.5 (bon / mauvais mot de passe, compte inexistant,
email non confirmé, session conservée, déconnexion, redirection si déjà connecté).

## Tests (`etape-1.3-connexion.mjs`, Chromium) — 16/16

| Test | Résultat |
|---|---|
| Page `/login`, champs (types, saisie automatique, obligatoires, étiquettes) | ✅ |
| Email en MAJUSCULES avec espaces autour → connexion réussie | ✅ |
| Message « Bon retour parmi nous. » | ✅ |
| Touche Entrée → connexion | ✅ |
| Pendant la connexion : bouton « Connexion… » désactivé ; double clic → 1 seule requête | ✅ |
| Mot de passe suivi d'un espace → refusé (le mot de passe n'est jamais modifié) | ✅ |
| Liens « Mot de passe oublié ? » et « Créer un compte » | ✅ |
| 320 px : pas de défilement horizontal | ✅ |
| Réponse « trop de requêtes » (HTTP 429) → « Trop de tentatives. Réessayez dans quelques minutes. » | ✅ (réponse simulée) |
| Aucune erreur JavaScript | ✅ |

## Non testable localement

La limite de tentatives de connexion n'est pas appliquée par le Supabase local
(45 essais consécutifs → aucune limite) ; elle l'est sur les projets hébergés.
Le message affiché par YONA a été vérifié en simulant la réponse exacte du serveur.

## Constats pour les étapes prévues (non modifiés)

- **Compte suspendu** (`users.status = 'suspended'`) : la connexion réussit (HTTP 200).
  Son profil est bien masqué aux autres membres (étape 0.6), mais il peut encore
  utiliser l'application → à bloquer à l'étape 23.7 (Suspendre un utilisateur).
- Après connexion, un membre au profil incomplet arrive sur `/discover` → étapes 1.8 et 1.15.
