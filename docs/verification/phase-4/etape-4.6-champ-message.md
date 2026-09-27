# Phase 4 — Étape 4.6 — Ajouter le champ de message

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La page d'une conversation affichait les messages (étape 4.5) sans zone de saisie. La
base limite un message à 1 à 4 000 caractères et n'autorise encore aucune écriture
directe dans `messages` (l'enregistrement sécurisé est l'étape 4.8). Le bouton Envoyer
est l'étape 4.7.

## Réalisation

- `src/features/messaging/composer.ts` : limite de 4 000 caractères (identique à la
  base), seuil du compteur, `normalizeMessage` / `isMessageSendable` (préparés pour
  l'envoi), brouillon par personne et par conversation dans le stockage de l'onglet
  (`sessionStorage` : effacé à la fermeture de l'onglet, jamais envoyé au serveur ni
  partagé avec un autre appareil ; ignoré sans erreur si le stockage est indisponible).
- `src/components/MessageComposer.tsx` : champ « Écrivez à … » dans un panneau doré,
  toujours visible en bas au-dessus de la barre de navigation ; s'agrandit avec le texte
  (jusqu'à environ 6 lignes) ; Entrée ajoute une ligne ; compteur « 3 600 / 4 000 » à
  partir de 3 500 caractères, « limite atteinte » en rouge à 4 000 ; intitulé et
  compteur annoncés aux lecteurs d'écran.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : champ affiché sous le fil,
  seulement si la conversation est disponible.
- `src/components/MessageThread.tsx` : l'ouverture défile tout en bas de la page, pour
  que le dernier message apparaisse juste au-dessus du champ.

Aucun changement serveur ni base de données.

## Tests (`etape-4.6-champ-message.mjs`) — 26/26

| Test | Résultat |
|---|---|
| Champ présent, vide, intitulé et texte d'aide avec le prénom | ✅ ×2 |
| En bas au-dessus de la barre ; dernier message visible au-dessus ; reste accessible en remontant | ✅ ×3 |
| Saisie, Entrée = nouvelle ligne ; agrandissement plafonné ; rien n'est envoyé | ✅ ×3 |
| Compteur absent / « 3 600 / 4 000 » / collage 4 200 → 4 000 et « limite atteinte » ; lié au champ | ✅ ×4 |
| Brouillon : rechargement, propre à chaque conversation, navigation, non partagé, effacé | ✅ ×5 |
| L'autre participant a son propre champ | ✅ |
| Conversation non disponible ou adresse mal formée : pas de champ ; écriture directe refusée (403) | ✅ ×3 |
| Touche Tab ; 320 px avec texte très long ; aucune erreur JS ; aucun envoi ; nettoyage | ✅ ×5 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
