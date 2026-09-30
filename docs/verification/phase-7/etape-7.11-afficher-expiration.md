# Phase 7 — Étape 7.11 — Afficher l'expiration

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Le bandeau « Conversation débloquée » (7.8) n'indiquait pas jusqu'à quand. À la fin de
la période, l'écran ne changeait qu'après un rechargement, et rien n'expliquait
pourquoi l'offre de paiement revenait.

## Réalisation

- Migration `20260928100000_phase7_afficher_expiration.sql` (miroir
  `drizzle/migrations/0044_phase7_afficher_expiration.sql`) : `get_message_quota`
  renvoie aussi `last_unlock_expired_at` (fin du dernier déblocage terminé, quand aucun
  n'est en cours) ; droits inchangés.
- `src/features/messaging/quota.ts` : `formatUnlockDate` (« mercredi 30 septembre à
  19:51 », heure locale de la personne) et `formatRemaining` (« 2 j 23 h », « 1 h 30 min »,
  « 12 min », « moins d'1 min »).
- `src/components/UnlockedBanner.tsx` : « Jusqu'au … (encore …) », élément `time` avec la
  date exacte du serveur, temps restant mis à jour chaque minute ; à l'heure de fin, la
  page relit l'état auprès du serveur et bascule d'elle-même.
- `src/components/UnlockOffer.tsx` : après un déblocage terminé, « Le déblocage de cette
  conversation a expiré le … ».
- `src/routes/_authenticated/messages_.$conversationId.tsx` : branchements.
- `src/integrations/supabase/types.ts` : type mis à jour.

## Tests (`etape-7.11-afficher-expiration.mjs`) — 17/17

| Test | Résultat |
|---|---|
| « Jusqu'au … » à l'heure locale (Douala) ; « encore 2 j 23 h » ; date exacte dans l'élément time ; même date chez Grace | ✅ ×4 |
| « encore 1 h 30 min » ; « encore 12 min » | ✅ ×2 |
| Fin atteinte page ouverte : bascule sans recharger, « a expiré le … », champ refermé ; chez Grace après la tâche : plus de bandeau | ✅ ×5 |
| Serveur : date du dernier déblocage terminé ; conversation jamais débloquée : pas de mention ; nouveau déblocage : nouvelle date | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression — série complète (fin de phase 7)

Série complète, 71 séries (phases 0 à 7), toutes réussies, aucune vérification en échec :
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
6.10 : 16/16 · 7.1 : 12/12 · 7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 ·
7.6 : 21/21 · 7.7 : 17/17 · 7.8 : 19/19 · 7.9 : 18/18 · 7.10 : 16/16 · 7.11 : 17/17 — aucun compte ni fichier de test restant.
(Dont 5.5 : 16/16, en échec une seule fois à l'étape 7.10, non reproduit.)

Base réinstallée à zéro (46 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 112 (+1 dans le fichier généré `types.ts`).
