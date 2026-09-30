# Phase 9 — Étape 9.4 — Afficher les visiteurs à Premium

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

`get_profile_visitors()` existait. Elle ne renvoyait qu'un identifiant et une date, sans
vérifier que le visiteur était encore visible. Aucun écran ne l'utilisait.

## Réalisation

- Migration `20260928160000_phase9_visiteurs_premium.sql` (drizzle `0050`) :
  `get_profile_visitors()` renvoie un visiteur par ligne, avec :
  - prénom, date de naissance, ville et pays ;
  - date de la dernière visite ;
  - nombre de visites.

  Les visites les plus récentes viennent d'abord, 100 au plus. Conditions :
  - abonnement Premium actif ;
  - personne connectée autorisée à consulter les profils ;
  - visiteur visible et actif ;
  - aucun blocage.
- `src/features/visits/queries.ts` (nouveau) : `profileVisitorsQuery` (statut Premium
  lu en base, visiteurs, photos principales validées).
- `src/features/visits/labels.ts` (nouveau) : « N visiteur(s) », « N visite(s) ».
- `src/routes/_authenticated/visiteurs.tsx` : pour un membre Premium, la page affiche :
  - le nombre de visiteurs ;
  - des cartes (carte commune `FavoriteMemberCard`) avec « Dernière visite le … · N
    visites » ;
  - l'étoile pour mettre un visiteur en favori ;
  - un état vide « Personne n'a encore visité votre profil. » ;
  - un écran de chargement et un message d'erreur.
- `src/integrations/supabase/types.ts` : type de retour mis à jour.

Pour un membre gratuit, la fonction ne renvoie rien et aucune liste n'est affichée. Le
refus explicite et l'écran « réservé Premium » sont l'étape 9.5.

## Tests (`etape-9.4-visiteurs-premium.mjs`) — 16/16

Parmi les visites testées, une visite réelle faite dans le navigateur (profil d'un Match
ouvert) apparaît bien en tête de liste.

| Test | Résultat |
|---|---|
| Base Premium : ordre, un visiteur par ligne avec son nombre de visites, données limitées, exclusions ; gratuit sans donnée ; visiteur refusé | ✅ ×6 |
| Page Premium : cartes et nombre, contenu d'une carte, exclusions, mise en favori | ✅ ×4 |
| Premium sans visiteur : état vide ; gratuit : aucune carte ; Premium expiré : plus rien | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 8.8 : 17/17 · 9.1 : 20/20 · 9.2 : 13/13 · 9.3 : 12/12 ·
9.4 : 16/16. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé). Le
total passe à 1 121 à cause de 5 remarques de mise en forme dans le fichier généré
`types.ts`.
