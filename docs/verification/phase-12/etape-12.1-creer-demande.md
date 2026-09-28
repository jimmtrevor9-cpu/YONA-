# Phase 12 — Étape 12.1 — Créer une demande de contact

Date : 2026-09-28 · Statut : **VALIDÉE**

## Définition retenue

Le cahier des charges prévoit « 5 demandes de contact par jour » (gratuit), en illimité
pour Premium, sans autre précision. Une **demande de contact** est donc ici une démarche
distincte du Like :
- un membre l'envoie à un autre membre avec qui il n'a pas encore de Match ;
- il peut y joindre un court message de présentation, facultatif ;
- le destinataire peut l'accepter ou la refuser (étape 12.2).

## Réalisation

Migration `20260929110000_phase12_creer_demande.sql` (drizzle `0070`) :
- **Table `contact_requests`**, avec ces protections :
  - expéditeur, destinataire, message facultatif (300 caractères au plus), statut
    (`pending`, `accepted`, `declined` ou `cancelled`) et date fixée par le serveur ;
  - contraintes de base : pas de demande à soi-même, une seule demande en attente par
    couple ;
  - lecture réservée à l'expéditeur et au destinataire ;
  - aucune écriture directe.
- **Fonction `send_contact_request(_receiver_id, _message)`**, avec ces contrôles :
  - personne connectée pouvant consulter les profils ;
  - destinataire visible et actif, jamais soi-même, aucun blocage ;
  - pas de Match actif entre les deux ;
  - message sans numéro de téléphone (protection de la phase 6).

  Elle renvoie `sent` ou `already_pending`. Refus possibles : `not_authenticated`,
  `profile_unavailable`, `self_request`, `already_matched`, `message_too_long`,
  `phone_number_detected`.

Application :
- `src/features/contacts/requests.ts` (nouveau) : envoi et messages d'erreur clairs.
- `src/components/ContactRequestButton.tsx` (nouveau) : bouton « Demande de contact » et
  fenêtre d'envoi. On y trouve :
  - un message facultatif avec compteur ;
  - l'envoi désactivé au-delà de 300 caractères ;
  - l'explication sous le champ si le serveur refuse un numéro de téléphone ;
  - les messages « Demande de contact envoyée à … » et « déjà une demande en attente ».
- `src/components/ProfileCard.tsx` : emplacement d'action facultatif en bas de carte.
- `search.tsx`, `discover.tsx` : bouton sur les cartes de la Recherche et de Découvrir,
  sous Passer / Like.
- `src/integrations/supabase/types.ts` : table et fonction ajoutées.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 24 tables, 59 fonctions, 68 règles d'accès.

## Tests (`etape-12.1-creer-demande.mjs`) — 30/30

| Test | Résultat |
|---|---|
| Serveur : demande avec ou sans message, contenu enregistré, doublon « already_pending », 8 envois simultanés donnant 1 demande | ✅ ×5 |
| Refus : soi-même, Match existant, profil masqué, membre bloquant, inexistant, contrôle du profil avant le message, 301 caractères, numéro de téléphone ; message d'espaces enregistré vide ; visiteur | ✅ ×10 |
| Écriture, modification et suppression directes refusées ; lecture par la destinataire ; aucune lecture par un tiers | ✅ ×5 |
| Page : bouton, fenêtre, limite de 300, numéro refusé avec explication, envoi réussi, bouton dans Découvrir, demande déjà en attente | ✅ ×7 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Problème rencontré

Premier passage de la non-régression : le test 2.1 s'arrêtait. Il retrouvait une carte
par le texte « Liked ». Or le texte d'une autre carte (« Like » suivi de « Demande de
contact ») contenait aussi « LikeD… ». Le test a été rendu précis : prénom suivi de
« · ». En s'arrêtant, il avait laissé ses comptes de test, ce qui faussait 2.5, 2.7 et
2.8. Les comptes restants ont été supprimés.

Le test 2.5 a aussi été adapté : la Recherche n'a toujours ni Passer ni Like, mais elle
propose désormais « Demande de contact ».

## Non-régression (après correction)

0.6 : 73/73 · 0.7 : 33/33 · 1.15 : 31/31 · phase 2 (2.1 à 2.8) : 8/8 séries · phase 3
(3.1 à 3.7) : 7/7 séries · 8.1 : 10/10 · 8.2 : 23/23 · 11.1 : 26/26 · 11.2 : 18/18 ·
12.1 : 30/30. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 217
au total (fichier généré).
