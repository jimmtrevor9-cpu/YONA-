# Phase 14 — Premium (étapes 14.1 à 14.13)

Date : 2026-09-30 · Statut : **VALIDÉES**

## Réalisation

- **14.1 à 14.5 — Page `/premium`** : formules Mensuel (5 USD) et Annuel (35 USD, « -42 % »,
  choisie par défaut), listes Gratuit et Premium du cahier des charges §3
  (`src/features/premium/features.ts`). Accès : carte « Passer en Premium » du profil et
  liens « Découvrir Premium » là où une fonction est réservée (favoris, visiteurs, filtres
  avancés, quota de demandes, quota Roi Salomon).
- **14.6 à 14.9 — Paiement** (migration `20260930120000_phase14_premium.sql`, drizzle `0073`) :
  `start_premium_payment(formule, prestataire)` crée un paiement « en attente » avec le
  montant fixé par la base (500 ou 3 500 cents). Paiement unique, sans renouvellement
  automatique (plus simple et sans surprise pour le membre).
- **Stripe** (`src/features/payments/stripe.server.ts`) : page de paiement Stripe Checkout,
  puis confirmation uniquement par la notification signée (`/api/stripe-webhook`, signature
  HMAC-SHA256, 5 minutes de tolérance). `confirm_payment` revérifie montant et devise.
  Actif si `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`.
  Le déblocage à 1 USD utilise aussi Stripe.
- **14.10 / 14.11 — Activation** : déclencheur `payments_activate_premium` ; un paiement =
  un abonnement ; une prolongation commence à la fin de la période en cours.
- **14.12 — Badge « Premium »** (`PremiumBadge`) : cartes Découvrir et Recherche, profil
  d'un Match, conversation, page Premium. `get_premium_badges` ne révèle que « Premium
  oui/non », seulement pour les profils visibles.
- **14.13 — Expiration** : exacte à la seconde (`is_premium` compare les dates) ; la tâche
  `expire_subscriptions` (pg_cron, toutes les 5 min) note le statut « expiré ».

## Tests (`etape-14.1-a-14.13-premium.mjs`) — 46/46

| Test                                                                                                                                       | Résultat |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Base : montants, prestataire/formule inconnus, visiteur, abonnement ou paiement écrit soi-même, expiration lancée par un membre            | ✅ ×7    |
| Page : carte du profil, prix, formule par défaut, listes, mode test, choix mensuel                                                         | ✅ ×6    |
| Paiement test : en attente, confirmé → Premium 1 mois, page, demandes illimitées, formule inventée refusée                                 | ✅ ×5    |
| Prolongation annuelle sans jour perdu ; montant différent → échec ; confirmation depuis le navigateur refusée                              | ✅ ×4    |
| Badge : visible sur le profil, rien d'autre révélé, profil masqué, visiteur                                                                | ✅ ×4    |
| Expiration : fin immédiate, page « a pris fin », statut « expiré »                                                                         | ✅ ×3    |
| Stripe (faux Stripe local) : redirection, 35 USD envoyés par le serveur, rien avant la notification                                        | ✅ ×4    |
| Webhook : sans signature, mauvais secret, trop ancien, contenu modifié → 400 ; bonne signature → Premium ; doublon ; autre montant → échec | ✅ ×7    |
| Aucune clé Stripe dans le code du navigateur ; sans prestataire : indisponible ; 320 px ; aucune erreur JS ; nettoyage                     | ✅ ×6    |

Non testé avec le vrai Stripe (pas de compte) : le faux Stripe local reproduit l'API
`checkout/sessions` et les notifications signées sont construites comme celles de Stripe.

Type-check : 0 erreur · Build : réussi.
