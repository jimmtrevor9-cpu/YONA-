# Phase 2 — Étape 2.7 — Ne plus afficher les profils déjà traités

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

La découverte (`discover_profiles`, étape 1.15) proposait encore, à chaque visite, les
profils déjà aimés ou passés par le membre (cahier des charges §5 : « respecter les
interactions déjà enregistrées »).

## Réalisation

`supabase/migrations/20260926170000_phase2_exclure_profils_traites.sql` (+ miroir
`drizzle/migrations/0014_…`) : `discover_profiles` exclut les profils pour lesquels le
membre a un Like ou un Pass **actif**. Seule cette condition est ajoutée ; le reste de la
fonction est identique.

- Un Like retiré (« withdrawn ») rend le profil de nouveau proposable.
- Les Likes / Pass **reçus** n'excluent rien (un membre qui vous a aimé reste proposé :
  c'est ce qui rendra le Match possible).
- La page Recherche (recherche explicite, Phase 11) n'est pas concernée.
- Pendant la visite, un profil aimé reste affiché en « Aimé » (retour visuel) ; il
  n'est plus proposé au prochain chargement.

Aucune modification de l'interface.

Tests des étapes 2.1 à 2.6 mis à jour : ils attendaient qu'un profil aimé ou passé
réapparaisse après rechargement. Les contrôles « 2ᵉ envoi » s'appuient désormais sur un
rejeu de l'appel serveur (comme depuis un onglet resté ouvert).

## Tests (`etape-2.7-profils-traites.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Profil aimé : affiché « Aimé » pendant la visite, absent après rechargement | ✅ ×2 |
| Profil passé : absent (page et serveur), y compris en nouvelle session | ✅ ×3 |
| Likes / Pass reçus : n'excluent pas ; autre membre non affecté ; Recherche inchangée | ✅ ×3 |
| Like retiré → de nouveau proposé ; profil masqué puis réaffiché → toujours exclu | ✅ ×2 |
| Limite appliquée après exclusion ; nouveau profil proposé | ✅ ×2 |
| Tout traité : liste vide sans erreur, message sur la page | ✅ ×2 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Base réinstallée à zéro (16 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé).
