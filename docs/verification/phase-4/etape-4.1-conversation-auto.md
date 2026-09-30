# Phase 4 — Étape 4.1 — Créer automatiquement la conversation après Match

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Table `conversations` présente : une conversation par Match (`match_id` unique), même
  paire ordonnée, statut `open` / `locked` / `closed`, compteur de messages gratuits,
  lecture réservée aux deux participants ; **rien ne la créait**.
- Droits d'écriture accordés par défaut aux membres (ajout / modification / suppression),
  bloqués en pratique par les règles RLS, mais plus larges que nécessaire.

## Réalisation

`supabase/migrations/20260926220000_phase4_conversation_auto.sql` (+ miroir
`drizzle/migrations/0019_…`) :
- déclencheur `matches_create_conversation` (fonction `create_conversation_for_match`) :
  dès qu'un Match devient actif (création ou réactivation), sa conversation est créée
  si elle n'existe pas ; une conversation `closed` est rouverte à la réactivation ;
  `locked` n'est pas modifiée ; un Match `blocked` ne crée rien ;
- rattrapage : les Matchs actifs déjà existants reçoivent leur conversation (migration
  rejouable, sans doublon) ;
- droits d'écriture des membres sur `conversations` retirés (lecture seule).

`docs/CONNECTER_UNE_BASE_SUPABASE.md` : 36 fonctions attendues (correction : la fonction
du Match de l'étape 3.2 n'y avait pas été comptée). Test 3.2 mis à jour (il vérifiait
qu'aucune conversation n'existait encore).

Aucun changement visible : la messagerie s'affiche à partir de l'étape 4.2.

## Tests (`etape-4.1-conversation-auto.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Match depuis la page → conversation ouverte, vide, même couple, datée ; sans retour → rien | ✅ ×5 |
| Participants seulement ; membre : création / modification / suppression refusées (403) | ✅ ×2 |
| 10 Matchs simultanés → 10 conversations | ✅ |
| Réactivation → même conversation rouverte ; « verrouillée » inchangée ; Match bloqué → rien | ✅ ×4 |
| Rattrapage des Matchs anciens (migration rejouée, sans doublon) ; 1 conversation par Match actif | ✅ ×3 |
| Compte supprimé → conversation supprimée ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Base réinstallée à zéro (21 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 ·
3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 · 3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 —
aucun compte ni fichier de test restant.

Premier passage : la préparation du test 0.6 (et de `etape-0.1-backend-sql-tests.sql`)
créait à la main la conversation d'un Match, désormais créée par la base → doublon refusé ;
préparation adaptée (`on conflict (match_id)`), puis 0.6 : 73/73 et 0.7 : 32/32 sur base
propre. Le test 2.3 a eu un échec isolé (« Total : 6 lignes ») lors de ce même passage,
non reproduit ensuite (3 exécutions réussies d'affilée sur base propre).

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
