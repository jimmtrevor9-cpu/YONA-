# Phase 11 — Étape 11.1 — Filtre âge

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

La page Recherche interrogeait directement la table des profils depuis le navigateur,
avec deux filtres (ville et genre). Il n'y avait ni filtre d'âge ni validation côté
serveur.

## Réalisation

- Migration `20260928220000_phase11_filtre_age.sql` (drizzle `0056`) : nouvelle
  recherche serveur `search_profiles(_filters, _limit)`, qui servira à tous les filtres
  de la phase 11.
  - **Qui peut chercher :** un membre connecté ; un visiteur non connecté reçoit le
    refus `not_authenticated`. Si la personne ne peut pas consulter les profils, elle
    n'obtient aucun résultat.
  - **Profils renvoyés :** profils visibles et actifs uniquement, jamais soi-même, aucun
    blocage. 50 résultats au plus.
  - **Validation des filtres :** tous les filtres sont vérifiés par le serveur. Une clé
    inconnue ou une valeur invalide donne le refus `invalid_filter`.
  - **Filtre âge :** `min_age` et `max_age` sont des entiers de 18 à 99, avec minimum ≤
    maximum. L'âge est calculé depuis la date de naissance. Un profil sans date de
    naissance est exclu dès qu'un âge est demandé.
  - **Genre et ville :** les filtres existants de la page sont repris tels quels. Ils
    seront renforcés aux étapes 11.2 et 11.4.
- `src/features/search/filters.ts` (nouveau) : conversion et vérification du formulaire,
  avec des messages clairs.
- `src/features/search/queries.ts` (nouveau) : `searchProfilesQuery`.
- `src/routes/_authenticated/search.tsx` : champs « Âge — De (ans) / À (ans) » et message
  d'erreur. Les résultats passent désormais par le serveur.
- `src/features/profiles/discovery.ts` : l'ancienne recherche faite depuis le navigateur,
  devenue inutilisée, a été retirée.
- `src/integrations/supabase/types.ts` : ajout de `search_profiles`.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 50 fonctions.

## Tests (`etape-11.1-filtre-age.mjs`) — 26/26

| Test | Résultat |
|---|---|
| Sans filtre : bons profils (ni soi-même, ni masqué, ni bloquant) | ✅ |
| Tranches 25–50, ≥ 26, ≤ 49, exactement 30, 70–99 (vide) ; bornes incluses (25 ans aujourd'hui, 50 ans veille des 51) ; sans date de naissance exclu | ✅ ×6 |
| Refus `invalid_filter` : 17, 100, min > max, texte, décimal, négatif, filtre inconnu | ✅ ×7 |
| Visiteur refusé ; mon profil suspendu : aucun résultat | ✅ ×2 |
| Page : champs, résultats 25–50, âges affichés dans la tranche, messages d'erreur, champs vidés, aucun résultat | ✅ ×7 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.7 : 26/26 · 1.15 : 31/31 · 2.7 : 16/16 (recherche
explicite) · 2.8 : 29/29 · 11.1 : 26/26. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé). Le
total passe à 1 133 à cause des remarques de mise en forme dans le fichier généré
`types.ts`.
