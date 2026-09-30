# Phase 11 — Étape 11.6 — Filtre situation matrimoniale

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

La colonne `profiles.marital_status` existait. C'était un texte libre, sans contrainte,
et aucun écran ne la remplissait. Le filtre aurait donc toujours donné un résultat vide.

## Réalisation

- Migration `20260929020000_phase11_filtre_situation.sql` (drizzle `0061`) :
  - **contrainte `profiles_marital_status_check` :** valeurs `never_married`
    (célibataire, jamais marié·e), `divorced` (divorcé·e), `widowed` (veuf / veuve) ou
    vide (non précisée) ;
  - **`search_profiles`, filtre `marital_status` :** liste de 1 à 3 valeurs distinctes
    parmi celles-ci, sinon refus `invalid_filter`. Un profil « non précisée » ne
    correspond jamais au filtre.
- `src/features/profiles/facts.ts` (nouveau) : valeurs et libellés.
- `src/routes/_authenticated/profile.tsx` : champ « Situation matrimoniale » dans
  « Informations » (« Non précisée » par défaut).
- `src/features/profiles/personal-info.ts` : message clair si la base refuse une valeur.
- `src/features/search/filters.ts` et `src/routes/_authenticated/search.tsx` : champ
  « Situation matrimoniale » (« Indifférente » ou une situation).

## Tests (`etape-11.6-filtre-situation.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Base : valeur non prévue refusée, valeur prévue acceptée | ✅ ×2 |
| Recherche : une valeur, deux valeurs, les trois ; « non précisée » incluse sans filtre ; combinée au sexe et à l'âge | ✅ ×5 |
| Refus `invalid_filter` : valeur inconnue, texte, liste vide, doublon, nombre, nul | ✅ ×6 |
| Profil : valeur actuelle, choix proposés, changement enregistré | ✅ ×3 |
| Recherche (page) : « Divorcé·e » tient compte du changement ; « Indifférente » | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.9 : 23/23 · 1.10 : 11/11 · 11.1 : 26/26 · 11.2 : 18/18 ·
11.3 : 22/22 · 11.4 : 24/24 · 11.5 : 32/32 · 11.6 : 20/20. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 173
au total.
