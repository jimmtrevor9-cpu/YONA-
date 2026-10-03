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
| Bloquer, signaler, supprimer son compte | Aucune annonce sponsorisée |
| Vérification d'identité automatique (obligatoire pour voir les profils et écrire) | |
| Annonces sponsorisées (abonnés gratuits seulement) | |

**Inscription** (`/register`) : le compte d'abord (Google, avec choix du compte, ou e-mail +
mot de passe), puis redirection automatique vers la création du profil (`/onboarding`) en
4 étapes : « Crée ton profil » (photos, prénom, date de naissance, je suis / je cherche,
âge des profils), « Ta bio en 30 s » (puces → bio proposée), « Où es-tu ? » (pays, région et
ville du monde entier, listes liées avec recherche), « Reste au courant » (e-mails
d'actualité, bouton « Confirmer et créer mon profil »), puis les conditions (18 ans et
plus). Ensuite : « Vérifie ton identité » (`/verification`, voir plus bas), puis Découvrir
(bienvenue, 2e photo, position…). Le détail de la foi se complète dans Profil → « Ma foi et
mes attentes ».

**Profils de démonstration** : 40 profils (21 femmes, 19 hommes, 22 à 35 ans, un seul
prénom ; 4 par pays dans 8 pays d'Afrique francophone, 8 en France),
`profiles.is_virtual = true`, sans mot de passe, toujours marqués « Profil de
démonstration » (mention dans les CGU et la politique de confidentialité). Photos fournies
par le propriétaire du site : `public/demo-profils/` (39 photos ; le profil sans photo reste
caché tant qu'un administrateur ne lui en donne pas une dans `/admin` → Profils de démo).
Ils ne répondent pas, ne reçoivent ni message ni demande de contact. Chaque vrai membre qui
termine son profil en retire un (même pays, sinon le plus proche) : déclencheur SQL
`replace_virtual_profile_on_signup`. Données : `scripts/generate-virtual-profiles.mjs`.

**Découvrir** : la base ne renvoie que les profils du sexe recherché et dans la tranche d'âge
choisie (filtre fait côté serveur, jamais seulement dans le navigateur), dans un ordre
mélangé. Mise en page sur le modèle de la capture de référence (photo plein écran, Like /
Passer).

**Vérification d'identité** (`/verification`) : obligatoire pour voir les profils et écrire
(sinon, la base refuse : `identity_not_verified`). Le membre choisit : selfie, pièce
(carte d'identité, passeport, carte d'étudiant, carte scolaire) ou les deux, et coche le
consentement. Le selfie est pris **en direct** avec la caméra (pas depuis la galerie) : une
photo de face, puis une photo tête tournée à gauche ou à droite (consigne tirée au hasard,
contre les photos d'écran). Le serveur compare les visages (moteur open source
`@vladmandic/face-api` intégré, gratuit ; ou AWS Rekognition si `FACE_MATCH_PROVIDER=aws`)
avec les photos du profil et la pièce, puis décide seul : vérifié au-dessus du seuil
d'acceptation, refusé en dessous du seuil de refus (motif clair : pas de visage, image
floue, plusieurs visages…), sinon « en attente » pour l'équipe (`/admin` → Vérifications).
Les images sont supprimées dès la décision. Réglages (seuils, essais par jour, conservation)
dans `/admin` → Vérifications. Code : `src/features/verification/`.

**Annonces sponsorisées** : montrées seulement aux abonnés gratuits (jamais aux Premium ni
aux administrateurs), toujours marquées « Sponsorisé » : une carte toutes les N cartes dans
Découvrir, une bannière dans Matchs et Messages. Image ou vidéo (muette par défaut, lancée
seulement quand elle est visible, légère sur connexion lente). Ciblage par pays, sexe et
âge, dates, plafond par jour, priorité. Gestion et statistiques (vues, clics, taux de clic)
dans `/admin` → Publicités. Aucun cookie ni traceur tiers.

**Fichiers de la marque** : `public/brand/` (logo, images du slider), `public/videos/`
(vidéo de présentation), `public/geo/` (base géographique GeoNames, générée par
`scripts/generate-geo.mjs`). Pages légales : `/confidentialite`, `/cgu`,
`/mentions-legales`, `/cookies` (informations dans `src/lib/legal.ts`).

Espace **/admin** (rôle administrateur) : tableau de bord avec graphiques et période au
choix (heure, jour, semaine, mois, année ; inscriptions, connexions, membres actifs,
paiements, entonnoir d'inscription — profils de démonstration exclus), liste des membres
(tri, recherche, export CSV, fiche avec historique, localisation et suppression du compte),
journaux (connexions, inscriptions, paiements, activité, actions des administrateurs,
erreurs serveur, publicités, localisation ; export CSV), signalements, validation des
photos, vérifications, profils de démo, publicités, paiements, abonnements, déblocages,
support. Les journaux gardent l'adresse IP 12 mois au plus (`purge_old_logs`).

## 1. Installer en local

Il faut **Node.js 20 ou plus** et **npm**.

```sh
npm install          # utiliser npm (pas bun ni yarn)
cp .env.example .env # puis remplir .env (voir la section 3)
npm run dev          # ouvrir ensuite l'adresse affichée dans le terminal
```

## 2. Configurer Supabase

**Votre propre projet Supabase.** Les migrations ne s'appliquent pas toutes seules.

1. Créez un projet sur <https://supabase.com> (laissez la *Data API* activée).
2. Créez toute la base d'un coup : dans le SQL Editor, collez et exécutez
   `YONA_base_de_donnees_complete.sql` (à la racine : tables, fonctions, sécurité, droits,
   stockage, temps réel, tâches automatiques, réglages, pays, profils de démonstration).
   C'est l'état final des migrations, avec des droits d'accès écrits explicitement : il
   marche aussi sur les projets créés depuis mai 2026, qui n'ouvrent plus automatiquement
   les nouvelles tables à l'API. Il est **rejouable** (le relancer ne casse rien). Version
   découpée, si l'éditeur refuse un fichier aussi long :
   `supabase/nouvelle-base/parties/01_…sql` à `05_…sql`, dans l'ordre.
   Ces fichiers sont générés par `scripts/generate-base-complete.py` ; les régénérer après
   chaque nouvelle migration. (`npx supabase db push` applique les migrations une à une,
   mais sur un projet récent certaines tables resteraient fermées à l'API.)
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
| `FACE_MATCH_PROVIDER` | non | Moteur de vérification des visages : vide ou `local` = intégré, gratuit (conseillé) ; `aws` = Amazon Rekognition |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | si `aws` | **Secrets.** Utilisateur IAM limité à `rekognition:DetectFaces` et `rekognition:CompareFaces` |

Sur Vercel, la fonction serveur demande 60 secondes au plus (`vite.config.ts`) : une
vérification d'identité prend quelques secondes. Rien à régler de plus.

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

**Localisation des membres** (vrais membres) : la position retenue suit cet ordre, avec
repli automatique : 1) la position de l'appareil (GPS / Wi-Fi, avec l'accord du membre :
« Pour te montrer des personnes près de chez toi ») ; 2) la ville déclarée à l'étape
« Où es-tu ? » ; 3) l'adresse IP (en-têtes Vercel), seulement si le membre n'a déclaré aucun
pays. Le serveur trouve la ville (géocodage inverse) avec les positions GeoNames embarquées
dans son code (`src/features/location/data/`, générées par
`scripts/generate-geo-positions.mjs`) : aucun service extérieur. La base
(`profile_locations`, fonction `set_member_location`) garde la position retenue, compare à
chaque visite le pays de l'adresse IP et le fuseau horaire du navigateur
(`geo_timezones`, base IANA) et lève un drapeau « incohérence de localisation » (VPN
possible) visible dans `/admin` (fiche du membre, Journaux → Localisation). Rien n'est
bloqué automatiquement. Le pays retenu sert au retrait d'un profil de démonstration et au
ciblage des publicités. **Limites** : un VPN ne change pas la position de l'appareil, mais
un membre peut refuser de la partager ; sans elle, la ville déclarée fait foi, et l'IP
n'est qu'un indice (un VPN la change). Un membre peut aussi tromper son appareil (fausse
position GPS) : aucune méthode n'est fiable à 100 %. Les profils de démonstration gardent
leur propre ville (ils ne prennent pas celle du membre).

