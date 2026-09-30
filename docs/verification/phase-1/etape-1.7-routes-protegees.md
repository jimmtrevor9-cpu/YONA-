# Phase 1 — Étape 1.7 — Vérifier les routes protégées

Date : 2026-09-26 · Statut : **VALIDÉE** (aucune modification de code nécessaire)

## Inventaire

| Accès | Routes |
|---|---|
| Public | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` |
| Membre connecté (`_authenticated`, `ssr: false`) | `/discover`, `/search`, `/profile`, `/onboarding` |
| Pas encore créées (phases suivantes) | `/matches`, `/messages`, `/messages/:conversationId`, `/premium`, `/settings`, `/admin` → 404 à ce stade |

Protection : garde `src/routes/_authenticated/route.tsx` (corrigée à l'étape 0.5) +
règles RLS côté base (étape 0.6), qui protègent les données même sans l'interface.

## Tests (`etape-1.7-routes-protegees.mjs`, Chromium) — 26/26

| Test | Résultat |
|---|---|
| Non connecté : chargement direct des 4 pages protégées → `/login` | ✅ ×4 |
| Non connecté : aucun contenu protégé affiché, même un instant (observateur du DOM) | ✅ ×4 |
| Non connecté : le serveur n'envoie aucun contenu des pages protégées | ✅ ×4 |
| Non connecté : navigation interne vers `/profile` → `/login` | ✅ |
| Les 5 pages publiques restent accessibles sans connexion | ✅ ×5 |
| Page inexistante → HTTP 404 « Page introuvable » + lien « Retour à l'accueil » | ✅ ×2 |
| Session falsifiée dans le navigateur (jeton modifié) → refusée, effacée, retour stable sur `/login` | ✅ ×2 |
| Connecté : menu du bas Recherche / Profil / Découvrir | ✅ ×3 |
| Aucune erreur JavaScript | ✅ |

Déjà vérifié à l'étape 0.5 : pages protégées accessibles une fois connecté, compte
supprimé côté serveur → retour sur `/login`.

## À savoir pour la suite (non modifié)

- Après connexion, on arrive toujours sur `/discover`, même si l'on voulait ouvrir une
  autre page réservée (le lien d'origine n'est pas conservé). À prévoir quand des liens
  directs seront envoyés aux membres (notifications, Phase 19).
- Les futures pages réservées devront être créées dans `src/routes/_authenticated/` ;
  `/admin` nécessitera en plus une vérification du rôle administrateur (étape 23.2).
- Compte suspendu : toujours connecté → étape 23.7 (constat de l'étape 1.3).
