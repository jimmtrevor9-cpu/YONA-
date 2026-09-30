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
| 16 | Ice Breaker | ✅ Terminé et testé (21/21 avec 17 et 18) |
| 17 | Message Flash | ✅ Terminé et testé |
| 18 | Compatibilité | ✅ Terminé et testé |
| 19 | Notifications | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 20 | Paramètres `/settings` | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 21 | Blocage | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 22 | Signalement | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 23 | Administration `/admin` | ✅ Terminé et testé (26/26) |
| 24 | Sécurité finale | ✅ Audit terminé (33/33) |
| 25 | Tests | 🔄 En cours : tous les tests relancés |
| 26 | Validation finale + README | ⏳ À faire |

## Tâche en cours

Phase 25 : relance de tous les tests (phases 0 à 24) sur la base locale.

## Prochaine action précise

1. Lire le résultat de la relance complète et corriger les échecs.
2. Phase 26 : `npx supabase db reset` (toutes les migrations sur une base vide), relancer
   l'audit phase 24, `npm run build`, `npx tsc --noEmit`, `npm run lint`.
3. ZIP final dans `/mnt/project-files/yona/` et bilan final.

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
- Lint : 0 erreur (7 avertissements dans des composants d'interface fournis par la
  bibliothèque). Les fichiers générés par Lovable sont exclus du contrôle.
- Les photos restent « en attente » tant qu'un admin ne les a pas validées (choix de la
  phase 1) : validation dans `/admin` → onglet Photos.
