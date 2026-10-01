# Phase 5 — Étape 5.7 — Garantir l'indépendance des quotas

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat (analyse)

- Un compteur par personne et par conversation (`conversation_user_usage`, clé unique
  conversation + personne), créé à 0 au Match (5.1), modifié uniquement par
  `send_message` sur la ligne de l'expéditeur (5.2 / 5.5), lu uniquement par son
  propriétaire (5.1, 5.6).
- Aucune écriture directe possible par les membres ; l'ancienne fonction qui modifiait
  le compteur est fermée aux membres (5.1).
- La colonne `conversations.free_messages_used` (ancien compteur partagé par les deux
  participants) n'est ni lue ni modifiée par le code actif : elle ne peut pas influencer
  les quotas. Elle est conservée pour ne pas casser les données existantes.
- Aucune modification du code ni de la base n'est nécessaire : l'étape consiste à
  vérifier l'indépendance dans toutes les situations.

## Réalisation

- Aucune modification du code, de la base ni de l'interface.
- `docs/verification/phase-5/etape-5.7-independance-quotas.mjs` : test d'indépendance.

## Tests (`etape-5.7-independance-quotas.mjs`) — 22/22

| Test | Résultat |
|---|---|
| Deux participants : chacun ses 3 messages ; le blocage de l'un ne limite pas l'autre ; chaque 4e refusé | ✅ ×6 |
| Conversations séparées ; nouveau Match : nouveau compteur à 0 | ✅ ×4 |
| Les deux participants écrivent en même temps : 3 + 3 acceptés, puis chaque 4e refusé | ✅ ×2 |
| Match refait, blocage / déblocage, profil masqué / visible, messages supprimés, compte d'un autre supprimé : aucun effet ; ancien compteur partagé jamais modifié | ✅ ×5 |
| Affichage par conversation ; l'autre personne voit son propre décompte ; quota d'une autre conversation illisible | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

Première exécution : 21/22 — erreur du test (la comparaison incluait la conversation
avec la personne dont le compte est supprimé, qui disparaît normalement) ; corrigée.

## Non-régression — série complète (fin de phase 5)

Série complète, 50 séries (phases 0 à 5), toutes réussies :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 ·
1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 ·
2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 ·
3.4 : 17/17 · 3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 ·
4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 ·
4.9 : 22/22 · 4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 ·
5.5 : 16/16 · 5.6 : 18/18 · 5.7 : 22/22 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 098 (inchangé).