## 5. Organisation du code

```
src/routes/            pages (une par fichier) et /api/stripe-webhook
src/components/        composants réutilisables (ui/ = boutons, fenêtres, etc.)
src/features/<thème>/  logique par thème : requêtes, fonctions serveur (*.functions.ts),
                       code serveur uniquement (*.server.ts)
src/integrations/supabase/  clients Supabase et types (générés)
supabase/migrations/   toutes les migrations SQL (la vraie source de la base)
supabase/nouvelle-base/parties/  la base complète découpée en parties (copie de
                       YONA_base_de_donnees_complete.sql, pour un projet Supabase neuf)
drizzle/migrations/    copie des migrations au format drizzle-kit
docs/verification/     tests automatiques et rapports
```

## 6. Limites connues

- Le paiement réel (Stripe) et la vraie clé IA n'ont pas pu être testés ici : ils ont été
  testés avec un faux Stripe local et une IA simulée.
- Aucun service d'e-mail n'est branché : le choix « notifications par e-mail » est
  enregistré, mais aucun e-mail n'est envoyé.
- Premium = paiement unique (mensuel ou annuel), sans renouvellement automatique.
- Localisation : sans la position de l'appareil, un VPN peut fausser l'adresse IP ; elle
  n'est alors qu'un indice (drapeau dans l'administration), jamais une vérité.
- Reconnaissance faciale : elle n'est pas infaillible (éclairage, qualité de la caméra,
  photos anciennes, jumeaux). Le contrôle « tête tournée » arrête une photo imprimée ou un
  écran simple, pas une vidéo truquée élaborée. Les cas incertains vont à l'équipe. Le
  moteur local a été testé avec des visages de synthèse, pas avec de vraies personnes en
  grand nombre : surveiller les premiers résultats et ajuster les seuils dans `/admin`.
- AWS Rekognition est branché mais n'a pas pu être testé ici (pas de compte AWS).
- Les membres déjà inscrits avant cette version doivent vérifier leur identité pour
  continuer à voir les profils et à écrire.
- Données personnelles : registre des traitements dans
  [docs/REGISTRE_RGPD.md](docs/REGISTRE_RGPD.md).
