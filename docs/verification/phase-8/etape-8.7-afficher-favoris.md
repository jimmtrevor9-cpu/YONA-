# Phase 8 — Étape 8.7 — Afficher les favoris

Date : 2026-09-27 · Statut : **VALIDÉE**

## Réalisation

- `src/features/favorites/queries.ts` : `myFavoritesQuery` renvoie les favoris de la
  personne connectée, les plus récents d'abord, avec pour chacun :
  - prénom, date de naissance, ville et pays ;
  - photo principale validée (lien temporaire) ;
  - Match actif éventuel.

  Tout passe par les règles d'accès existantes. Un favori dont le profil n'est plus
  visible (masqué, suspendu, bloqué) n'est pas affiché ; il est seulement compté.
- `src/routes/_authenticated/favoris.tsx` : liste dans le style de la page Matchs. Chaque
  carte montre :
  - la photo, ou l'initiale ;
  - le prénom et l'âge, la ville et le pays ;
  - « Ajouté le … » ;
  - le lien « Voir le profil » quand un Match existe ;
  - l'étoile pour retirer, avec disparition de la carte.

  La page affiche aussi le nombre de favoris visibles et « N favori(s) n'est / ne sont
  plus disponible(s) pour le moment. ».
- `src/features/favorites/labels.ts` : `unavailableFavoritesLabel`.

Aucune modification de la base de données. Aucune donnée fictive.

## Tests (`etape-8.7-afficher-favoris.mjs`) — 16/16

| Test | Résultat |
|---|---|
| 3 favoris visibles, les plus récents d'abord ; nombre | ✅ ×2 |
| Carte : prénom, âge, ville et pays ; date d'ajout ; initiale sans photo ; étoile pleine | ✅ ×4 |
| « Voir le profil » seulement avec un Match ; il ouvre le profil du Match | ✅ ×2 |
| Profils masqué ou bloquant non affichés et comptés « plus disponibles » ; favoris des autres non affichés | ✅ ×2 |
| Retrait depuis la page ; ajout depuis Découvrir, en tête de liste ; profil redevenu visible, qui réapparaît | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Problème rencontré

Premier passage : 15/16. La vérification « Voir le profil ouvre le profil du Match »
lisait l'étoile avant son affichage, qui suit de peu celui du profil. Le test attend
désormais l'étoile. Résultat : 16/16 sur 3 passages consécutifs.

## Non-régression

0.7 : 32/32 · 3.6 : 17/17 · 3.7 : 24/24 · 8.1 : 10/10 · 8.2 : 23/23 · 8.3 : 19/19 ·
8.4 : 17/17 · 8.5 : 13/13 · 8.6 : 14/14 · 8.7 : 16/16. Aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
