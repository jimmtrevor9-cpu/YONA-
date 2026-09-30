# Phase 15 — Avantages Premium (étapes 15.1 à 15.16)

Date : 2026-09-30 · Statut : **VALIDÉES**

## Réalisation

Migration `20260930130000_phase15_avantages_premium.sql` (drizzle `0074`).

- **Déjà en place, revérifiés avec un vrai abonnement** : 15.1 demandes illimitées,
  15.2 Roi Salomon illimité, 15.3 favoris entrants, 15.4 visiteurs, 15.8 qui est
  connecté, 15.13 filtres avancés, 15.15 badge (phase 14).
- **15.9 / 15.10 / 15.11** (Ice Breaker personnalisé, Flash, compatibilité détaillée) :
  réalisés dans les phases 16, 17 et 18 qui leur sont dédiées.
- **15.5 — 10 photos HD** : limite 3 / 10 protégée contre les ajouts simultanés. En
  gratuit, la photo est réduite à 1 280 px dans le navigateur et la base refuse tout
  fichier de plus de 2 Mo (`photo_hd_premium`) ; en Premium, le fichier d'origine
  (jusqu'à 5 Mo) est gardé. Un fichier déjà enregistré ne peut plus être remplacé.
- **15.6 — Messagerie illimitée** : `send_message` ne décompte rien pour un Premium ;
  `get_message_quota` renvoie `premium`. L'autre personne (gratuite) garde sa limite.
  Les contrôles communs d'envoi sont regroupés dans `lock_conversation_for_sending`.
- **15.7 — Messages vocaux** : bouton micro dans le champ de message (2 minutes au plus),
  stockage privé `voice-messages` (dossier conversation / expéditeur), dépôt réservé au
  Premium participant, écoute réservée aux 2 participants, `send_voice_message` vérifie
  Premium, durée, fichier, conversation. Les membres gratuits peuvent écouter.
- **15.12 — Meilleur classement** : Découvrir et Recherche montrent d'abord les profils
  boostés, puis les Premium.
- **15.14 — Boost** : 1 heure en tête, une fois tous les 7 jours (`activate_profile_boost`),
  carte « Boost de profil » sur le profil.
- **15.16 — Support prioritaire** : page `/support` (demande + suivi des réponses), table
  `support_tickets`, priorité « Prioritaire » donnée par le serveur aux Premium, 5
  demandes par jour au plus. Les réponses seront données depuis `/admin` (phase 23).
- Correction : `contains_phone_number` redevient réservée au serveur (règle phase 6) ;
  Roi Salomon et Ice Breaker l'appellent avec le rôle service.

## Tests (`etape-15.1-a-15.16-avantages-premium.mjs`) — 50/50

| Test | Résultat |
|---|---|
| Avantages déjà en place (demandes, IA, favoris, visiteurs, présence, filtres) ; détecteur réservé au serveur | ✅ ×6 |
| Photos : HD refusée en gratuit, 4e photo refusée, HD acceptée en Premium, 11e refusée, remplacement refusé | ✅ ×5 |
| Messagerie : 4e message gratuit refusé, 6 messages Premium sans décompte, l'autre garde sa limite | ✅ ×3 |
| Vocaux : dépôt et envoi refusés en gratuit, durée / fichier / doublon refusés, écoute limitée aux participants, Premium extérieur refusé | ✅ ×9 |
| Boost : refusé en gratuit, écriture directe refusée, 1 heure, une fois par semaine, état | ✅ ×5 |
| Classement : Découvrir et Recherche (boosté, Premium, autres), fin du boost | ✅ ×3 |
| Support : priorité, validation, anti-abus, confidentialité, priorité non falsifiable | ✅ ×5 |
| Pages : conversation Premium, vocal dans le fil, micro, Ice Breaker, écoute en gratuit, profil gratuit, photo réduite, boost, support | ✅ ×9 |
| Enregistrement réel avec le faux micro de Chromium (≈ 2 s), vocal affiché ; 320 px ; aucune erreur JS ; nettoyage | ✅ ×5 |

Type-check : 0 erreur · Build : réussi.
