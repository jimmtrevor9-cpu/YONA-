# Phase 0 — Étape 0.6 — Vérifier les RLS

Date : 2026-09-25 · Statut : **VALIDÉE**

## Méthode

Tests d'attaque via l'API réelle (PostgREST + Storage) d'un Supabase local, en se
faisant passer pour 5 comptes de test (A, B, C, D, admin E) et pour un visiteur
anonyme : `etape-0.6-rls-tests.mjs` (73 tests). Comptes supprimés à la fin.

## Problèmes trouvés (avant correction)

| # | Problème | Gravité |
|---|---|---|
| 1 | Profils, profils chrétiens et photos des autres membres **invisibles** (la règle lisait `public.users`, limité par RLS à sa propre ligne) → découverte toujours vide, **Like toujours refusé** | Bloquant |
| 2 | Suppression d'un compte (`auth.users`) : fiche YONA conservée (profil encore « actif ») | Élevée |
| 3 | Like existant redirigeable vers un autre membre, même un membre ayant bloqué l'auteur | Moyenne |
| 4 | Photo déclarable avec un fichier du dossier d'un autre membre | Moyenne |
| 5 | Présence « en ligne » falsifiable par écriture directe dans `user_activity` | Faible |
| 6 | Fonctions révélant des infos sur d'autres membres : blocages entre tiers (`is_blocked_between`), rôle admin (`has_role`), déblocage d'une conversation (`has_active_conversation_unlock`), participation (`is_conversation_participant`) | Moyenne |
| 7 | Droits techniques par défaut de Supabase : tous droits pour `anon`, `TRUNCATE`/`TRIGGER`/`REFERENCES` pour `authenticated` | Défense en profondeur |

## Correction : `supabase/migrations/20260925130000_phase0_corrections_rls.sql`

1. Fonctions `is_active_account` et `is_discoverable_profile` (SECURITY DEFINER) ;
   4 règles réécrites (`profiles_select_visible`, `christian_select_visible`,
   `photos_select_visible`, `photos_storage_select`). Critères de visibilité inchangés.
2. Clé étrangère `public.users.id → auth.users.id ON DELETE CASCADE` (toute la fiche suit).
3. Déclencheur `likes_protect_parties` (auteur/destinataire immuables) + contrôle de blocage à la mise à jour.
4. Contrainte `photos_path_in_owner_folder` : le fichier est dans le dossier de son propriétaire.
5. `user_activity` : écriture directe retirée ; la présence passe par `touch_activity()`.
6. Les 4 fonctions ne répondent que sur soi-même (ou pour un admin / le serveur).
   Les règles les appellent toujours avec `auth.uid()` : comportement inchangé.
7. `REVOKE ALL … FROM anon` ; `REVOKE TRUNCATE, REFERENCES, TRIGGER … FROM authenticated`.

Migration rejouable (testée 2 fois de suite sans erreur).

## Résultats (après correction) — 73/73

- Anonyme : aucune ligne lisible dans les 21 tables, écriture et fonctions refusées.
- Lecture : chaque membre ne voit que ses données privées ; profils visibles = actifs,
  visibles, non bloqués ; Likes reçus invisibles ; conversations et messages réservés
  aux participants ; messages bloqués invisibles du destinataire.
- 19 écritures frauduleuses refusées (Match, conversation, message direct, Premium,
  paiement, déblocage, rôle admin, modération, visite, quotas, favoris/Likes/blocages/
  signalements au nom d'un autre, Like vers un membre qui a bloqué…).
- 8 modifications/suppressions des données d'autrui sans effet.
- Colonnes protégées : email/statut du compte, statut des photos.
- Failles 3 à 6 : toutes refusées.
- Stockage : écriture limitée à son dossier ; photo approuvée visible ; photo en
  attente, photo d'un membre bloquant et accès anonyme refusés.
- Admin : voit tous les comptes, peut enregistrer une modération, ne peut pas attribuer
  de rôle via l'API.

## Non-régression

- Tests SQL de l'étape 0.1 : conformes (chemins de photos mis au format `<id>/fichier`).
- Parcours d'authentification de l'étape 0.5 : 24/24.
- Like de bout en bout via l'application : **enregistré en base** (échouait avant).
- Suppression de compte : 0 fiche restante.

## À savoir

- Le miroir `drizzle/migrations` n'est pas mis à jour (non utilisé pour Supabase).
- `src/integrations/supabase/types.ts` (généré par Lovable) ne liste pas encore
  les 2 nouvelles fonctions ; elles ne sont pas appelées par l'interface.
- Un membre peut encore passer lui-même son profil en « actif » sans terminer
  l'onboarding → étape 1.15. La présence est visible sans Premium → étape 10.5.
