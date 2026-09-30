# Phase 6 — Étape 6.8 — Empêcher le stockage

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 6.7, `send_message` refuse les messages avec numéro. Mais la table
`messages` elle-même acceptait encore un tel message par un autre chemin (rôle service,
administration, code futur), l'indicateur `contains_phone_number` pouvait être fourni
librement, et d'éventuels messages enregistrés avant la phase 6 restaient délivrés.

## Réalisation

- Migration `20260928010000_phase6_empecher_stockage.sql` (miroir
  `drizzle/migrations/0035_phase6_empecher_stockage.sql`) :
  - déclencheur `messages_block_phone_numbers` (avant création ou modification du
    contenu, du statut ou de l'indicateur) : l'indicateur est toujours recalculé par le
    serveur ; un message avec numéro ne peut jamais être délivré (création, modification
    du contenu, passage au statut « délivré ») — erreur `phone_number_detected`, pour
    tous les rôles, y compris le service et l'administrateur de la base ;
  - rattrapage des messages existants : ceux qui contiennent un numéro passent au statut
    « bloqué » (motif `phone_number_detected`, modération « rejeté ») ; l'autre personne
    ne les voit plus, leur auteur les voit marqués « Non envoyé : bloqué par la
    modération » (affichage de l'étape 4.5).
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 43 fonctions.

## Tests (`etape-6.8-empecher-stockage.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Écriture directe (administrateur de la base, rôle service) : refusée | ✅ ×2 |
| Indicateur calculé par le serveur ; modification vers un numéro refusée ; message « bloqué » accepté avec indicateur vrai ; passage à « délivré » refusé ; modification ordinaire possible | ✅ ×5 |
| Ancien message avec numéro (simulé) : rattrapé en « bloqué / rejeté / phone_number_detected » ; ancien message sans numéro inchangé | ✅ ×3 |
| L'autre personne ne le voit plus (API, application, aperçu de la liste) ; l'auteur le voit « Non envoyé » | ✅ ×4 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

Premier passage : 16/16 ; une vérification jugée trop faible (aperçu vérifié sur la page
Découvrir au lieu de la liste des conversations) a été corrigée.

## Non-régression

Séries touchant la base et la messagerie (phases 0, 4, 5, 6) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 — aucun compte ni fichier de test restant.
(Phases 1 à 3 n'écrivent pas de messages ; série complète prévue en fin de phase 6.)

Base réinstallée à zéro (37 migrations). Type-check : 0 erreur · Build : réussi (aucun
changement de code applicatif) · Lint : 1 098 (inchangé).
