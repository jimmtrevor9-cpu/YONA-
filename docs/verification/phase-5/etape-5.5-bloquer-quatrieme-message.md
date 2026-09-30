# Phase 5 — Étape 5.5 — Bloquer le quatrième message

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 5.2, chaque message est compté (plafond 3) mais aucun envoi n'était
refusé : un 4ᵉ message partait normalement.

## Réalisation

- Migration `20260927160000_phase5_bloquer_quatrieme_message.sql` (miroir
  `drizzle/migrations/0026_phase5_bloquer_quatrieme_message.sql`) : dans `send_message`,
  le compteur n'augmente que s'il est inférieur à 3 ; sinon l'envoi est refusé avec le
  code `free_limit_reached` — message ni enregistré, ni délivré, compteur et date du
  dernier message inchangés. Vérification et comptage en une seule opération sur la
  conversation verrouillée : impossible de dépasser 3, même avec des envois simultanés.
  Une conversation indisponible reste signalée en priorité.
- `src/features/messaging/send.ts` : message « Vous avez utilisé vos 3 messages gratuits
  dans cette conversation. Votre message n'a pas été envoyé. » — le message provisoire
  est retiré du fil et le texte remis dans le champ (comportement de l'étape 4.9).
- Tests 4.8, 4.9 et 4.10 adaptés : ils portent sur l'envoi, l'affichage et les non-lus,
  pas sur le quota ; leur préparation remet à 0 les compteurs de leurs propres comptes de
  test avant chaque envoi (4.8 : envois simultanés ramenés de 5 à 3).

## Tests (`etape-5.5-bloquer-quatrieme-message.mjs`) — 16/16

| Test | Résultat |
|---|---|
| 3 messages envoyés ; 4ᵉ depuis l'application : message clair, non enregistré, compteur 3, message provisoire retiré, texte remis, date inchangée, rien reçu par l'autre | ✅ ×6 |
| Après rechargement : toujours 3 ; Ctrl+Entrée : même refus | ✅ ×2 |
| Appel direct refusé ; 5 essais simultanés refusés ; l'autre personne et les autres conversations non bloquées ; conversation fermée prioritaire | ✅ ×5 |
| 6 envois simultanés depuis 0 : exactement 3 acceptés, 3 refusés | ✅ |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

Première exécution : 16/16 ; une vérification jugée trop faible (non-lus de l'autre
personne) a été renforcée : elle vérifie désormais que l'autre personne voit exactement
3 messages.

## Non-régression

Séries touchant la base et la messagerie : 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 ·
4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 · 4.10 : 29/29 (adaptés) · 5.1 : 13/13 ·
5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 — aucun compte ni fichier de test restant.
(Première exécution de 4.8 / 4.9 / 4.10 avant adaptation : 35/42, 21/22, 27/29 — échecs
attendus, ces tests envoyaient plus de 3 messages par personne.)

Base réinstallée à zéro (28 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 092 (inchangé).
