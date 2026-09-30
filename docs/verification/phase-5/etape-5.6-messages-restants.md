# Phase 5 — Étape 5.6 — Afficher les messages restants

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Le quota était appliqué par le serveur (étapes 5.2 à 5.5) mais la personne ne voyait
jamais combien de messages gratuits il lui restait, et ne découvrait la limite qu'au
refus. L'ancienne fonction `get_conversation_quota` tient compte du Premium et du
déblocage, qui ne sont pas encore appliqués à l'envoi (phases 7 et 15) : l'utiliser
aurait affiché un décompte différent de la règle réelle.

## Réalisation

- Migration `20260927170000_phase5_messages_restants.sql` (miroir
  `drizzle/migrations/0027_phase5_messages_restants.sql`) : fonction
  `get_message_quota(conversation)` — utilisés, limite (3), restants, pour la personne
  connectée seulement ; réservée aux participants et aux membres connectés.
- `src/features/messaging/quota.ts` : requête du quota et textes (« 3 messages gratuits
  restants dans cette conversation », « 1 message gratuit restant… », « Vous avez utilisé
  vos 3 messages gratuits dans cette conversation. »).
- `src/components/MessageComposer.tsx` : décompte sous le champ, annoncé aux lecteurs
  d'écran ; à 0, message en rouge, champ et bouton désactivés.
- `src/routes/_authenticated/messages_.$conversationId.tsx` : décompte chargé à
  l'ouverture et rafraîchi après chaque envoi réussi ou refusé.
- `src/integrations/supabase/types.ts` : type de la fonction.
- Tests adaptés : 4.6 (le champ est désormais lié à deux textes d'aide : compteur de
  caractères et décompte) ; 5.5 (le champ se fermant à 0, le 3ᵉ message part d'un autre
  appareil pour que le 4ᵉ soit tenté depuis une page encore ouverte ; après rechargement,
  champ fermé et envoi forcé sans effet).
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 41 fonctions.

## Tests (`etape-5.6-messages-restants.mjs`) — 18/18

| Test | Résultat |
|---|---|
| Décompte 3 → 2 → 1 (singulier) → « utilisé vos 3 messages » ; lié au champ ; à 0 : rouge, champ et bouton désactivés ; cohérent avec le serveur | ✅ ×7 |
| Rechargement ; autre appareil ; autre personne (indépendant) ; autre conversation | ✅ ×4 |
| Onglet resté ouvert après envois ailleurs : refus du serveur puis décompte mis à jour, texte conservé | ✅ |
| Sécurité : tiers, sans connexion (401), chacun son propre quota | ✅ ×3 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Premier passage (base à zéro, 29 migrations) : tout réussi sauf 4.6 : 25/26 (liaison du
champ à deux textes d'aide) et 5.5 arrêté (champ désormais fermé à 0) — tests adaptés.
L'adaptation de 5.5 a révélé un petit défaut : un envoi forcé du formulaire fermé
(impossible par un usage normal, champ et bouton désactivés) atteignait encore le
serveur, qui le refusait ; le champ bloque désormais aussi l'envoi lui-même quand le
décompte est à 0.

Après correction : 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 ·
4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 (premier passage, non concernés par la
correction) ; 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.10 : 29/29 · 5.1 : 13/13 ·
5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 16/16 · 5.6 : 18/18 ; 4.9 : arrêté une
fois sans message d'erreur conservé, puis 22/22 trois fois de suite (non reproduit) —
aucun compte ni fichier de test restant. Série complète prévue en fin de phase 5.

Base réinstallée à zéro (29 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 098 (+6, toutes dans le fichier généré `types.ts`, format sans point-virgule
conservé ; autres fichiers sans remarque).
