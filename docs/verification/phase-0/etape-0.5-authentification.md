# Phase 0 — Étape 0.5 — Vérifier l'authentification

Date : 2026-09-25 · Statut : **VALIDÉE**

## Environnement de test

Supabase local complet réglé comme un projet en ligne : confirmation d'email
obligatoire, mot de passe de 8 caractères minimum, boîte mail de test Mailpit.
Application buildée pour ce projet, testée dans Chromium
(`etape-0.5-authentification-e2e.mjs`). Comptes de test `@example.test` supprimés à la fin.

## Problèmes trouvés et corrigés

1. **Erreur React #418 (hydratation)** sur `/discover`, `/onboarding`, `/profile`,
   `/search` à chaque chargement direct par un visiteur non connecté : la redirection
   vers `/login` avait lieu pendant l'hydratation d'une route `ssr: false`.
   → `src/routes/_authenticated/route.tsx` : la garde est vérifiée dans le composant
   après l'hydratation. Le jeton est toujours revalidé auprès de Supabase
   (`getUser`) ; une session devenue invalide est retirée (plus de boucle possible
   entre `/login` et `/discover`).
2. **Page « Nouveau mot de passe »** : affichait « Ouvrez cette page depuis le lien
   reçu par email » alors qu'on venait du lien (le client Supabase vide l'URL avant
   la lecture). → `src/routes/reset-password.tsx` : reconnaissance aussi via
   l'événement `PASSWORD_RECOVERY` ou la session ouverte.

## Tests (24/24, exécutés deux fois)

| Test | Résultat |
|---|---|
| `/discover` sans session → `/login` | ✅ |
| Inscription → « Consultez votre boîte mail » | ✅ |
| Connexion avant confirmation → « Veuillez confirmer votre email… » | ✅ |
| Email de confirmation reçu → lien → session ouverte sur `/discover` | ✅ |
| Session conservée après rechargement | ✅ |
| « Quitter » → `/login` ; `/discover` redirige ensuite vers `/login` | ✅ |
| Mauvais mot de passe / compte inexistant → « Email ou mot de passe incorrect. » | ✅ |
| Connexion valide → `/discover` ; `/login` déjà connecté → `/discover` | ✅ |
| Mot de passe oublié → email → `/reset-password` reconnaît le lien | ✅ |
| Nouveau mot de passe enregistré ; ancien refusé ; nouveau accepté | ✅ |
| Connecté : chargement direct de `/discover`, `/onboarding`, `/profile`, `/search` | ✅ |
| Compte supprimé côté serveur → retour stable sur `/login` | ✅ |
| Aucune erreur JavaScript sur tout le parcours | ✅ |

### Rôles

| Test | Résultat |
|---|---|
| Nouveau membre : `has_role(user)` = true, `is_admin()` = false | ✅ |
| Auto-promotion admin via l'API | ✅ refusée par RLS |
| Promotion par le serveur → `is_admin()` = true | ✅ |

## Constats pour les étapes suivantes (non modifiés)

- Si la confirmation d'email est désactivée dans Supabase, l'inscription affiche
  « Compte créé. » mais reste sur le formulaire (pas de redirection) → étape 1.2.
- Après connexion, un nouveau membre arrive sur `/discover` même si son profil est
  incomplet → étapes 1.8 et 1.15.
- Aucune interface `/admin` à ce stade (Phase 23).
