# Phase 7 — Étape 7.1 — Détecter le quota épuisé

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Le quota de 3 messages gratuits est appliqué par le serveur (phase 5) et
`get_message_quota` renvoie les messages utilisés et restants. Aucun signal explicite
« quota épuisé » n'existait pour déclencher l'offre de déblocage. Tables `payments` et
`conversation_unlocks` présentes (utilisées aux étapes 7.5 à 7.10).

## Réalisation

- Migration `20260928030000_phase7_detecter_quota_epuise.sql` (miroir
  `drizzle/migrations/0037_phase7_detecter_quota_epuise.sql`) : `get_message_quota`
  renvoie en plus `exhausted` (vrai quand les 3 messages gratuits sont utilisés), calculé
  par le serveur, pour la personne connectée seulement ; droits inchangés (participants
  connectés).
- `src/features/messaging/quota.ts` : le quota lu par l'application contient `exhausted`.
- `src/integrations/supabase/types.ts` : type mis à jour.

Aucun changement visible (l'offre de déblocage est l'étape 7.2).

## Tests (`etape-7.1-quota-epuise.mjs`) — 12/12

| Test | Résultat |
|---|---|
| 0, 1, 2 messages : non épuisé ; 3 : épuisé ; cohérent avec le refus d'envoi | ✅ ×3 |
| Autre participante et autre conversation : non épuisées ; tiers et visiteur refusés | ✅ ×4 |
| Persistant ; l'application reçoit le signal ; écran fermé à 0 | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Séries utilisant le quota et contrôles de la base : 0.6 : 73/73 · 0.7 : 32/32 ·
5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 · 5.6 : 18/18 ·
5.7 : 22/22 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 097 (+1 dans le fichier généré
`types.ts`, format sans point-virgule conservé).
