# Phase 3 — Étape 3.3 — Empêcher les Matchs en double

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

Déjà en place (étape 3.2), vérifié ici :
- contrainte d'unicité `matches_user_1_id_user_2_id_key` et paire ordonnée
  `matches_ordered_pair` (user_1_id < user_2_id) : (A, B) et (B, A) ne peuvent pas
  coexister, pas de Match avec soi-même — même avec les droits du serveur ;
- création uniquement par le déclencheur, avec verrou sur la paire ; membres en lecture
  seule.

**Cas non couvert** : un Match défait (statut `unmatched`) restait défait si les deux
membres s'aimaient de nouveau (`ON CONFLICT DO NOTHING`).

## Réalisation

`supabase/migrations/20260926210000_phase3_matchs_doublons.sql` (+ miroir
`drizzle/migrations/0018_…`) : seule la fonction `create_match_on_mutual_like` change —
en cas de Like réciproque sur une paire déjà liée, le **même** Match est réactivé s'il
était `unmatched` (aucune nouvelle ligne) ; un Match `blocked` n'est jamais réactivé
automatiquement ; un Match actif n'est pas modifié (même identifiant, même date).

Aucune modification de l'interface ni du serveur applicatif.

## Tests (`etape-3.3-matchs-doublons.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Like renvoyé, retiré / remis (un ou deux côtés), Pass puis Like : 1 Match inchangé | ✅ ×5 |
| Base : 2ᵉ Match même paire, ordre inversé, soi-même → refusés | ✅ ×3 |
| Match défait puis Likes réciproques : même Match réactivé ; Match bloqué : jamais réactivé | ✅ ×2 |
| 20 retraits / remises simultanés ; Likes croisés en double simultanés : 1 Match | ✅ ×2 |
| Serveur : Like rejoué 5 fois en parallèle → même identifiant de Match | ✅ |
| Aucune paire en double dans la table ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Base réinstallée à zéro (20 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 ·
3.2 : 21/21 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
