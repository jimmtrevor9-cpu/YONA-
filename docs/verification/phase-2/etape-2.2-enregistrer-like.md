# Phase 2 — Étape 2.2 — Enregistrer le Like

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Le Like est enregistré par la fonction serveur `likeProfile`
  (`src/features/profiles/likes.functions.ts`) : expéditeur tiré de la session, profil
  visé vérifié, écriture dans `likes` (une ligne par couple expéditeur/destinataire).
- Protections déjà en place : expéditeur = membre connecté, pas d'auto-Like, pas de Like
  entre membres bloqués, destinataire non modifiable (étape 0.6).
- **Failles** en écriture directe (API, sans passer par le site) — la base acceptait :
  1. un Like vers un profil masqué, suspendu, non finalisé ou un compte suspendu ;
  2. un Like d'un membre qui n'a pas le droit de parcourir les profils (étape 1.15) ;
  3. une date de Like choisie par le membre.

## Réalisation

`supabase/migrations/20260926160000_phase2_enregistrer_like.sql` (+ miroir
`drizzle/migrations/0013_…`) :
- règle `likes_insert_own` : expéditeur éligible (`can_browse_profiles`) et destinataire
  proposable (`is_discoverable_profile`) ;
- règle `likes_update_own` : même contrôle pour réactiver un Like ; retirer son Like
  (« withdrawn ») reste toujours possible ;
- déclencheur `likes_set_created_at` : date fixée par le serveur, non modifiable ensuite.

Aucune modification de l'interface.

## Tests (`etape-2.2-enregistrer-like.mjs`) — 25/25

| Test | Résultat |
|---|---|
| Like enregistré : type, statut, date du serveur | ✅ ×2 |
| Date falsifiée à la création ou modifiée ensuite : ignorée | ✅ ×2 |
| Refus : au nom d'un autre, soi-même, profil masqué / suspendu / compte suspendu / non finalisé, bloqué | ✅ ×7 |
| Refus : expéditeur non finalisé, visiteur non connecté | ✅ ×2 |
| Redirection d'un Like refusée ; retrait possible, réactivation seulement si visible | ✅ ×4 |
| Confidentialité : l'expéditeur voit ses Likes, le destinataire et les tiers non | ✅ ×3 |
| Par la page : Like enregistré au nom du membre connecté, conservé en nouvelle session | ✅ ×2 |
| Aucune erreur JavaScript ; compte supprimé → Likes supprimés ; nettoyage | ✅ ×3 |

## Non-régression

Base réinstallée à zéro (15 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 — aucun compte ni fichier de
test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
