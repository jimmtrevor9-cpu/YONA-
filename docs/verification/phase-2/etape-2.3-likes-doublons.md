# Phase 2 — Étape 2.3 — Empêcher les Likes en double

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Base : contrainte d'unicité `likes_sender_id_receiver_id_key` (un seul Like par couple
  expéditeur → destinataire) — vérifiée, y compris sous 10 envois simultanés.
- Page : bouton désactivé après le Like et pendant l'envoi (étape 2.1).
- **Faiblesse** : un 2ᵉ Like vers un profil déjà aimé (ex. depuis un 2ᵉ onglet pas encore
  rafraîchi) réécrivait la ligne existante et affichait « Like envoyé. » comme un nouveau
  Like. Sans doublon en base, mais trompeur, et gênant pour la détection des Matchs à
  venir (Phase 3) qui ne doit réagir qu'à un vrai nouveau Like.

## Réalisation

- `src/features/profiles/likes.functions.ts` : si un Like actif existe déjà, rien n'est
  écrit et la réponse indique `alreadyLiked: true` (sinon `false`) ;
- `src/routes/_authenticated/discover.tsx` : message « Vous aimez déjà ce profil. » et
  bouton passé à « Aimé ».

Un Like retiré ou un « Pass » peut toujours devenir un Like : la même ligne est réutilisée.
Aucun changement de base de données.

## Tests (`etape-2.3-likes-doublons.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Base : 2ᵉ Like direct refusé (409) ; « fusion » sans doublon ; 10 simultanés → 1 ligne | ✅ ×4 |
| Sens inverse (A → V) : Like distinct autorisé | ✅ |
| Deux onglets : 2ᵉ Like → « Vous aimez déjà ce profil. », bouton « Aimé », ligne d'origine intacte | ✅ ×6 |
| Appel serveur rejoué 5 fois en parallèle : « déjà aimé », 1 seule ligne | ✅ |
| Like retiré puis réaimé, « Pass » puis Like : même ligne | ✅ ×2 |
| Après rechargement : états corrects ; 1 ligne par profil ; aucune erreur JS ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
