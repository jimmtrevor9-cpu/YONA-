# Phase 2 — Étape 2.4 — Empêcher l'auto-Like

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

Protections déjà en place, vérifiées à chaque niveau :
- base : contrainte `likes_no_self` (s'applique à tous, y compris le serveur) ;
- règles d'accès : `likes_insert_own` (expéditeur ≠ destinataire) ; destinataire non
  modifiable (`likes_protect_parties`) ;
- fonction serveur `likeProfile` : refus « Vous ne pouvez pas liker votre propre profil. » ;
- découverte (`discover_profiles`) et recherche : son propre profil n'est jamais proposé.

**Faiblesse** : la fonction serveur comparait les identifiants comme du texte. Avec son
propre identifiant écrit en MAJUSCULES, le contrôle était contourné ; la base refusait
quand même (aucun auto-Like possible), mais le membre recevait un message vague et le
serveur renvoyait le détail technique de l'erreur de base de données.

## Réalisation

`src/features/profiles/likes.functions.ts` : identifiant du destinataire converti en forme
canonique (minuscules) avant tout contrôle. Profite aussi à l'étape 2.3 (un doublon écrit
en majuscules est reconnu comme « déjà aimé »).

Aucune modification de base de données ni d'interface.

## Tests (`etape-2.4-auto-like.mjs`) — 13/13

| Test | Résultat |
|---|---|
| API : auto-Like refusé (normal, MAJUSCULES, modification d'un Like existant) | ✅ ×3 |
| Base avec les droits du serveur : refusé par `likes_no_self` | ✅ |
| Découverte et recherche (serveur et pages) : son propre profil jamais proposé | ✅ ×4 |
| Fonction serveur : message clair, y compris en MAJUSCULES (échouait avant correction) | ✅ ×2 |
| Aucun auto-Like en base ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
