# Phase 10 — Étape 10.3 — Déterminer le statut en ligne

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

`get_presence` existait (seuils : 5 min, 24 h, 7 jours), avec plusieurs défauts :
- elle ignorait la déconnexion : un membre restait « en ligne » jusqu'à 5 minutes après
  être parti ;
- elle donnait le statut de profils masqués, suspendus ou de membres qui nous ont
  bloqués (seul le blocage était vérifié, et dans un seul cas) ;
- elle renvoyait une valeur vide, et non une erreur, aux visiteurs non connectés.

## Règle retenue (serveur, `get_presence`)

| Statut | Condition |
|---|---|
| `online` — « En ligne » | connecté (pas de déconnexion depuis) et actif il y a moins de 3 minutes (l'application signale l'activité chaque minute) |
| `recent` — « Actif récemment » | actif dans les dernières 24 heures |
| `this_week` — « Actif cette semaine » | actif dans les 7 derniers jours |
| `inactive` — « Actif il y a plusieurs jours » | au-delà |
| `unknown` | aucune activité connue, ou statut non consultable |

Aucun horodatage exact n'est jamais transmis. Le statut d'un autre membre n'est
consultable que si trois conditions sont réunies :
- son profil est visible et actif ;
- il n'y a aucun blocage ;
- la personne connectée peut consulter les profils.

Sinon, le statut est `unknown`.

## Réalisation

- Migration `20260928200000_phase10_statut_en_ligne.sql` (drizzle `0054`) :
  - `get_presence` suit la règle ci-dessus ;
  - nouvelle fonction `mark_offline()`, réservée au membre connecté, qui retire le
    statut « en ligne » sans effacer la dernière activité.
- `src/features/auth/useSignOut.ts` : à la déconnexion, `markOffline` est appelé. Un
  échec ne bloque jamais la déconnexion.
- `src/features/activity/presence.ts` : `getPresence` signale les erreurs et documente la
  règle ; ajout de `markOffline`.
- `src/integrations/supabase/types.ts` : ajout de `mark_offline`.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 49 fonctions.

## Tests (`etape-10.3-statut-en-ligne.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Règle : 1 min et 2 min 50 → online ; 4 min, déconnectée, 23 h → recent ; 2 j → this_week ; 10 j → inactive ; aucune activité → unknown ; pas d'horodatage | ✅ ×9 |
| Masqué, bloquant, compte suspendu → unknown ; son propre statut ; visiteur refusé (2 fonctions) | ✅ ×6 |
| Connexion → online ; déconnexion → recent (activité conservée) ; reconnexion → online ; aucune erreur JS ; nettoyage | ✅ ×5 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.3 : 16/16 · 1.4 : 14/14 · 10.1 : 15/15 ·
10.2 : 12/12 · 10.3 : 20/20. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 122
au total (+1 ligne de type dans le fichier généré).
