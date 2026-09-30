# Phase 2 — Étape 2.8 — Respecter les blocages dans la découverte

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

Les blocages sont déjà appliqués **dans les deux sens** par le serveur :
- lecture des profils, profils chrétiens, photos et fichiers (`is_blocked_between`,
  étapes 0.6 / 1.15) → découverte (`discover_profiles`) et recherche ;
- écriture des Likes et Pass (`likes_insert_own`, étape 2.2) ;
- blocage privé : seul son auteur le voit et peut le lever ; impossible au nom d'un
  autre ou envers soi-même.

Il n'existe pas encore de bouton « Bloquer » (Phase 21) : les tests créent les blocages
via l'API avec les droits du membre, comme le fera ce bouton.

**Problème** : la règle `likes_update_own` refusait toute modification d'un Like entre
membres bloqués, y compris le **retrait** de son propre Like (vérifié : HTTP 403 avant
correction).

## Réalisation

`supabase/migrations/20260926180000_phase2_blocages_decouverte.sql` (+ miroir
`drizzle/migrations/0015_…`) : retirer son Like est toujours permis ; le réactiver ou le
changer en Pass reste interdit tant qu'un blocage existe.

Aucune modification de l'interface : si un blocage survient pendant la visite, le Like ou
le Pass est refusé avec « Ce profil n'est plus disponible. » et la carte disparaît
(comportement des étapes 2.1 / 2.6, vérifié ici).

## Tests (`etape-2.8-blocages-decouverte.mjs`) — 29/29

| Test | Résultat |
|---|---|
| Blocage : exclu de la découverte dans les deux sens ; profil, foi, photos illisibles | ✅ ×5 |
| Tiers non affecté ; recherche respecte le blocage | ✅ ×2 |
| Like / Pass entre bloqués refusés (deux sens) | ✅ ×3 |
| Confidentialité : invisible pour le bloqué, non supprimable par lui ; pas au nom d'un autre ; pas soi-même | ✅ ×5 |
| Like existant puis blocage : retrait permis (échouait avant), réactivation / Pass refusés | ✅ ×3 |
| Pages : cartes absentes des deux côtés ; blocage pendant la visite (Like, Pass) | ✅ ×6 |
| Déblocage : profils de nouveau proposés (deux sens) | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Base réinstallée à zéro (17 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 — aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
