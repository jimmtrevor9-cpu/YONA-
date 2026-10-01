# Phase 5 — Étape 5.1 — Initialiser le compteur individuel

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

La table `conversation_user_usage` (un compteur par personne et par conversation, 0 à 3,
unique) existait mais aucun compteur n'était créé au Match. Les membres gardaient des
droits d'écriture directe (bloqués seulement par l'absence de règle RLS), et l'ancienne
fonction `consume_free_message` leur permettait d'augmenter leur compteur sans envoyer de
message (fonction non utilisée par l'application).

## Réalisation

- Migration `20260927140000_phase5_compteur_individuel.sql` (miroir
  `drizzle/migrations/0024_phase5_compteur_individuel.sql`) :
  - déclencheur `conversations_init_usage` : à la création d'une conversation (au
    Match), un compteur à 0 pour chacun des deux participants ;
  - conversations existantes : compteurs manquants créés à 0 ;
  - droits INSERT / UPDATE / DELETE sur les compteurs retirés aux membres ;
    `consume_free_message` n'est plus appelable par les membres.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 40 fonctions.
- Match défait puis refait : la même conversation est rouverte, les compteurs sont
  conservés (aucune remise à zéro possible par ce moyen).

- `src/features/monetization/quotas.ts` : fonction `consumeFreeMessage` retirée (jamais
  utilisée, désormais refusée par la base).
- Tests de la phase 0 adaptés : préparation de 0.6 et de `etape-0.1-backend-sql-tests.sql`
  (la conversation créée au Match est supprimée puis recréée avec un identifiant fixe, au
  lieu de changer son identifiant — refusé depuis que des compteurs y sont rattachés) ;
  0.7 vérifie désormais que `consume_free_message` est refusée aux membres ; le script
  SQL 0.1 l'appelle en rôle service et vérifie ce refus (T5b).

Aucun changement visible dans l'application à cette étape.

## Tests (`etape-5.1-compteur-individuel.mjs`) — 13/13

| Test | Résultat |
|---|---|
| Like sans retour : aucun compteur ; Match : 2 compteurs à 0 ; aucun pour un tiers ; toute conversation a ses 2 compteurs | ✅ ×4 |
| Lecture : son propre compteur seulement ; tiers et visiteur : rien | ✅ ×3 |
| Modifier / supprimer / créer un compteur ; ancienne fonction : refusés (403) | ✅ ×2 |
| Match défait puis refait : compteurs conservés ; limite 0–3 ; un seul compteur par personne | ✅ ×3 |
| Nettoyage | ✅ |

Première exécution : 11/13 — le test lisait mal le message d'erreur de la base (la base
refusait bien) ; lecture corrigée.

## Non-régression

Séries touchées par l'étape (base de données, Matchs, messagerie) : 0.5 : 24/24 ·
0.6 : 73/73 · 0.7 : 32/32 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 · 3.7 : 24/24 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 ; script SQL 0.1 : T1 à T18 conformes — aucun compte ni
fichier de test restant. (Phases 1 et 2 non concernées ; série complète prévue en fin de
phase 5.)

Premier passage : 0.6 arrêté (préparation qui changeait l'identifiant d'une conversation)
et 0.7 : 30/32 (appel de `consume_free_message`, désormais refusé ; nettoyage faussé par
l'arrêt de 0.6) — tests adaptés, voir ci-dessus.

Base réinstallée à zéro (26 migrations). Type-check : 0 erreur · Build : réussi ·
Lint : 1 092 (inchangé).
