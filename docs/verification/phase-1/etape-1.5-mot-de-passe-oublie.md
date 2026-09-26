# Phase 1 — Étape 1.5 — Vérifier la récupération du mot de passe

Date : 2026-09-26 · Statut : **VALIDÉE**

Périmètre : demande du lien « Mot de passe oublié » (`/forgot-password`) et email
envoyé. La page « Nouveau mot de passe » relève de l'étape 1.6.

Environnement : Supabase local réglé comme un projet hébergé (un email par minute
et par compte, `max_frequency = "60s"`), boîte mail de test Mailpit.

## Problèmes trouvés et corrigés

1. **Nouvelle demande dans la minute** : Supabase répond « For security purposes,
   you can only request this after 59 seconds. » ; YONA affichait « Une erreur est
   survenue. » → `src/features/auth/auth.service.ts` (`translateAuthError`) :
   « Pour votre sécurité, patientez N secondes avant de réessayer. »
2. **Email en anglais** (« Reset your password ») → nouveau modèle français aux
   couleurs de YONA : `supabase/templates/reinitialisation-mot-de-passe.html`
   (installation décrite dans `docs/CONNECTER_UNE_BASE_SUPABASE.md`).

## Tests (`etape-1.5-mot-de-passe-oublie.mjs`, Chromium) — 16/16

| Test | Résultat |
|---|---|
| Page et champ email (type, saisie automatique, obligatoire, étiquette) ; 320 px sans débordement | ✅ |
| Email invalide : formulaire non envoyé | ✅ |
| Bouton « Envoi… » désactivé pendant l'envoi ; double clic → 1 seule demande | ✅ |
| Écran de confirmation neutre (« Si un compte existe… ») | ✅ |
| Email reçu (adresse saisie en MAJUSCULES avec espaces) | ✅ |
| Lien de l'email → `/reset-password` du site | ✅ |
| Email en français : sujet « Réinitialisez votre mot de passe YONA », bouton « Choisir un nouveau mot de passe » | ✅ |
| Bouton de l'email → page « Nouveau mot de passe » prête | ✅ |
| Compte inexistant : même écran, aucun email (ne révèle pas qui est inscrit) | ✅ |
| Nouvelle demande dans la minute : message clair, pas de 2ᵉ email | ✅ |
| Lien « Retour à la connexion » | ✅ |
| Aucune erreur JavaScript | ✅ |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14.
Le test 0.5 a été adapté : il attend désormais la minute entre l'email d'inscription et
celui de réinitialisation, et reconnaît le sujet en français.

## À savoir

- L'email de **confirmation d'inscription** reste le modèle anglais de Supabase
  (hors périmètre de cette étape).
- Le modèle doit être installé sur la future base (tableau de bord ou CLI) : il n'est
  pas appliqué automatiquement par Lovable.
