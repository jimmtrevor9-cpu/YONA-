# Phase 8 — Étape 8.2 — Enregistrer le favori

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La table `favorites` acceptait déjà l'ajout direct par un membre connecté (pour lui-même,
pas de soi-même, pas en cas de blocage). Il manquait trois règles serveur : le profil
ajouté devait être visible et actif, le compte de la personne devait être actif, et la
date d'ajout pouvait être choisie par le client. La modification d'un favori existant
était aussi permise. Le bouton étoile n'enregistrait rien.

## Réalisation

- Migration `20260928110000_phase8_enregistrer_favori.sql` (drizzle `0045`) :
  - règle d'ajout renforcée (`can_browse_profiles` et `is_discoverable_profile`) ;
  - date d'ajout fixée par le serveur (déclencheur `favorites_set_created_at`) ;
  - droit de modification retiré.
- `src/features/favorites/favorites.functions.ts` (nouveau) : fonction serveur
  `addFavorite` (membre connecté, identifiant vérifié et mis en minuscules) et message
  « Ce profil n'est plus disponible. » en cas de refus.
- `src/features/favorites/useFavoriteToggle.ts` (nouveau) : l'étoile se remplit tout de
  suite, message « Ajouté à vos favoris. », retour à l'état précédent si le serveur
  refuse.
- `discover.tsx`, `matches_.$matchId.tsx` : le message d'attente est remplacé par
  l'enregistrement réel.
- Test 8.1 adapté : le clic enregistre désormais.

## Tests (`etape-8.2-enregistrer-favori.mjs`) — 23/23

| Test | Résultat |
|---|---|
| Découvrir : message, enregistrement en base, étoile pleine « Retirer … », date serveur, profil toujours affiché (pas un like), état conservé après rechargement | ✅ ×6 |
| Profil masqué entre l'affichage et le clic : message « plus disponible », rien enregistré, étoile vide | ✅ ×2 |
| Profil d'un Match : enregistrement et bouton « Retirer … » | ✅ ×2 |
| Appels directs : valide accepté ; au nom d'un autre, visiteur, profil masqué, suspendu, membre bloquant, propre profil suspendu, modification — refusés ; date client ignorée | ✅ ×10 |
| Aucune erreur JS ; favoris finaux exacts ; nettoyage | ✅ ×3 |

## Non-régression

Séries touchant la découverte, les Likes, les Matchs et les favoris (phases 0, 1.14,
1.15, 2, 3, 8) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 ·
2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 ·
2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 · 3.5 : 14/14 ·
3.6 : 17/17 · 3.7 : 24/24 · 8.1 : 10/10 · 8.2 : 23/23 — aucun compte ni fichier de test
restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 112 (inchangé, 126 hors fichier généré).
