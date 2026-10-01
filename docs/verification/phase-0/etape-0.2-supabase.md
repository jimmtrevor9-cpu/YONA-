# Phase 0 — Étape 0.2 — Vérifier le projet Supabase connecté

Date : 2026-09-25 · Statut : **VALIDÉE**

## Décision du propriétaire du projet

La base Supabase actuelle (`gzqgzdlqoyoomabghygj`, Lovable Cloud) ne contient aucun
utilisateur et **sera remplacée plus tard par une autre base**. L'objectif de cette
étape devient donc : vérifier que le projet est prêt à être branché sur
n'importe quel projet Supabase, par simple configuration.

## Vérifications statiques

| Test | Résultat |
|---|---|
| Identifiant du projet cohérent (`config.toml` = `.env`, variables serveur = `VITE_*`) | ✅ |
| Aucune clé secrète dans le `.env`, seulement la clé publique | ✅ |
| Aucune adresse de projet écrite en dur dans le code source | ✅ (uniquement `config.toml` et `.env`) |
| `types.ts` : 21 tables attendues (fondations Phases 1 et 2) | ✅ |

## Vérification en conditions réelles (Supabase local complet)

Supabase local lancé avec la CLI officielle (`supabase start`, v2.118.0) :
PostgreSQL, authentification (GoTrue v2.197.0), REST, stockage. Aucune donnée réelle.

| Test | Résultat |
|---|---|
| API d'authentification joignable | ✅ HTTP 200 |
| Inscription + connexion d'un compte de TEST local (`test-local-a@example.test`) | ✅ jeton obtenu |
| Build de l'application avec les seules variables du projet local | ✅ build OK, aucune référence à l'ancien projet dans le bundle |
| Fonction serveur `likeProfile` avec le vrai jeton du projet local | ✅ authentification acceptée, requête transmise à la base (réponse : table `profiles` absente — attendu, migrations non appliquées → étape 0.4) |
| Fonction serveur avec un jeton falsifié (signature modifiée) | ✅ refusé : `Unauthorized: Invalid token` |

## Base actuelle Lovable Cloud

Les requêtes vers la base de production actuelle ont été bloquées par les
permissions de l'environnement. Sans objet puisque cette base sera remplacée.

## Livrable

`docs/CONNECTER_UNE_BASE_SUPABASE.md` : guide pour brancher la future base.
