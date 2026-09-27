# Phase 7 — Étape 7.2 — Afficher le déblocage

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Quand les 3 messages gratuits étaient utilisés, la conversation affichait seulement
« Vous avez utilisé vos 3 messages gratuits… » avec le champ fermé : aucune solution
n'était proposée. Le signal « quota épuisé » du serveur existe depuis l'étape 7.1.

## Réalisation

- `src/components/UnlockOffer.tsx` (nouveau) : panneau doré « Débloquer cette
  conversation » — « Continuez à écrire à … sans limite dans cette conversation. » —
  bouton « Débloquer la conversation » ; section nommée pour les lecteurs d'écran. Tant
  que l'écran de paiement n'existe pas (étape 7.5), le bouton est inactif avec la mention
  « Le paiement arrive très bientôt. » (aucune fausse promesse de paiement).
- `src/routes/_authenticated/messages_.$conversationId.tsx` : l'offre s'affiche sous le
  champ dès que le serveur signale le quota épuisé, sans rechargement ; jamais sinon.

Le prix et la durée sont les étapes 7.3 et 7.4. Aucun changement de la base.

## Tests (`etape-7.2-afficher-deblocage.mjs`) — 14/14

| Test | Résultat |
|---|---|
| 3 puis 1 message restant : pas d'offre ; après le 3e : offre sans recharger | ✅ ×3 |
| Titre et texte avec le prénom ; section nommée ; bouton inactif + mention ; visible à l'ouverture | ✅ ×4 |
| Rechargement ; autre conversation et autre personne (quota intact) : pas d'offre ; personne extérieure : pas d'offre | ✅ ×4 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

Premier passage : arrêt du test (la personne extérieure était attendue sur une page avec
champ de message, alors qu'elle voit « non disponible ») ; test corrigé. Vérification de
visibilité simplifiée (une seule mesure après rechargement).

## Non-régression

Séries touchant la base et la messagerie (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 097 (inchangé).
