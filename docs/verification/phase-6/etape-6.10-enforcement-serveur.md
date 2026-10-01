# Phase 6 — Étape 6.10 — Garantir l'enforcement serveur

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat (analyse des chemins d'écriture d'un message)

- Membres : aucun droit d'écriture directe sur `messages` (4.8) ; seul chemin, la
  fonction serveur `send_message`, qui refuse les numéros (6.7).
- Serveur de l'application (`sendMessage`) : appelle `send_message` ; ne peut rien
  contourner.
- Rôle service, administration, code futur : bloqués par le déclencheur de la table
  (6.8).
- Détecteur `contains_phone_number` : réservé au serveur.
- Restait : aucune règle de la table elle-même n'exprimait l'interdiction, et un ancien
  détecteur côté application (`src/features/moderation/message-pipeline.ts`, plus
  faible, jamais utilisé) pouvait donner l'illusion d'une protection côté navigateur.

## Réalisation

- Migration `20260928020000_phase6_enforcement_serveur.sql` (miroir
  `drizzle/migrations/0036_phase6_enforcement_serveur.sql`) : règle
  `messages_no_phone_number_delivered` — un message ne peut pas être à la fois
  « délivré » et marqué comme contenant un numéro (indicateur calculé par le serveur).
- Fichier supprimé : `src/features/moderation/message-pipeline.ts` (inutilisé ; la seule
  autorité est le serveur).

## Tests (`etape-6.10-enforcement-serveur.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Membre : création et modification directes refusées (403) ; fonction d'envoi appelée directement : 4 formes refusées ; serveur de l'application appelé directement : 4 formes refusées avec l'explication ; interface : refus expliqué | ✅ ×5 |
| Rôle service : refusé ; administrateur de la base : création et modification refusées | ✅ ×3 |
| Règle de la table : impossible même déclencheur coupé ; déclencheur et règle actifs | ✅ ×2 |
| Détecteur non appelable par un membre ; ancien détecteur côté application supprimé | ✅ ×2 |
| Aucun message délivré avec numéro dans toute la base ; seuls les messages ordinaires enregistrés | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression — série complète (fin de phase 6)

Série complète, 60 séries (phases 0 à 6), toutes réussies :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 ·
1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 ·
2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 ·
3.4 : 17/17 · 3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 ·
4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 ·
4.9 : 22/22 · 4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 ·
5.5 : 16/16 · 5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 ·
6.4 : 5/5 · 6.5 : 5/5 · 6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 ·
6.10 : 16/16 — aucun compte ni fichier de test restant.

Base réinstallée à zéro (38 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 096 (−2 : les deux remarques de formatage du fichier supprimé).
