# Phase 1 — Étape 1.2 — Vérifier l'inscription

Date : 2026-09-25 · Statut : **VALIDÉE**

## Problèmes trouvés

| # | Problème | Conséquence |
|---|---|---|
| 1 | Prénom de plus de 60 caractères : la contrainte `profiles_first_name_length` faisait échouer toute l'inscription | Message « Une erreur est survenue », personne bloquée sans explication |
| 2 | Prénom composé uniquement d'espaces accepté | Compte créé sans prénom |
| 3 | Confirmation d'email désactivée côté Supabase : « Compte créé. » puis aucune redirection | Personne connectée mais laissée sur le formulaire |

## Corrections

- `src/routes/register.tsx` (logique uniquement, aucun changement visuel) :
  prénom limité à 60 caractères à la saisie (`maxLength`), prénom vide refusé avec
  « Indiquez votre prénom. », redirection vers `/onboarding` quand la session est
  ouverte directement.
- `supabase/migrations/20260925140000_phase1_inscription_prenom.sql` (+ miroir
  `drizzle/migrations/0006_…`) : `handle_new_user` nettoie le prénom côté serveur
  (espaces retirés, 60 caractères max, vide → NULL). Une inscription directe via
  l'API ne peut plus échouer à cause du prénom.

## Tests (`etape-1.2-inscription.mjs`, Chromium, mobile 390 px)

| Test | Avec confirmation | Sans confirmation |
|---|---|---|
| Page, champs obligatoires, types, étiquettes | ✅ | ✅ |
| Mot de passe de 7 caractères refusé | ✅ | ✅ |
| Email invalide refusé | ✅ | ✅ |
| Inscription → « Consultez votre boîte mail » + adresse rappelée | ✅ | — |
| Inscription → redirection `/onboarding` | — | ✅ |
| Fiche créée : prénom nettoyé (« Élise »), rôle, profil chrétien, préférences, profil incomplet | ✅ | ✅ |
| Prénom de 80 caractères → inscription réussie, prénom de 60 caractères | ✅ | ✅ |
| Prénom vide → « Indiquez votre prénom. », aucun compte | ✅ | ✅ |
| Email déjà utilisé → aucun second compte | ✅ (existence non révélée) | ✅ « Un compte existe déjà avec cet email. » |
| Aucune erreur JavaScript | ✅ | ✅ |
| **Total** | **12/12** | **11/11** |

Côté serveur (API directe) : prénom de 80 caractères → HTTP 200, 60 caractères
enregistrés ; prénom d'espaces → HTTP 200, prénom vide (NULL).

## Non-régression

Authentification 0.5 : 24/24 · RLS 0.6 : 73/73 · Requêtes du code 0.7 : 32/32 ·
Accueil 1.1 : 27/27 · Tests SQL 0.1 : conformes.

## À savoir pour la suite

- L'âge minimum (18 ans) n'est pas demandé à l'inscription : la date de naissance
  est saisie dans l'onboarding → étape 1.9.
- Aucune case d'acceptation des conditions d'utilisation / confidentialité
  (documents inexistants, cf. étape 1.1).
