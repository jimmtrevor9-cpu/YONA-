# Phase 2 — Étape 2.6 — Enregistrer le Pass

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Le bouton « Passer » (étape 2.5) retirait la carte sans rien enregistrer.
- La table `likes` prévoit déjà le type `pass` sur la même ligne que le Like (une ligne par
  couple expéditeur → destinataire, contrainte d'unicité). Les protections de la base
  s'appliquent donc au Pass comme au Like : auteur = membre connecté, pas soi-même, pas
  de membre bloqué, expéditeur éligible, profil visé proposable, date fixée par le serveur
  (étapes 0.6, 2.2 à 2.4).

## Réalisation

- `src/features/profiles/likes.functions.ts` : fonction serveur `passProfile` — auteur
  tiré de la session, identifiant normalisé, pas soi-même, profil visé disponible ; un Pass
  déjà enregistré n'est pas réécrit (`alreadyPassed`) ; un profil **déjà aimé** n'est pas
  passé (« Vous aimez déjà ce profil. » — retirer un Like sera une action distincte) ;
  un Like retiré peut devenir un Pass ; un Pass peut ensuite devenir un Like.
- `src/features/profiles/likes.ts` : `passErrorMessage`.
- `src/routes/_authenticated/discover.tsx` : la carte disparaît tout de suite ; le Pass est
  enregistré ; en cas d'échec, message et carte réaffichée (sauf profil devenu
  indisponible).

Aucune modification de base de données. Test 2.5 mis à jour (les Pass sont désormais
enregistrés). Les profils passés restent proposés après rechargement : exclusion = 2.7.

## Tests (`etape-2.6-enregistrer-pass.mjs`) — 25/25

| Test | Résultat |
|---|---|
| Pass enregistré (type, statut, auteur, date serveur), carte retirée, sans message | ✅ ×4 |
| Persistant ; 2ᵉ Pass sans doublon ; Pass puis Like → même ligne | ✅ ×4 |
| Profil devenu indisponible ; panne réseau (carte réaffichée) | ✅ ×4 |
| Aimé dans un autre onglet → « Vous aimez déjà ce profil. », Like conservé | ✅ ×2 |
| Like retiré puis passé → même ligne | ✅ |
| Serveur : soi-même (normal / MAJUSCULES), sans connexion, 5 envois simultanés | ✅ ×4 |
| API : profil masqué, au nom d'un autre, doublon → refusés ; confidentialité | ✅ ×4 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 — aucun compte ni
fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
