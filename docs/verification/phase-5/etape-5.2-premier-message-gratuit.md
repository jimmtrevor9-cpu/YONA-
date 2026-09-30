# Phase 5 — Étape 5.2 — Autoriser le premier message gratuit

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Le compteur individuel existait (étape 5.1) mais l'envoi d'un message (`send_message`,
étape 4.8) ne le modifiait pas : aucun message n'était compté.

## Réalisation

- Migration `20260927150000_phase5_premier_message_gratuit.sql` (miroir
  `drizzle/migrations/0025_phase5_premier_message_gratuit.sql`) : `send_message` compte
  chaque message dans le compteur de l'expéditeur pour cette conversation, dans la même
  transaction que l'enregistrement (conversation verrouillée : pas de double comptage) ;
  le premier message fait passer le compteur de 0 à 1. Un envoi refusé (vide, trop long,
  tiers, conversation indisponible) ou qui n'atteint pas le serveur n'est jamais compté.
  Compteur absent : créé à 0 puis compté. Plafonné à 3 (le blocage du 4ᵉ message est
  l'étape 5.5).

Aucun changement visible dans l'application.

## Tests (`etape-5.2-premier-message-gratuit.mjs`) — 15/15

| Test | Résultat |
|---|---|
| Premier message depuis l'application : enregistré ; compteur de l'expéditeur 0 → 1 ; celui de l'autre et des autres conversations inchangés ; affiché sans erreur | ✅ ×6 |
| Refusés et non comptés : vide, trop long, tiers (aucun compteur créé), conversation fermée, panne réseau | ✅ ×5 |
| Premier message de l'autre personne : son compteur seulement ; compteur absent recréé ; 2 envois simultanés comptés exactement | ✅ ×3 |
| Nettoyage | ✅ |

Première exécution : 9/15 — tous les envois échouaient : dans `send_message`,
`conversation_id` est aussi le nom d'une colonne renvoyée, ce qui rendait la clause
`ON CONFLICT (conversation_id, user_id)` ambiguë. Corrigé en nommant la contrainte.

## Non-régression

Séries touchant la base et la messagerie : 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 ·
4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 · 4.10 : 29/29 · 5.1 : 13/13 — aucun compte ni
fichier de test restant. (Seul l'envoi de messages change ; phases 1 à 3 non concernées ;
série complète prévue en fin de phase 5.)

Base réinstallée à zéro (27 migrations). Type-check : 0 erreur · Build : réussi (aucun
changement de code applicatif) · Lint : 1 092 (inchangé).
