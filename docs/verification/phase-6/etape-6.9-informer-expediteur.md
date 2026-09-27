# Phase 6 — Étape 6.9 — Informer l'expéditeur

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 6.7, un message avec numéro est refusé, mais l'expéditeur voyait le
message générique « Le message n'a pas pu être envoyé. Vérifiez votre connexion… » :
il ne savait ni pourquoi, ni quoi faire.

## Réalisation

- `src/features/messaging/send.ts` : message pour le code `phone_number_detected` —
  « Votre message n'a pas été envoyé : il semble contenir un numéro de téléphone. Pour la
  sécurité de tous, l'échange de numéros n'est pas autorisé sur YONA. Retirez le numéro
  puis renvoyez votre message (il n'a pas été décompté de vos messages gratuits). » ;
  `isPhoneNumberError`.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : en cas de refus pour numéro,
  notification affichée 8 secondes et explication gardée sous le champ jusqu'à la
  prochaine modification du texte ; les autres refus gardent leur propre message.
- `src/components/MessageComposer.tsx` : encadré rouge d'explication sous le champ,
  annoncé aux lecteurs d'écran (alerte), lié au champ (champ signalé invalide) ; effacé
  dès que le texte change. Le texte reste dans le champ pour être corrigé (étape 4.9).

Aucun changement de la base.

## Tests (`etape-6.9-informer-expediteur.mjs`) — 15/15

| Test | Résultat |
|---|---|
| Notification : raison, quoi faire, non décompté ; explication gardée sous le champ ; alerte liée au champ ; texte remis, rien enregistré, décompte intact ; notification visible ≥ 5 s | ✅ ×6 |
| Texte modifié : explication effacée ; message corrigé envoyé | ✅ ×2 |
| Autre refus (conversation fermée) : son propre message, pas d'encadré « numéro » | ✅ |
| Numéro en lettres : même explication ; l'autre personne ne voit rien ; appel direct : code renvoyé | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

Premier passage : arrêt du test (conversation fermée avant d'être ouverte, la page
affichait « non disponible ») ; ordre corrigé.

## Non-régression

Séries touchant la base et la messagerie (phases 0, 4, 5, 6) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 6.)

Type-check : 0 erreur · Build : réussi · Lint : 1 098 (inchangé).
