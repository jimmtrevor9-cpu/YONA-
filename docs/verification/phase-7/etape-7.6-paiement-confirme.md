# Phase 7 — Étape 7.6 — Enregistrer le paiement confirmé

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

L'écran de paiement (7.5) crée un paiement « en attente » mais rien ne permettait
d'enregistrer sa confirmation. Aucun prestataire réel n'est configuré : la confirmation
doit donc être conçue pour venir du serveur (notification signée du futur prestataire),
jamais du navigateur.

## Réalisation

- Migration `20260928050000_phase7_paiement_confirme.sql` (miroir
  `drizzle/migrations/0039_phase7_paiement_confirme.sql`) : `confirm_payment(paiement,
  prestataire, référence, montant, devise)`, appelable **uniquement par le rôle service**
  (serveur) :
  - paiement existant et du même prestataire ; référence de transaction obligatoire,
    unique (index existant) ;
  - montant ou devise différents de ceux enregistrés : paiement marqué « échoué »
    (motif `amount_mismatch`), jamais « réussi » ;
  - confirmation répétée avec la même référence : sans effet ; avec une autre
    référence : refusée ; paiement échoué ou annulé : ne peut plus être confirmé ;
  - sinon : statut « réussi », référence et date de confirmation enregistrées.
- `src/features/payments/unlock.functions.ts` : `confirmTestPayment` — **mode test
  uniquement** (refusée si le serveur n'est pas en mode test) ; vérifie que le paiement
  appartient à la personne connectée, est un déblocage du prestataire de test et est en
  attente ; confirme via le rôle service. Avec un prestataire réel, sa notification
  signée appellera la même fonction `confirm_payment`.
- Écran de paiement : en mode test, bouton « Confirmer le paiement de test (aucun argent
  réel) » ; « Paiement confirmé. Votre paiement de 1 USD a bien été enregistré. »
- `docs/verification/outils/demarrer-test-local.sh` : clé service de la base LOCALE
  transmise au serveur de test (jamais au navigateur).
- `src/integrations/supabase/types.ts`, `docs/CONNECTER_UNE_BASE_SUPABASE.md` (45
  fonctions).

L'activation du déblocage qui découle du paiement est l'étape 7.7.

## Tests (`etape-7.6-paiement-confirme.mjs`) — 21/21

| Test | Résultat |
|---|---|
| Parcours : bouton de confirmation (test) ; « Paiement confirmé » ; « réussi » avec référence et date ; montant inchangé ; pas encore de déblocage ; rejeu refusé | ✅ ×6 |
| Membre et visiteur appelant `confirm_payment` : refusés ; confirmer le paiement d'une autre personne : refusé | ✅ ×3 |
| Serveur : référence absente, autre prestataire, référence déjà utilisée : refusés ; montant ou devise différents : « échoué » ; confirmation correcte ; répétition sans effet ; autre référence refusée ; paiement échoué non confirmable | ✅ ×9 |
| Serveur sans mode test : confirmation de test refusée | ✅ |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

Premiers passages : 19/21 puis 20/21 — erreurs du test (lecture de la valeur « vrai »
de la base ; requête rejouée vers le second serveur avec l'adresse d'origine du premier,
refusée à juste titre par le serveur) ; corrigées.

Correction de conception pendant l'étape : une première version levait une erreur en cas
de montant différent, ce qui annulait aussi l'enregistrement du statut « échoué » ; la
fonction renvoie désormais « failed » sans erreur, et l'échec est conservé.

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 · 7.6 : 21/21 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 108 (+8, toutes dans le fichier
généré `types.ts`).
