# Phase 7 — Étape 7.5 — Créer l'écran de paiement

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

L'offre de déblocage (7.2 à 7.4) n'ouvrait rien. Les tables `payments` et
`conversation_unlocks` existaient ; les membres gardaient des droits d'écriture directe
sur ces deux tables (bloqués seulement par l'absence de règle RLS). Aucun prestataire de
paiement n'est choisi ni configuré : aucun paiement réel ne peut être encaissé à ce
stade.

## Réalisation

- Migration `20260928040000_phase7_ecran_paiement.sql` (miroir
  `drizzle/migrations/0038_phase7_ecran_paiement.sql`) :
  - droits INSERT / UPDATE / DELETE retirés aux membres sur `payments` et
    `conversation_unlocks` (lecture de leurs propres lignes seulement) ;
  - `start_conversation_unlock_payment(conversation, prestataire)` : crée un paiement
    « en attente » pour la personne connectée ; montant (100 cents), devise (USD), type
    et statut fixés par le serveur ; prestataire limité à la liste autorisée (« test »
    pour l'instant) ; participante, conversation ouverte, Match actif ; refus si un
    déblocage est déjà actif ; paiement en attente de moins d'une heure réutilisé.
- `src/features/payments/provider.ts` : le prestataire est choisi par le serveur
  (`PAYMENT_PROVIDER`), jamais par le navigateur ; sans prestataire configuré, le
  paiement est indisponible ; `test` = prestataire de test (aucun argent réel), actif
  seulement si le serveur le demande explicitement.
- `src/features/payments/unlock.functions.ts` : `getPaymentAvailability`,
  `startUnlockPayment` (connexion obligatoire, messages d'erreur en français).
- `src/routes/_authenticated/messages_.$conversationId_.debloquer.tsx` : écran
  `/messages/<id>/debloquer` — récapitulatif (prénom, photo), prix 1 USD, inclus (3 jours
  illimités, paiement unique, activation à la confirmation), bouton « Payer 1 USD »,
  mention du mode test, « Paiement créé, en attente de confirmation. », « Le paiement en
  ligne n'est pas encore disponible. » sans prestataire, conversation non disponible.
- `src/components/UnlockOffer.tsx` : le bouton de l'offre mène à cet écran.
- `docs/verification/outils/demarrer-test-local.sh` : prestataire de test activé pour
  l'environnement local de vérification uniquement.
- `src/integrations/supabase/types.ts`, `docs/CONNECTER_UNE_BASE_SUPABASE.md` (44
  fonctions). Tests 7.2 à 7.4 adaptés (bouton devenu lien actif).

La confirmation du paiement (réservée au serveur) est l'étape 7.6.

## Tests (`etape-7.5-ecran-paiement.mjs`) — 26/26

| Test | Résultat |
|---|---|
| Offre → écran ; titre ; récapitulatif ; prix ; inclus ; mode test signalé ; montant vérifié par le serveur | ✅ ×7 |
| Aucun paiement avant clic ; clic → « en attente » (100, USD, déblocage, test) ; lié à la conversation, rien débloqué ; pas de doublon | ✅ ×5 |
| Protections : créer un paiement, le passer « réussi », créer un déblocage → 403 ; prestataire non autorisé ; tiers ; sans connexion ; ses propres paiements seulement | ✅ ×7 |
| Écran : tiers « non disponible » ; sans connexion → /login ; retour à la conversation | ✅ ×3 |
| Serveur sans prestataire : paiement indisponible, pas de bouton, pas de mode test | ✅ |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 100 (+3, toutes dans le fichier
généré `types.ts`).
