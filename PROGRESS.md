# YONA — Suivi de progression

Dernière mise à jour : 2026-09-30

## État des phases

| Phase | Sujet | État |
|---|---|---|
| 0 à 11 | Environnement, inscription, Découvrir, Like/Pass, Match, messages, quota 3 messages, numéros, déblocage 1 USD, favoris, visites, présence, recherche | ✅ Terminé (travail précédent) |
| 12 | Demandes de contact | ✅ Terminé (12.1 avant, 12.2 à 12.6 le 2026-09-30) |
| 13 | Roi Salomon | ✅ Terminé (2026-09-30) |
| 14 | Premium (page, paiement, badge, expiration) | ✅ Terminé et testé (46/46) |
| 15 | Avantages Premium | ✅ Terminé et testé (50/50) |
| 16 | Ice Breaker | ✅ Code terminé (test auto à écrire) |
| 17 | Message Flash | ✅ Code terminé (test auto à écrire) |
| 18 | Compatibilité | ✅ Code terminé (test auto à écrire) |
| 19 | Notifications | 🟡 Code écrit, migration à appliquer et tester |
| 20 | Paramètres `/settings` | 🟡 Code écrit, migration à appliquer et tester |
| 21 | Blocage | 🟡 Code écrit, migration à appliquer et tester |
| 22 | Signalement | 🟡 Code écrit, migration à appliquer et tester |
| 23 | Administration `/admin` | 🟡 Code écrit, migration à appliquer et tester |
| 24 | Sécurité finale | ⏳ À faire |
| 25 | Tests | ⏳ À faire |
| 26 | Validation finale + README | ⏳ À faire |

## Tâche en cours

Vérifier les phases 19 à 23 sur une base locale (le conteneur a redémarré : Docker à relancer).

## Prochaine action précise

1. Relancer Supabase local (`supabase start` dans `/home/claude/yona-local`).
2. Appliquer dans l'ordre les migrations `20260930170000_phase19_notifications.sql`,
   `20260930180000_phase20_parametres.sql`, `20260930190000_phase21_22_blocage_signalement.sql`,
   `20260930200000_phase23_administration.sql` (+ copies drizzle 0077 à 0080).
3. Écrire les tests `docs/verification/phase-16` à `phase-23`, corriger, puis phases 24 à 26.

## Décisions techniques

- **Base de travail** : le code du ZIP `YONA_PHASE_12_ETAPE_12.1` ; sauvegardé sur GitHub
  (`jimmtrevor9-cpu/YONA-`, branche `claude/yona-phase-12-onwards-7e8y61`).
- **Tests** : chaque phase a un script dans `docs/verification/phase-N/` exécuté contre un
  Supabase local (`supabase start`, Docker) + l'application construite. Rapport `.md` à côté.
- **Migrations** : chaque migration existe en double (`supabase/migrations/` pour la CLI
  Supabase et `drizzle/migrations/` pour Lovable), comme dans le travail précédent.
  Une migration par phase (au lieu d'une par étape) pour aller plus vite, avec chaque
  étape commentée dans le fichier.
- **Installation** : `npm install` (le fichier `bun.lock` pointe vers un dépôt privé de
  Lovable et échoue ailleurs).
- **Demandes de contact** : accepter une demande crée un Match (et la conversation). Une
  demande compte dans le quota dès son envoi, même annulée. Jour = jour calendaire UTC.
  Après un refus, pas de relance pendant 30 jours.

- **Roi Salomon** : Claude (Anthropic) via le SDK officiel, clé `ANTHROPIC_API_KEY` sur le
  serveur uniquement, modèle `claude-opus-5-5` par défaut (`AI_MODEL` pour changer). La
  discussion n'est pas enregistrée sur le serveur (gardée dans l'onglet). Si l'IA échoue,
  la question est rendue.

- **Premium** : paiement unique (mensuel ou annuel), sans renouvellement automatique ; un
  renouvellement s'ajoute après la période en cours. Stripe appelé en REST, confirmé par un
  webhook signé (`/api/stripe-webhook`). Prestataire « test » par défaut.
- **Compatibilité** : score calculé par des règles simples en SQL (dénomination, foi,
  église, prière, valeurs, intérêts, objectif, famille, âge, pays), pas par l'IA.
- **Boost** : 1 heure, une fois tous les 7 jours (Premium). Photos HD : 5 Mo en Premium,
  2 Mo (réduites à 1280 px) sinon. Messages vocaux : 120 s max, Premium, stockage privé.
- **Blocage** : ferme le Match et la conversation, annule les demandes, retire les favoris.
- **Admin** : toutes les fonctions `admin_*` revérifient le rôle en base ; suspendre ou
  bannir bloque aussi la connexion (Supabase Auth, fonction serveur).

## Problèmes connus

- Non testé en réel : Stripe en ligne (testé avec un faux Stripe local), vraie clé
  Anthropic, envoi d'e-mails (aucun service d'e-mail : la préférence est seulement enregistrée).
- Paiement réel : pas encore choisi par le propriétaire (question posée : Stripe ou
  Mobile Money). En attendant : prestataire « test » (sans argent réel).
- Lint : ~1 200 erreurs de mise en forme, presque toutes dans des fichiers générés
  automatiquement (`src/integrations/supabase/*`). À traiter en phase 26.
- Les photos restent « en attente » tant qu'un admin ne les a pas validées (choix de la
  phase 1) : la modération des photos sera ajoutée dans `/admin` (phase 23).
