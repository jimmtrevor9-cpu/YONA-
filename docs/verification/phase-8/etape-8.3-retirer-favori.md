# Phase 8 — Étape 8.3 — Retirer le favori

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La règle d'accès `favorites_delete_own` permettait déjà à chacun de retirer ses propres
favoris et seulement les siens. Aucune base de données à modifier. Le clic sur une étoile
pleine affichait seulement « Le retrait des favoris arrive très bientôt. ».

## Réalisation

- `src/features/favorites/favorites.functions.ts` : fonction serveur `removeFavorite`
  (membre connecté, retire uniquement ses propres favoris ; retirer un profil qui n'est
  pas en favori ne fait rien). Le retrait reste possible si le profil est depuis masqué,
  suspendu ou bloqué.
- `src/features/favorites/useFavoriteToggle.ts` : l'étoile ajoute ou retire ; mise à
  jour immédiate, message « Retiré de vos favoris. », retour arrière en cas d'échec.

## Tests (`etape-8.3-retirer-favori.mjs`) — 19/19

| Test | Résultat |
|---|---|
| Découvrir : message, suppression en base, étoile vide « Ajouter … », favori d'un autre membre intact, autres favoris intacts, état conservé après rechargement | ✅ ×7 |
| Ajouter à nouveau puis retirer encore | ✅ ×2 |
| Profil d'un Match : retrait et bouton « Ajouter … » | ✅ ×2 |
| Appels directs : un autre membre ne retire rien ; visiteur refusé ; retrait d'un profil masqué ou d'un membre bloquant possible ; retrait d'un non-favori sans effet | ✅ ×5 |
| Aucune erreur JS ; favoris finaux exacts ; nettoyage | ✅ ×3 |

## Non-régression

Phases 0, 1.14, 1.15, 2, 3, 8 :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 ·
2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 ·
2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 · 3.5 : 14/14 ·
3.6 : 17/17 · 3.7 : 24/24 · 8.1 : 10/10 · 8.2 : 23/23 · 8.3 : 19/19 — aucun compte ni
fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
