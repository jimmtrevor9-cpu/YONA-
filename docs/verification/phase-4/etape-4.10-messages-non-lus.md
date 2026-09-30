# Phase 4 — Étape 4.10 — Gérer les messages non lus

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Aucune notion de lecture n'existait : ni date de lecture, ni compteur. Impossible de
savoir quelles conversations contenaient des messages nouveaux.

## Réalisation

- Migration `20260927120000_phase4_messages_non_lus.sql` (miroir
  `drizzle/migrations/0022_phase4_messages_non_lus.sql`) :
  - table `conversation_reads` (conversation, membre, date de dernière lecture), RLS :
    chacun ne lit que ses propres lignes ; aucune écriture directe ;
  - `mark_conversation_read(conversation)` : participant seulement, date du serveur, la
    date ne recule jamais ;
  - `get_unread_counts()` : messages délivrés par l'autre personne après la dernière
    lecture, uniquement pour les conversations affichées (non fermées, Match actif, aucun
    blocage, profil de l'autre visible) ; messages retenus par la modération et ses
    propres messages exclus ;
  - fonctions réservées aux membres connectés.
- `src/features/messaging/unread.ts` : requête des non-lus, boîte de réception en direct
  (tout nouveau message lisible rafraîchit les compteurs ; sans direct, vérification toutes
  les 30 s), marquage de lecture à l'ouverture et à chaque message reçu tant que l'onglet
  est visible.
- `src/components/BottomNav.tsx` : pastille dorée sur « Messages » (total, « 99+ »),
  annoncée aux lecteurs d'écran.
- `src/routes/_authenticated/messages.tsx` : compteur par conversation et aperçu en gras.
- `src/components/MessageThread.tsx` : marque la conversation lue.
- `src/integrations/supabase/types.ts` : table et fonctions ajoutées.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 22 tables, 39 fonctions, 66 règles.
- Correction (défaut de l'étape 4.8 trouvé par la non-régression) : migration
  `20260927130000_phase4_date_dernier_message.sql` (miroir `0023`) — lors d'envois
  simultanés, la date du dernier message pouvait reculer (date prise au début de la
  transaction). Désormais la date du message est prise au moment de l'écriture, après le
  verrou, et la date du dernier message ne recule jamais.

## Tests (`etape-4.10-messages-non-lus.mjs`) — 29/29

| Test | Résultat |
|---|---|
| Compteur par conversation ; modération et propres messages exclus ; gras ; lecteurs d'écran | ✅ ×4 |
| Pastille « Messages » (valeur, lecteurs d'écran, visible sur les autres pages) | ✅ ×3 |
| En direct : pastille et compteur mis à jour sans recharger | ✅ ×2 |
| Ouverture → lue ; date serveur ; message reçu pendant la lecture déjà lu ; onglet caché → non lu puis lu au retour ; liste à jour | ✅ ×6 |
| Autre appareil : mêmes compteurs ; compteurs de l'autre personne indépendants ; « 99+ » | ✅ ×4 |
| Fermée, Match défait, blocage, profil masqué : non comptés | ✅ |
| Sécurité : tiers, sans connexion, écriture directe (403), lectures des autres, date qui ne recule pas | ✅ ×6 |
| 320 px ; aucune erreur JS ; nettoyage | ✅ ×3 |

Première exécution : 27/29 — erreur dans le test (colonne manquante dans l'insertion des
120 messages), corrigée ; le code n'était pas en cause.

## Non-régression

Série complète (base à 24 migrations) : toutes les séries réussies sauf 4.8 : 41/42 —
« 5 envois simultanés : date du dernier message = le plus récent » (reproduit 2 fois sur 2).
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 à 4.7 et 4.9 : toutes réussies.

Après correction (base réinstallée à zéro, 25 migrations) : 4.8 : 42/42 trois fois de
suite ; séries touchant la base et la messagerie relancées : 0.5 : 24/24 · 0.6 : 73/73 ·
0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 · 4.4 : 20/20 · 4.5 : 21/21 ·
4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 · 4.10 : 29/29 — aucun compte ni
fichier de test restant. (Les phases 1 à 3 n'utilisent pas l'envoi de messages.)

Type-check : 0 erreur · Build : réussi ·
Lint : 1 092 (+32, toutes dans le fichier généré `types.ts`, format sans point-virgule
conservé ; autres fichiers sans remarque).
