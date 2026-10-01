# Phase 8 — Étape 8.8 — Permettre à Premium de voir qui l'a mis en favori

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

`get_favorited_by()` existait déjà. Elle ne renvoyait qu'un identifiant et une date, sans
vérifier que le membre qui a mis le favori était encore visible. Aucun écran ne
l'utilisait.

## Réalisation

- Migration `20260928120000_phase8_qui_ma_favorise.sql` (drizzle `0046`) :
  `get_favorited_by()` renvoie le prénom, la date de naissance, la ville, le pays et la
  date d'ajout, les plus récents d'abord. Conditions :
  - abonnement Premium actif (`is_premium`) ;
  - personne connectée autorisée à consulter les profils ;
  - profil du membre visible et actif ;
  - aucun blocage.

  Aucune autre donnée n'est renvoyée, et les visiteurs non connectés sont refusés.
- `src/features/favorites/queries.ts` : `favoritedByQuery` (statut Premium lu en base,
  liste et photos principales validées).
- `src/components/FavoriteMemberCard.tsx` (nouveau) : carte commune aux deux listes de la
  page Favoris. Elle reprend le style existant.
- `src/routes/_authenticated/favoris.tsx` : section « Ils vous ont mis en favori » pour
  les membres Premium. Elle contient :
  - le nombre de membres ;
  - « Vous a ajouté le … » ;
  - l'étoile pour ajouter en retour ;
  - l'état vide « Personne ne vous a encore mis en favori. ».
- `src/features/favorites/labels.ts` : `favoritedByCountLabel`.
- `src/integrations/supabase/types.ts` : type de retour mis à jour.

Pour un membre gratuit, la fonction ne renvoie rien et la section n'est pas affichée. Le
refus explicite et l'écran « réservé Premium » sont l'étape 8.9.

## Tests (`etape-8.8-qui-ma-favorise.mjs`) — 17/17

| Test | Résultat |
|---|---|
| Base : Premium (3 membres, ordre, données limitées) ; masqué et bloqué exclus ; gratuit sans donnée ; visiteur refusé | ✅ ×5 |
| Page Premium : section, nombre, carte (âge, ville, date), exclusions, ajout en retour | ✅ ×5 |
| Premium sans favori reçu : état vide ; gratuit : aucune liste | ✅ ×2 |
| Premium expiré : plus de données, liste retirée | ✅ ×2 |
| 320 px ; aucune erreur JS ; nettoyage (comptes, abonnements, favoris) | ✅ ×3 |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 8.1 : 10/10 · 8.2 : 23/23 · 8.3 : 19/19 · 8.4 : 17/17 ·
8.5 : 13/13 · 8.6 : 14/14 · 8.7 : 16/16 · 8.8 : 17/17. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé). Le
total passe de 1 112 à 1 116 : ce sont 4 remarques de mise en forme dans le fichier
généré `types.ts`, où 4 lignes ont été ajoutées.
