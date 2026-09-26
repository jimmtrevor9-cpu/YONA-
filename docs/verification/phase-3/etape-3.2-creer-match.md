# Phase 3 — Étape 3.2 — Créer le Match

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Table `matches` présente (paire ordonnée `user_1_id < user_2_id`, unique, statut
  `active` par défaut, suppression en cascade avec les comptes), lisible par ses deux
  participants ; **rien ne la remplissait**.
- Droits techniques trop larges : ajout / modification / suppression accordés par défaut
  aux membres (bloqués en pratique par les règles RLS : aucune donnée modifiable, mais
  sans refus explicite).

## Réalisation

`supabase/migrations/20260926200000_phase3_creer_match.sql` (+ miroir
`drizzle/migrations/0017_…`) :
- déclencheur `likes_create_match` (fonction `create_match_on_mutual_like`) : dès qu'un
  Like actif rencontre un Like actif en sens inverse, sans blocage, la base crée le Match
  — quel que soit le chemin (page, API, Pass changé en Like, Like réactivé) ;
- verrou transactionnel sur la paire : deux Likes croisés au même instant créent bien
  le Match ; `ON CONFLICT DO NOTHING` : un Match existant n'est ni dupliqué ni modifié
  (étape 3.3) ;
- droits d'écriture des membres sur `matches` retirés (lecture seule).

`src/features/profiles/likes.functions.ts` : `likeProfile` renvoie aussi `matchId`
(identifiant du Match) quand le Like est réciproque — pour l'affichage (étape 3.4).

Aucun changement visible. La conversation associée est l'étape 4.1. Test 3.1 mis à jour
(il vérifiait qu'aucun Match n'était encore créé).

## Tests (`etape-3.2-creer-match.mjs`) — 21/21

| Test | Résultat |
|---|---|
| Sens unique : aucun Match ; réciproque : Match actif, paire ordonnée, daté | ✅ ×3 |
| Pass ≠ Like ; Pass changé en Like → Match ; Like retiré puis réactivé → Match | ✅ ×4 |
| Blocage : aucun Match | ✅ |
| 10 paires de Likes croisés simultanés : 10 Matchs, aucun doublon | ✅ |
| Membre : ne peut ni créer, ni modifier, ni supprimer un Match (403) | ✅ ×2 |
| Visibilité : participants seulement | ✅ ×2 |
| Page : Match créé, identifiant renvoyé ; sans retour → aucun Match ; aucune erreur JS | ✅ ×4 |
| Persistance ; aucune conversation (étape 4.1) ; compte supprimé → Match supprimé ; nettoyage | ✅ ×4 |

## Non-régression

Base réinstallée à zéro (19 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 —
aucun compte ni fichier de test restant. (Test 2.3 : lecture de la réponse du serveur
rendue tolérante aux nouveaux champs, puis 18/18.)

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
