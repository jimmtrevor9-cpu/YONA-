# Phase 3 — Étape 3.4 — Afficher le nouveau Match

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Le Match est créé par la base au Like réciproque et `likeProfile` renvoie `mutual` et
  `matchId` (étapes 3.1 / 3.2), mais la page Découverte n'affichait que « Like envoyé. ».
- Composant de fenêtre existant (`src/components/ui/dialog.tsx`, jamais utilisé) : libellé
  caché du bouton de fermeture en anglais (« Close »).

## Réalisation

- `src/components/MatchDialog.tsx` : fenêtre « C'est un Match ! » (composants et styles
  existants : panneau doré, étiquette, cœur, bouton doré « Continuer à découvrir »),
  prénom de la personne, accessible (rôle dialog, titre relié), fermeture par le bouton,
  la croix ou la touche Échap.
- `src/routes/_authenticated/discover.tsx` : fenêtre affichée à la place du message
  quand le Like vient de créer un Match ; « Vous aimez déjà ce profil. » si le Match
  existait déjà (pas de seconde annonce) ; « Like envoyé. » sinon.
- `src/components/ui/dialog.tsx` : libellé « Close » → « Fermer ».

Limite : l'autre personne découvrira le Match dans la liste des Matchs (étapes 3.5 / 3.6) ;
une notification en direct relève de la Phase 15.

## Tests (`etape-3.4-afficher-match.mjs`) — 17/17

| Test | Résultat |
|---|---|
| Like réciproque : fenêtre ouverte, titre, étiquette, prénom, accessible, sans autre message | ✅ ×5 |
| Match bien en base ; « Continuer à découvrir » ferme ; carte « Aimé » | ✅ ×3 |
| 2ᵉ Match : bon prénom ; fermeture par la croix et par Échap | ✅ ×3 |
| Like sans retour : « Like envoyé. », pas de fenêtre | ✅ |
| Match déjà existant : pas de seconde annonce ; nombre de Matchs exact | ✅ ×2 |
| 320 px : fenêtre entièrement visible ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 — aucun compte ni
fichier de test restant.

Tests 3.1 et 3.2 adaptés : après un Like réciproque, la nouvelle fenêtre « Match »
recouvre la page ; les tests la ferment avant de poursuivre (ils s'arrêtaient sinon).

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
