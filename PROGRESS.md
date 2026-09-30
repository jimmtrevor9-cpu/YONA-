# YONA — Suivi de progression

Dernière mise à jour : 2026-09-30

## État des phases

| Phase | Sujet | État |
|---|---|---|
| 0 à 11 | Environnement, inscription, Découvrir, Like/Pass, Match, messages, quota 3 messages, numéros, déblocage 1 USD, favoris, visites, présence, recherche | ✅ Terminé (travail précédent) |
| 12 | Demandes de contact | ✅ Terminé (12.1 avant, 12.2 à 12.6 le 2026-09-30) |
| 13 | Roi Salomon | ⏳ À faire |
| 14 | Premium (page, paiement, badge, expiration) | ⏳ À faire |
| 15 | Avantages Premium | ⏳ À faire |
| 16 | Ice Breaker | ⏳ À faire |
| 17 | Message Flash | ⏳ À faire |
| 18 | Compatibilité | ⏳ À faire |
| 19 | Notifications | ⏳ À faire |
| 20 | Paramètres `/settings` | ⏳ À faire |
| 21 | Blocage | ⏳ À faire |
| 22 | Signalement | ⏳ À faire |
| 23 | Administration `/admin` | ⏳ À faire |
| 24 | Sécurité finale | ⏳ À faire |
| 25 | Tests | ⏳ À faire |
| 26 | Validation finale + README | ⏳ À faire |

## Tâche en cours

Phase 13 — Roi Salomon (page, champ de question, envoi, quota 3/jour, fournisseur IA).

## Prochaine action précise

Créer la migration `supabase/migrations/20260930110000_phase13_roi_salomon.sql`
(remboursement du quota si l'IA échoue), puis la fonction serveur
`src/features/ai/roi-salomon.functions.ts` et la page `src/routes/_authenticated/roi-salomon.tsx`.

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

## Problèmes connus

- Paiement réel : pas encore choisi par le propriétaire (question posée : Stripe ou
  Mobile Money). En attendant : prestataire « test » (sans argent réel).
- Lint : ~1 200 erreurs de mise en forme, presque toutes dans des fichiers générés
  automatiquement (`src/integrations/supabase/*`). À traiter en phase 26.
- Les photos restent « en attente » tant qu'un admin ne les a pas validées (choix de la
  phase 1) : la modération des photos sera ajoutée dans `/admin` (phase 23).
