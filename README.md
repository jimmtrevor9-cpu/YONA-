# YONA — Rencontres chrétiennes

Application de rencontre chrétienne (modèle Tinder / Meetic), en français, pensée d'abord
pour le mobile.

- **Technique** : React 19, TypeScript strict, TanStack Start (pages + fonctions serveur),
  TanStack Query, Tailwind, Supabase (base PostgreSQL, connexion, stockage, temps réel).
- **Sécurité** : toutes les règles importantes (quotas, Premium, paiements, blocage,
  administration) sont vérifiées **dans la base** (RLS + fonctions SQL), jamais seulement
  dans le navigateur.
- **Suivi du projet** : [PROGRESS.md](PROGRESS.md). Rapports de test : `docs/verification/`.

## Fonctionnalités

| Pour tous | Premium |
|---|---|
| Inscription rapide en 4 étapes (e-mail ou Google), profil chrétien, photos (3), Découvrir, Like / Pass, Match | Messages illimités, messages vocaux |
| Messagerie : 3 messages gratuits par conversation, déblocage à 1 USD (3 jours) | 10 photos HD, Boost du profil (1 h par semaine) |
| Protection contre l'échange de numéros de téléphone | Voir qui m'a mis en favori et qui a visité mon profil |
| Favoris, visites, recherche, demandes de contact (5 par jour) | Demandes et Roi Salomon illimités, Message Flash |
| Roi Salomon (conseiller IA, quota quotidien), Ice Breaker | Ice Breaker personnalisé par l'IA, détail de compatibilité |
| Score de compatibilité, notifications, paramètres | Filtres avancés, support prioritaire, badge doré |
| Bloquer, signaler, supprimer son compte | |

