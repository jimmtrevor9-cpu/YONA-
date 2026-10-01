# Phase 0 — Étape 0.1 — Vérifier le backend existant

Date : 2026-09-25 · Statut : **VALIDÉE** (vérification, aucune modification du code applicatif)

## Périmètre

Cette étape inventorie et teste le **backend existant** : runtime serveur, fonctions
serveur, clients Supabase, fonctions SQL. Les sujets suivants relèvent d'étapes
ultérieures et ne sont **pas** traités ici : projet Supabase connecté (0.2),
variables d'environnement (0.3), migrations (0.4), authentification (0.5),
politiques RLS (0.6), cohérence code/backend (0.7).

## Architecture backend constatée

| Couche | Élément | Rôle |
|---|---|---|
| Runtime | TanStack Start 1.168 + Nitro (cible Cloudflare Workers) | SSR + fonctions serveur |
| Entrée serveur | `src/server.ts` | Enveloppe SSR : page d'erreur 500 propre |
| Middlewares | `src/start.ts` | `errorMiddleware`, `csrfMiddleware` (fonctions serveur), `attachSupabaseAuth` (jeton Bearer ajouté côté client) |
| Auth serveur | `src/integrations/supabase/auth-middleware.ts` | `requireSupabaseAuth` : vérifie le JWT (`getClaims`), crée un client Supabase **soumis au RLS** au nom de l'utilisateur |
| Client admin | `src/integrations/supabase/client.server.ts` | Client `service_role` (contourne le RLS) — **défini mais utilisé nulle part** |
| Cron | `src/integrations/supabase/cron-auth.ts` | Vérification d'un secret Bearer — **défini mais utilisé nulle part** |
| Fonctions serveur | `src/features/profiles/likes.functions.ts` | **Unique** fonction serveur : `likeProfile` (POST, Zod, auth obligatoire) |
| Base de données | Supabase PostgreSQL | 21 tables, 21 fonctions SQL (20 `SECURITY DEFINER`, `search_path` fixé) |

Le reste de la logique métier passe par des appels directs du navigateur à
Supabase (`from(...)`, `rpc(...)`), protégés par RLS et fonctions SQL.

### Fonctions SQL (backend base de données)

- Rôles / accès : `has_role`, `is_admin`, `is_blocked_between`, `is_conversation_participant`, `is_premium`
- Provisionnement / protections (triggers) : `handle_new_user`, `protect_user_columns`, `protect_photo_status`, `protect_profile_status`, `enforce_photo_limit`, `set_updated_at`
- Quotas : `get_conversation_quota`, `consume_free_message`, `has_active_conversation_unlock`, `get_ai_quota`, `consume_ai_quota`
- Social / présence : `record_profile_visit`, `get_profile_visitors`, `get_favorited_by`, `get_presence`, `touch_activity`

### Modules backend présents mais non branchés dans l'interface

`features/monetization/quotas.ts`, `features/activity/presence.ts`,
`features/auth/roles.ts`, `features/messaging/policy.ts`,
`features/moderation/message-pipeline.ts` ne sont importés par aucune page.
Ils seront branchés aux étapes correspondantes du plan.

## Tests réalisés

### A. Serveur buildé (`etape-0.1-backend-smoke.mjs`, variables Supabase factices)

| Test | Résultat |
|---|---|
| `GET /`, `/login`, `/register`, `/forgot-password`, `/reset-password` | ✅ HTTP 200, HTML `lang="fr"` |
| `GET /discover` (route protégée, `ssr: false`) | ✅ HTTP 200 (coquille ; la redirection vers `/login` se fait côté client) |
| `GET /route-inexistante` | ✅ HTTP 404 |
| `likeProfile` sans jeton | ✅ refusé : `Unauthorized: No authorization header provided` |
| `likeProfile` jeton mal formé | ✅ refusé : `Unauthorized: Invalid token` |
| `likeProfile` JWT falsifié | ✅ refusé : `Unauthorized: Invalid token` |
| `likeProfile` requête cross-site | ✅ HTTP 403 (CSRF) |
| `likeProfile` en GET | ✅ HTTP 405 |

### B. Fonctions SQL (`etape-0.1-backend-sql-tests.sql`, PostgreSQL 16 local jetable)

| Test | Résultat |
|---|---|
| T1 Inscription → création users/profiles/christian_profiles/preferences/user_activity/rôle `user` | ✅ |
| T2 Prénom vide → `NULL` | ✅ |
| T3 `is_premium` (abonnement actif / absent) | ✅ |
| T4 `has_role` / `is_admin` | ✅ |
| T5–T7 Quota conversation : 3 messages autorisés, 4ᵉ refusé (`free_limit_reached`) | ✅ |
| T8 Quota de l'autre participant indépendant | ✅ |
| T9 Non-participant refusé (`not_participant`) | ✅ |
| T10 IA gratuit : 3 questions puis `quota_exceeded` | ✅ |
| T11 IA Premium : illimité | ✅ |
| T12 Visites : anti-spam 1 h et pas d'auto-visite | ✅ |
| T13–T14 Visiteurs : 0 pour gratuit, visibles pour Premium | ✅ |
| T15 Présence `online` après `touch_activity` | ✅ |
| T16 Photo insérée par l'utilisateur forcée à `pending` | ✅ |
| T17 4ᵉ photo refusée en gratuit (`photo_limit_reached`) | ✅ |
| T18 Utilisateur ne peut modifier ni son statut ni son email | ✅ |
| T19 Appel direct de `handle_new_user` refusé | ✅ |
| T20 `anon` ne peut pas appeler `is_premium` | ✅ |

### C. Non testable dans cet environnement

- Chemin nominal de `likeProfile` avec un vrai compte : nécessite le projet Supabase
  réel (pas de credentials ici, et aucun faux compte ne doit y être créé). À vérifier
  manuellement dans Lovable avec un compte réel.
- Vérification de signature JWT contre les clés réelles du projet : même raison.

## Constats à traiter dans les étapes prévues (non corrigés ici)

1. `consume_free_message` est une RPC isolée, indépendante de l'enregistrement d'un
   message : l'envoi devra passer par une seule fonction serveur (Phases 4 à 6).
2. `canSendMessage` et `moderateMessage` sont du TypeScript côté client : la
   protection téléphone devra être appliquée côté serveur (Phase 6, étape 6.10).
3. `get_presence` est accessible à tout utilisateur connecté (Premium requis : 10.5).
4. `is_premium`, `is_blocked_between`, `has_active_conversation_unlock` acceptent
   n'importe quel identifiant (à revoir en 0.6 / 24.12).
5. La page d'erreur serveur (`src/lib/error-page.ts`) est en anglais.
6. Migrations : la migration `20260917210826` recrée le schéma de la Phase 1 → à
   traiter à l'étape 0.4.
