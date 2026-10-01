# Phase 2 — Étape 2.1 — Ajouter le bouton Like

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Le bouton Like existait déjà sur chaque carte de la page Découverte
  (`src/components/ProfileCard.tsx`) : états « Like », « Envoi… », « Aimé », libellé
  accessible, relié à la fonction serveur `likeProfile`
  (`src/features/profiles/likes.functions.ts`) et à la liste des Likes envoyés
  (`sentLikesQuery`). Vérifié de bout en bout : il fonctionne.
- **Problème** : quand le profil n'était plus disponible (masqué, suspendu, bloqué entre
  l'affichage et le clic), le serveur répondait « Ce profil n'est plus disponible. » mais
  le membre voyait « Réessayez dans un instant » — et la carte restait affichée.

## Réalisation

- `src/features/profiles/likes.ts` : `likeErrorMessage` (affiche les refus explicites du
  serveur, sinon le message générique) et `isProfileUnavailableError` ;
- `src/routes/_authenticated/discover.tsx` : message correct ; la liste est rechargée
  pour retirer un profil devenu indisponible.

Aucun changement visuel du bouton ; aucun changement serveur ou base (l'enregistrement
et ses protections sont l'objet des étapes 2.2 à 2.4).

## Tests (`etape-2.1-bouton-like.mjs`) — 20/20

| Test | Résultat |
|---|---|
| Un bouton « Like » par carte, libellé accessible, zone de toucher 36 px | ✅ ×3 |
| Clic : « Like envoyé. », bouton « Aimé » désactivé, Like enregistré, autres cartes inchangées | ✅ ×4 |
| Pendant l'envoi « Envoi… » désactivé ; double clic → un seul Like | ✅ ×2 |
| Clavier (Entrée) | ✅ |
| Après rechargement, les états sont conservés | ✅ |
| Profil devenu indisponible : bon message, carte retirée, rien d'enregistré | ✅ ×2 |
| Panne réseau : message générique, bouton de nouveau utilisable | ✅ ×2 |
| Appel du serveur sans connexion : refusé (403) ; total exact de Likes | ✅ ×2 |
| 320 px, aucune erreur JavaScript, nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 —
aucun compte ni fichier de test restant.

Correction d'un test instable : `etape-1.4-deconnexion.mjs` lisait le prénom du membre A
avant la fin du chargement de la page (échec 1 fois sur 3) ; il attend désormais que le
champ soit rempli (4 exécutions réussies d'affilée).

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (inchangé ; fichiers modifiés sans
remarque).
