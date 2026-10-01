# Phase 9 — Étape 9.2 — Limiter les visites répétées

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

`record_profile_visit` ignorait déjà une 2ᵉ visite du même profil dans l'heure, avec
deux limites :
- **appels simultanés :** la vérification puis l'enregistrement n'étaient pas protégés.
  Plusieurs appels en même temps pouvaient donc tous passer la vérification et créer
  des doublons ;
- **aucune limite globale :** un compte pouvait « visiter » tous les membres toutes les
  heures et remplir leurs listes de visiteurs.

## Réalisation

Migration `20260928150000_phase9_limiter_visites.sql` (drizzle `0049`) :
- **verrou par couple visiteur → visité** (`pg_advisory_xact_lock`) : les appels
  simultanés sont traités l'un après l'autre. Il y a toujours une seule visite par
  heure et par profil ;
- **limite globale :** au plus 100 visites enregistrées par visiteur sur 24 heures
  glissantes. Au-delà, les visites sont ignorées sans erreur ;
- **index** `profile_visits_pair_recent_idx` pour ces vérifications.

Aucune modification de l'interface.

## Tests (`etape-9.2-limiter-visites.mjs`) — 13/13

| Test | Résultat |
|---|---|
| 1re visite enregistrée ; répétée dans l'heure : ignorée | ✅ ×2 |
| 20 appels simultanés : 1 seul enregistré, 1 ligne | ✅ |
| Autre profil ; sens inverse ; après plus d'une heure : enregistrés | ✅ ×3 |
| Profil d'un Match ouvert 3 fois : 1 visite ; aucune erreur JS | ✅ ×2 |
| 100e visite sur 24 h enregistrée, 101e ignorée ; autres visiteurs non touchés ; après 24 h : de nouveau possible | ✅ ×4 |
| Nettoyage | ✅ |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 3.7 : 24/24 · 9.1 : 20/20 · 9.2 : 13/13. Aucun compte
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 116
au total.
