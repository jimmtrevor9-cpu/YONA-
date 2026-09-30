# Phase 7 — Étape 7.7 — Activer le déblocage

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Depuis l'étape 7.6, un paiement confirmé passe au statut « réussi », mais aucun
déblocage n'était créé. La table `conversation_unlocks` et la fonction
`has_active_conversation_unlock` (déblocage actif = statut « actif » et période en
cours) existaient.

## Réalisation

- Migration `20260928060000_phase7_activer_deblocage.sql` (miroir
  `drizzle/migrations/0040_phase7_activer_deblocage.sql`) :
  - déclencheur `payments_activate_conversation_unlock` : quand un paiement de
    déblocage passe à « réussi », le serveur crée le déblocage — conversation du
    paiement, payé par son auteur, montant et devise du paiement, statut « actif »,
    3 jours à partir de la confirmation (durée fixée par le serveur) ;
  - si un déblocage est déjà en cours (les deux participants ont payé presque en même
    temps), le nouveau commence à la fin du précédent : aucun jour payé n'est perdu ;
  - un seul déblocage par paiement (index unique), même si la confirmation est répétée ;
  - rien pour un paiement en attente, échoué ou d'un autre type.
- Écran de paiement : « Paiement confirmé. Votre paiement de 1 USD a bien été enregistré.
  Le déblocage de la conversation avec … est activé pour 3 jours. » et bouton « Revenir à
  la conversation » ; la conversation est relue après confirmation.
- Test 7.6 adapté (la confirmation crée désormais un déblocage ; Grace paie dans une
  autre conversation puisque celle avec Paul est déjà débloquée).
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 46 fonctions.

L'effet du déblocage sur la conversation et l'envoi des messages est l'objet des étapes
7.8 et 7.9.

## Tests (`etape-7.7-activer-deblocage.mjs`) — 17/17

| Test | Résultat |
|---|---|
| Aucun déblocage avant confirmation ; écran « activé pour 3 jours » ; déblocage actif, 1 USD, 3 jours exactement, payé par Paul ; commence à la confirmation, lié au paiement | ✅ ×4 |
| Serveur : conversation débloquée pour les deux participants ; autre conversation non ; retour à la conversation | ✅ ×3 |
| Confirmation répétée : un seul déblocage ; en attente, échoué, abonnement : aucun déblocage | ✅ ×4 |
| Deux paiements confirmés en même temps : deux périodes de 3 jours à la suite (6 jours) | ✅ |
| Prolonger ou créer soi-même un déblocage : refusés (403) ; visibilité : participants oui, tiers non | ✅ ×3 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 · 7.6 : 21/21 · 7.7 : 17/17 — aucun compte ni fichier de test restant.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Type-check : 0 erreur · Build : réussi · Lint : 1 108 (inchangé).
