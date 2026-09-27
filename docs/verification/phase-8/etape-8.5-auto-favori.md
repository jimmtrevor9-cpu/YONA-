# Phase 8 — Étape 8.5 — Empêcher l'auto-favori

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Protections déjà en place, vérifiées à chaque niveau :
- **base :** contrainte `favorites_no_self`, qui s'applique à tous, y compris au serveur ;
- **règles d'accès :** `favorites_insert_own` (membre ≠ favori) ; modification retirée
  (étape 8.2) ;
- **découverte :** son propre profil n'est jamais proposé.

**Faiblesse :** en appelant la fonction serveur avec son propre identifiant, la base
refusait bien, mais le membre recevait « Ce profil n'est plus disponible. », un message
inexact.

## Réalisation

`favorites.functions.ts` : `addFavorite` refuse d'abord son propre identifiant, comparé
en minuscules, avec le message « Vous ne pouvez pas ajouter votre propre profil à vos
favoris. ». Aucune modification de la base de données ni de l'interface.

## Tests (`etape-8.5-auto-favori.mjs`) — 13/13

| Test | Résultat |
|---|---|
| Appels directs V → V (normal et MAJUSCULES) : refusés | ✅ ×2 |
| Droits complets : contrainte `favorites_no_self` (ajout et modification) | ✅ ×2 |
| Modifier un favori en auto-favori (membre) : refusé | ✅ |
| Découvrir : son propre profil jamais proposé ; ajout d'un autre profil toujours possible | ✅ ×2 |
| Fonction serveur avec son propre identifiant (normal et MAJUSCULES) : message clair, sans détail technique | ✅ ×3 |
| Aucune erreur JS ; aucun auto-favori en base ; nettoyage | ✅ ×3 |

## Non-régression

0.6 : 73/73 · 0.7 : 32/32 · 2.4 : 13/13 · 8.1 : 10/10 · 8.2 : 23/23 · 8.3 : 19/19 ·
8.4 : 17/17 · 8.5 : 13/13. Aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