**Inscription** (`/register`) : le compte d'abord (Google, avec choix du compte, ou e-mail +
mot de passe), puis redirection automatique vers la création du profil (`/onboarding`) en
4 étapes : « Crée ton profil » (photos, prénom, date de naissance, je suis / je cherche,
âge des profils), « Ta bio en 30 s » (puces → bio proposée), « Où es-tu ? » (pays, région et
ville du monde entier, listes liées avec recherche), « Reste au courant » (e-mails
d'actualité, bouton « Confirmer et créer mon profil »), puis les conditions (18 ans et
plus). Ensuite : « Vérifie ton profil » (`/verification` : selfie express ou pièce
d'identité, stockage privé), puis Découvrir (bienvenue, 2e photo, position…). Le détail de
la foi se complète dans Profil → « Ma foi et mes attentes ».

**Profils virtuels** : 675 profils d'exemple (25 par pays, 27 pays francophones),
`profiles.is_virtual = true`, sans photo ni mot de passe. Chaque vrai membre qui termine son
profil en retire un (même pays, sinon le plus proche) : déclencheur SQL
`replace_virtual_profile_on_signup`. Données : `scripts/generate-virtual-profiles.mjs`.

**Fichiers de la marque** : `public/brand/` (logo, images du slider), `public/videos/`
(vidéo de présentation), `public/geo/` (base géographique GeoNames, générée par
`scripts/generate-geo.mjs`). Pages légales : `/confidentialite`, `/cgu`,
`/mentions-legales`, `/cookies` (informations dans `src/lib/legal.ts`).

Espace **/admin** (rôle administrateur) : tableau de bord, membres (suspendre, réactiver,
bannir), signalements, validation des photos, paiements, abonnements, déblocages, support.

## 1. Installer en local

Il faut **Node.js 20 ou plus** et **npm**.

```sh
npm install          # utiliser npm (pas bun ni yarn)
cp .env.example .env # puis remplir .env (voir la section 3)
npm run dev          # ouvrir ensuite l'adresse affichée dans le terminal
```

## 2. Configurer Supabase

**Votre propre projet Supabase** (choix actuel : projet `ahljepryelikxepfpnuq`). Les
migrations ne s'appliquent pas toutes seules : exécutez chaque nouveau fichier de
`supabase/migrations/` dans le SQL Editor, ou utilisez la commande ci-dessous.

1. Créez un projet sur <https://supabase.com>.
2. Appliquez toutes les migrations (tables, sécurité, fonctions, stockage) :
   ```sh
   npx supabase link --project-ref <ID_DU_PROJET>
   npx supabase db push
   ```
3. Dans Supabase → *Authentication* : activez la connexion par e-mail et mettez l'adresse
   de votre site dans *Site URL* et *Redirect URLs*.
4. **Connexion Google** (bouton « Continuer avec Google ») : dans Supabase →
   *Authentication → Providers → Google*, activez Google et collez l'identifiant client
   et le secret créés dans Google Cloud (*API et services → Identifiants → ID client
   OAuth*, type « Application Web », URI de redirection autorisée :
   `https://<ID_DU_PROJET>.supabase.co/auth/v1/callback`). Aucune clé Google dans `.env`.
5. Créez le premier administrateur (après son inscription dans l'application), dans
   Supabase → *SQL Editor* :
   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'vous@exemple.com';
   ```
6. Pour les tâches automatiques (fin des déblocages et des abonnements), l'extension
   `pg_cron` doit être activée (elle l'est sur Supabase). Sans elle, tout reste exact :
   les dates de fin sont toujours vérifiées.

Plus de détails : [docs/CONNECTER_UNE_BASE_SUPABASE.md](docs/CONNECTER_UNE_BASE_SUPABASE.md).

Pour une base locale (tests) : `npx supabase start` (Docker nécessaire).

## Mise en ligne sur Vercel

Le projet est prêt pour Vercel (`vercel.json` : `npm install` puis `npm run build` ; la
construction détecte Vercel et produit une fonction serveur Node 22). Importez le dépôt
GitHub dans Vercel, ajoutez les variables de la section 3 dans *Settings → Environment
Variables*, puis déployez. Pas à pas détaillé : [docs/GUIDE_MISE_EN_LIGNE.md](docs/GUIDE_MISE_EN_LIGNE.md).

## 3. Variables d'environnement

Le modèle complet et commenté est dans [.env.example](.env.example). **Aucune clé secrète
n'est écrite dans le code.** Tout ce qui commence par `VITE_` est visible par les visiteurs.

| Variable | Obligatoire | Rôle |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | oui | Accès public à Supabase (navigateur) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | oui | Mêmes valeurs, côté serveur |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | **Secret.** Confirmation des paiements, suppression de compte, bannissement, détection de numéros |
| `PAYMENT_PROVIDER` | non | Vide = paiement désactivé ; `stripe` = paiement réel ; `test` = faux paiement (tests seulement) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | si Stripe | **Secrets.** Webhook à déclarer chez Stripe : `https://VOTRE-SITE/api/stripe-webhook`, événement `checkout.session.completed` |
| `APP_URL` | non | Adresse publique du site (retour après paiement) |
| `ANTHROPIC_API_KEY` | non | **Secret.** Active Roi Salomon et l'Ice Breaker personnalisé (Claude) |
| `AI_MODEL` | non | Modèle Claude (par défaut `claude-opus-5-5`) |
| `AI_PROVIDER` | non | `test` = réponses IA fixes (tests seulement) |

## 4. Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Lancer l'application en développement |
| `npm run build` | Construire la version de production |
| `npm run preview` | Tester la version construite |
| `npm run lint` | Vérifier le code (ESLint + Prettier) |
| `npx tsc --noEmit` | Vérifier les types TypeScript |

### Tests automatiques

Chaque phase a un script dans `docs/verification/phase-N/` et un rapport `.md`. Ils
tournent contre une base Supabase **locale** et l'application construite :

```sh
npx supabase start
SUPABASE_SERVICE_ROLE_KEY=<clé service locale> bash docs/verification/outils/demarrer-test-local.sh
SUPABASE_SERVICE_ROLE_KEY=<clé service locale> PLAYWRIGHT_ROOT="$(npm root -g)" \
  node docs/verification/phase-24/etapes-24.1-a-24.13-audit-securite.mjs
```

(Playwright doit être installé : `npm i -g playwright`.)

Réglages de la base locale utilisés par les tests (dans `supabase/config.toml` du dossier
local) : `site_url = "http://127.0.0.1:4173"`, `enable_confirmations = true`,
`max_frequency = "60s"`, et le modèle d'e-mail
`supabase/templates/reinitialisation-mot-de-passe.html` pour `[auth.email.template.recovery]`.

## 5. Organisation du code

```
src/routes/            pages (une par fichier) et /api/stripe-webhook
src/components/        composants réutilisables (ui/ = boutons, fenêtres, etc.)
src/features/<thème>/  logique par thème : requêtes, fonctions serveur (*.functions.ts),
                       code serveur uniquement (*.server.ts)
src/integrations/supabase/  clients Supabase et types (générés)
supabase/migrations/   toutes les migrations SQL (la vraie source de la base)
drizzle/migrations/    copie des migrations au format drizzle-kit
docs/verification/     tests automatiques et rapports
```

## 6. Limites connues

- Le paiement réel (Stripe) et la vraie clé IA n'ont pas pu être testés ici : ils ont été
  testés avec un faux Stripe local et une IA simulée.
- Aucun service d'e-mail n'est branché : le choix « notifications par e-mail » est
  enregistré, mais aucun e-mail n'est envoyé.
- Premium = paiement unique (mensuel ou annuel), sans renouvellement automatique.
