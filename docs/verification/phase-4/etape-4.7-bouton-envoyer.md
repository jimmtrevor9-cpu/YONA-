# Phase 4 — Étape 4.7 — Ajouter le bouton Envoyer

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Le champ de message (étape 4.6) n'avait pas de bouton. L'écriture dans la table
`messages` reste fermée à tous les membres ; l'enregistrement sécurisé côté serveur
(droits, Match actif, conversation ouverte, blocages) est l'étape 4.8.

## Réalisation

- `src/components/MessageComposer.tsx` : bouton rond doré (icône « avion ») à droite du
  champ, nom accessible « Envoyer le message » / « Envoi du message… » ;
  - désactivé si le texte est vide ou ne contient que des espaces / retours à la ligne ;
  - Entrée = nouvelle ligne ; Ctrl+Entrée (Cmd+Entrée sur Mac) = envoyer ; titre d'aide
    « Envoyer (Ctrl+Entrée) » ;
  - un seul envoi à la fois (double clic et répétitions ignorés), champ en lecture seule
    pendant l'envoi ;
  - texte nettoyé des espaces de début et de fin avant l'envoi ; champ et brouillon vidés
    seulement si le message est parti, sinon le texte reste ; curseur remis dans le champ.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : action d'envoi branchée.
  Tant que l'étape 4.8 n'est pas faite, elle n'envoie rien et affiche « L'envoi des
  messages n'est pas encore activé. Votre texte est conservé. »

Aucun changement serveur ni base de données. Le vidage du champ après un envoi réussi
sera vérifié à l'étape 4.8 (il n'existe pas encore d'envoi réel à tester).

## Tests (`etape-4.7-bouton-envoyer.mjs`) — 25/25

| Test | Résultat |
|---|---|
| Bouton présent à droite du champ, aligné, taille tactile 40 px | ✅ ×2 |
| Désactivé : vide, espaces seuls, texte effacé ; activé : texte, 4 000 caractères | ✅ ×5 |
| Clic : message clair, texte conservé, rien d'enregistré, curseur dans le champ | ✅ ×3 |
| Entrée = ligne ; Ctrl+Entrée = envoi sans ligne ajoutée ; Ctrl+Entrée à vide : rien | ✅ ×4 |
| Double clic : une seule action (échouait avant correction) ; titre d'aide | ✅ ×2 |
| Rechargement ; Tab vers le bouton ; Entrée sur le bouton | ✅ ×3 |
| Conversation non disponible : pas de bouton ; écriture directe refusée (403) | ✅ ×2 |
| 320 px ; aucune erreur JS ; aucun message enregistré ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
