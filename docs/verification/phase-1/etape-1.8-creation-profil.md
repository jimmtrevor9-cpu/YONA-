# Phase 1 — Étape 1.8 — Vérifier la création du profil

Date : 2026-09-26 · Statut : **VALIDÉE**

Périmètre : parcours de création du profil (`/onboarding`, 3 étapes : Vous, Votre foi,
Vos attentes) et arrivée des nouveaux membres. Le contrôle détaillé de chaque groupe
de champs relève des étapes 1.9 à 1.12.

## Problèmes trouvés et corrigés

| # | Problème | Correction |
|---|---|---|
| 1 | Le formulaire démarrait vide : le prénom saisi à l'inscription était **effacé** (remplacé par NULL) si l'on ne le retapait pas | Pré-remplissage depuis la base (`onboardingDataQuery`) |
| 2 | Onboarding rouvert par un membre : formulaire vide, « Terminer » **écrasait** tout le profil | Pré-remplissage de toutes les réponses déjà enregistrées ; âges 25–40 proposés seulement tant que l'onboarding n'a jamais été terminé |
| 3 | Enregistrement du profil (qui le rend actif et visible) **avant** la foi et les attentes : un échec laissait un profil visible à moitié rempli | Ordre inversé : foi → attentes → profil en dernier |
| 4 | Après confirmation de l'email ou connexion, un nouveau membre arrivait sur `/discover` | `getPostLoginPath` : `/onboarding` tant que le profil n'est pas créé, sinon `/discover` (page `/login`) |

Fichiers : `src/routes/_authenticated/onboarding.tsx` (logique ; mise en page inchangée,
3 blocs reformatés automatiquement sans effet visuel), `src/routes/login.tsx`,
`src/features/profiles/queries.ts`.

## Tests (`etape-1.8-creation-profil.mjs`, Chromium, parcours réel) — 18/18

| Test | Résultat |
|---|---|
| Inscription → lien de confirmation → arrivée sur `/onboarding` | ✅ |
| « Étape 1 sur 3 », prénom de l'inscription pré-rempli, 320 px | ✅ |
| « Continuer » / « Retour » : étapes et valeurs conservées ; âges proposés 25–40 | ✅ |
| Panne réseau à l'enregistrement → message, reste sur la page, profil **toujours incomplet** | ✅ |
| Nouvel essai → « Votre profil est prêt. », `/discover`, toutes les réponses en base | ✅ |
| Reconnexion avec un profil créé → `/discover` | ✅ |
| Onboarding rouvert : 3 étapes pré-remplies ; « Terminer » sans changement → rien de perdu | ✅ |
| Aucune erreur JavaScript | ✅ |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26.
Tests adaptés au nouveau comportement : les comptes de test des étapes 1.3, 1.4 et 1.7
sont créés avec un profil terminé ; le test 0.5 vérifie l'arrivée sur `/onboarding`
après confirmation.

## À savoir (non modifié)

- `/onboarding` n'a pas de bouton « Quitter » : un membre au profil incomplet, guidé
  vers cette page à chaque connexion, ne peut pas s'y déconnecter (ajout visuel à
  valider).
- Les réponses ne sont enregistrées qu'à « Terminer » : recharger la page en cours de
  route fait perdre les saisies non enregistrées.
- Après « Nouveau mot de passe », un membre au profil incomplet arrive sur `/discover`.
- Aucun champ n'est encore obligatoire (prénom, date de naissance, sexe…) → étapes 1.9 à 1.12 et 1.15.
