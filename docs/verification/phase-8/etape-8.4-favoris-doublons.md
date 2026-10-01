# Phase 8 — Étape 8.4 — Empêcher les doublons

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

- Base : contrainte d'unicité `favorites_user_id_favorite_user_id_key` (un seul favori
  par couple). Elle a été vérifiée, y compris avec 10 envois simultanés.
- **Faiblesse :** un 2ᵉ ajout vers un profil déjà en favori (par exemple depuis un
  2ᵉ onglet pas encore à jour) finissait en message d'erreur « n'a pas pu être
  enregistré ». Un retrait en double affichait « Retiré » alors que rien n'était retiré.

## Réalisation

- `favorites.functions.ts` :
  - `addFavorite` répond `alreadyFavorite: true` si le favori existe déjà ; rien n'est
    réécrit et la date d'origine est conservée ;
  - `removeFavorite` répond `wasFavorite` selon qu'une ligne a été retirée ou non.
- `useFavoriteToggle.ts` : messages « Ce profil est déjà dans vos favoris. » et « Ce
  profil n'était déjà plus dans vos favoris. », puis l'étoile reprend l'état réel.

Aucune modification de la base de données.

## Tests (`etape-8.4-favoris-doublons.mjs`) — 17/17

| Test | Résultat |
|---|---|
| Base : 2ᵉ favori direct refusé (409) ; 10 envois simultanés, 1 seule ligne ; sens inverse autorisé | ✅ ×4 |
| Deux onglets, ajout : message « déjà dans vos favoris », étoile pleine, 1 ligne, date d'origine inchangée | ✅ ×5 |
| Appel serveur rejoué 5 fois en parallèle : sans erreur, 1 ligne | ✅ |
| Deux onglets, retrait : message « n'était déjà plus », étoile vide | ✅ ×3 |
| 6 clics rapides : au plus 1 ligne, étoile conforme à la base | ✅ |
| Aucune erreur JS ; au plus 1 favori par couple ; nettoyage | ✅ ×3 |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 2.5 : 19/19 · 3.7 : 24/24 · 8.1 : 10/10 · 8.2 : 23/23 ·
8.3 : 19/19 · 8.4 : 17/17. Aucun compte ni fichier de test restant. Seuls les favoris
sont concernés ; la série complète est prévue en fin de phase 8.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
