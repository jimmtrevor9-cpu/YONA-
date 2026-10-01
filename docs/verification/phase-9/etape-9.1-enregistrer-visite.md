# Phase 9 — Étape 9.1 — Enregistrer une visite

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

- La table `profile_visits` existait, avec la contrainte `profile_visits_no_self`.
  Aucune règle d'accès n'autorisait l'écriture directe, mais les droits d'écriture
  étaient encore accordés aux membres.
- La fonction `record_profile_visit` existait mais présentait trois défauts :
  - elle ignorait silencieusement les visiteurs non connectés ;
  - elle ne vérifiait ni la visibilité du profil visité ni le profil du visiteur ;
  - elle ne disait pas si la visite avait compté.
- Aucun écran n'enregistrait de visite.

## Réalisation

- Migration `20260928140000_phase9_enregistrer_visite.sql` (drizzle `0048`) :
  - droits INSERT/UPDATE/DELETE retirés aux membres sur `profile_visits` ;
  - `record_profile_visit(_visited_user_id)` renvoie `true` (enregistrée) ou `false`
    (ignorée). Un visiteur non connecté reçoit le refus `not_authenticated`. La visite
    est ignorée pour soi-même, un profil non visible ou suspendu, un blocage dans un sens
    ou l'autre, ou un visiteur qui ne peut pas consulter les profils. La règle existante
    « une visite par heure et par profil » est conservée ; elle est renforcée à
    l'étape 9.2. La date est fixée par le serveur.
- `src/features/monetization/quotas.ts` : `recordProfileVisit` renvoie ce résultat.
- `src/features/visits/useRecordProfileVisit.ts` (nouveau) : enregistre une visite quand
  un profil complet s'affiche, une fois par affichage. Un échec n'empêche jamais
  l'affichage.
- `src/routes/_authenticated/matches_.$matchId.tsx` : le profil complet d'un Match
  enregistre la visite. Les cartes de Découvrir n'en enregistrent pas.
- `src/integrations/supabase/types.ts` : type de retour mis à jour.

## Tests (`etape-9.1-enregistrer-visite.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Découvrir n'enregistre rien ; profil d'un Match : 1 visite, date serveur ; aucune erreur JS | ✅ ×4 |
| Fonction : visite valide `true` ; soi-même, masqué, suspendu, bloqué dans les deux sens, inexistant, propre profil suspendu → `false` ; visiteur refusé | ✅ ×9 |
| Écrire, modifier ou effacer une visite directement : refusé | ✅ ×3 |
| Le membre visité ne lit pas la table ; le visiteur lit ses propres visites | ✅ ×2 |
| Contrainte `profile_visits_no_self` avec les droits complets ; nettoyage | ✅ ×2 |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 3.4 : 17/17 · 3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 ·
8.1 : 10/10 · 8.2 : 23/23 · 8.3 : 19/19 · 8.7 : 16/16 · 9.1 : 20/20. Aucun compte
restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 116
au total.
