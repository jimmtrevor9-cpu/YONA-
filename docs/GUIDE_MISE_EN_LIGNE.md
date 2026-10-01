# YONA — Guide de mise en ligne

1er octobre 2026 · Hébergement : Vercel · Base : Supabase (projet `ahljepryelikxepfpnuq`)

## Ce qui manque, expliqué simplement

Le site est construit et testé. Ta base Supabase est créée (tu as exécuté le code SQL). Il reste à mettre le site en ligne sur **Vercel** et à le « brancher » sur tes vrais comptes. C'est comme une voiture neuve : elle est finie, mais il faut encore mettre l'essence et les clés.

| À faire | Pourquoi | Temps estimé |
| --- | --- | --- |
| 1. Fusionner le code sur GitHub | Pour que Vercel reçoive tout le travail | 5 min |
| 2. Mettre le site sur Vercel avec ses clés | Pour que le site soit en ligne et parle à ta base, à Stripe et à l'IA | 20 min |
| 3. Brancher Stripe | Pour recevoir de vrais paiements (Premium, déblocage 1 USD) | 30 min |
| 4. Régler les e-mails et l'adresse du site | Pour que les liens « mot de passe oublié » marchent et soient en français | 15 min |
| 5. Te nommer administrateur | Pour ouvrir l'espace /admin | 5 min |
| 5 bis. Activer la connexion Google | Pour que le bouton « Continuer avec Google » marche | 20 min |
| 6. Tester le site en ligne | Pour vérifier en vrai avant d'ouvrir au public | 30 min |

Fais les étapes dans l'ordre. Si tu bloques sur une étape, envoie-moi une capture d'écran : je te guide.

## Étape 1 : fusionner le code sur GitHub

Tout mon travail est dans une « demande de fusion » (Pull Request n°1). La fusionner, c'est l'ajouter à la version principale du projet, celle que Vercel va mettre en ligne.

1. Va sur [github.com/jimmtrevor9-cpu/YONA-/pull/1](https://github.com/jimmtrevor9-cpu/YONA-/pull/1) et connecte-toi.
2. En bas de la page, clique sur le bouton vert **Merge pull request**, puis sur **Confirm merge**.

- [ ] Pull Request fusionnée

## Étape 2 : mettre le site sur Vercel avec ses clés

Le projet est déjà prêt pour Vercel (fichier `vercel.json` : installation avec `npm install`, construction avec `npm run build`). Rien à changer dans le code.

1. Crée un compte sur [vercel.com](https://vercel.com) avec ton compte GitHub.
2. Clique sur **Add New… → Project**, choisis le dépôt **YONA-**, puis **Import**.
3. Ne change pas les réglages de construction. Ouvre **Environment Variables** et ajoute chaque ligne du tableau ci-dessous (le nom à gauche, la valeur à droite).
4. Clique sur **Deploy**. Après 2 à 3 minutes, Vercel te donne l'adresse du site (par exemple `https://yona-xxx.vercel.app`). Tu pourras brancher ton propre nom de domaine plus tard dans **Settings → Domains**.

Une clé secrète est comme un mot de passe que le site utilise pour parler à un autre service. On ne la met jamais dans le code : on la range dans les variables de Vercel. Ne la partage avec personne (même pas avec moi).

| Nom de la variable | Valeur | Obligatoire |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://ahljepryelikxepfpnuq.supabase.co` | Oui |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_jF5khMl8SFnLi2cYW7nUbA_QFchkhaS` | Oui |
| `VITE_SUPABASE_PROJECT_ID` | `ahljepryelikxepfpnuq` | Oui |
| `SUPABASE_URL` | `https://ahljepryelikxepfpnuq.supabase.co` | Oui |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_jF5khMl8SFnLi2cYW7nUbA_QFchkhaS` | Oui |
| `SUPABASE_PROJECT_ID` | `ahljepryelikxepfpnuq` | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → clé **secrète** (service\_role ou `sb_secret_…`). SECRÈTE | Oui |
| `APP_URL` | L'adresse de ton site Vercel, par exemple `https://yona-xxx.vercel.app` | Oui |
| `PAYMENT_PROVIDER` | Écris simplement `stripe` | Pour les paiements |
| `STRIPE_SECRET_KEY` | Étape 3. SECRÈTE | Pour les paiements |
| `STRIPE_WEBHOOK_SECRET` | Étape 3. SECRÈTE | Pour les paiements |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key. SECRÈTE | Pour Roi Salomon et l'Ice Breaker IA |

Les 6 premières valeurs sont publiques (elles sont visibles dans le navigateur de tout visiteur) : ce n'est pas grave. Les autres sont secrètes.

Important : **après chaque ajout ou changement de variable, refais un déploiement** (onglet **Deployments → ⋯ → Redeploy**), sinon le site garde les anciennes valeurs.

Sans `ANTHROPIC_API_KEY`, le site marche quand même : Roi Salomon affiche simplement « pas encore disponible ». La clé Anthropic est payante à l'usage : pense à fixer une limite de dépenses dans la console.

- [ ] Site en ligne sur Vercel
- [ ] Clé secrète Supabase ajoutée
- [ ] Clé Anthropic ajoutée (facultatif)

## Étape 3 : brancher le paiement Stripe

Stripe encaisse l'argent par carte bancaire et le verse sur ton compte. Commence en **mode test** (faux argent), puis passe en réel quand tout marche.

1. Crée un compte sur [stripe.com](https://stripe.com). Stripe demandera tes informations d'entreprise et ton compte bancaire pour les vrais paiements.
2. Active le **mode test** (bouton en haut de la page Stripe).
3. Va dans **Développeurs → Clés API**. Copie la « clé secrète » (elle commence par `sk_test_`) dans la variable `STRIPE_SECRET_KEY` de Vercel.
4. Va dans **Développeurs → Webhooks → Ajouter un endpoint**. Un webhook, c'est Stripe qui prévient ton site : « ce paiement est réussi ».
   - Adresse : `https://TON-SITE/api/stripe-webhook`
   - Événement à cocher : `checkout.session.completed`
5. Sur la page du webhook, copie le « secret de signature » (il commence par `whsec_`) dans la variable `STRIPE_WEBHOOK_SECRET` de Vercel.
6. Mets `PAYMENT_PROVIDER` = `stripe` dans Vercel, puis refais un déploiement (Redeploy).
7. Fais un paiement d'essai avec la carte de test Stripe `4242 4242 4242 4242` (date future, code 123) : le Premium doit s'activer.
8. Quand tout marche, refais les étapes 3 à 5 en **mode réel** (clé `sk_live_`, nouveau webhook, nouveau secret).

Prix déjà réglés dans le code : Premium 5 USD par mois ou 35 USD par an, déblocage 1 USD pour 3 jours.

- [ ] Paiement de test réussi
- [ ] Clés réelles installées

## Étape 4 : régler les e-mails et l'adresse du site

Quand quelqu'un s'inscrit ou oublie son mot de passe, il reçoit un e-mail avec un lien. Ce lien doit renvoyer vers ton vrai site, et l'e-mail doit être en français.

Ces réglages sont dans Supabase → **Authentication**.

1. **URL Configuration** : mets l'adresse de ton site Vercel dans *Site URL* (par exemple `https://yona-xxx.vercel.app`), et ajoute `https://yona-xxx.vercel.app/**` dans *Redirect URLs*. Si tu branches plus tard ton propre nom de domaine, ajoute-le aussi.
2. **Email Templates → Reset password** :
   - Sujet : `Réinitialisez votre mot de passe YONA`
   - Contenu : copie tout le fichier `supabase/templates/reinitialisation-mot-de-passe.html` (il est dans le ZIP).
3. Laisse activée la **confirmation de l'adresse e-mail** à l'inscription.
4. Conseillé : Supabase n'envoie qu'un petit nombre d'e-mails par heure avec son service de base. Pour un vrai lancement, branche un service d'e-mail (par exemple Resend ou Brevo) dans **Authentication → SMTP Settings**.

- [ ] Adresse du site réglée
- [ ] E-mail « mot de passe oublié » en français

## Étape 5 : te nommer administrateur

L'espace /admin (membres, signalements, photos à valider, paiements) n'est ouvert qu'aux administrateurs. Personne ne l'est au départ, pour des raisons de sécurité.

1. Inscris-toi sur ton site en ligne avec ton adresse e-mail, comme un membre normal.
2. Dans Supabase, ouvre le **SQL Editor** (l'endroit où l'on tape des commandes pour la base).
3. Colle cette commande en remplaçant l'adresse par la tienne, puis clique sur **Run** :

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'ton-adresse@exemple.com';
```

4. Recharge le site : un lien **Administration** apparaît sur ta page Profil.

Important : les photos des membres restent « en attente » jusqu'à ce qu'un administrateur les valide dans /admin → Photos. Pense à y passer chaque jour.

- [ ] Lien Administration visible

## Étape 5 bis : activer la connexion Google

Le bouton Google est déjà dans le site. Tant que Google n'est pas activé, il affiche : « La connexion avec Google n'est pas encore activée. Utilisez votre e-mail. »

1. Va sur <https://console.cloud.google.com>, crée un projet (par exemple « YONA »).
2. **API et services → Écran de consentement OAuth** : type « Externe », nom « YONA », ton e-mail, puis enregistre.
3. **API et services → Identifiants → Créer des identifiants → ID client OAuth** :
   - Type : « Application Web ».
   - URI de redirection autorisés : `https://TON-ID-SUPABASE.supabase.co/auth/v1/callback` (Supabase t'affiche cette adresse exacte dans l'écran Google de l'étape 4).
4. Copie l'**ID client** et le **Code secret**, puis colle-les dans Supabase → **Authentication → Providers → Google** et active Google.
5. Teste : sur ton téléphone, ouvre `/register`, touche le bouton Google, remplis les étapes, choisis ton compte Google : tu dois arriver sur Découvrir avec ton profil créé.

Ces deux codes Google ne vont jamais dans le code ni dans le fichier `.env` : seulement dans Supabase.

- [ ] Bouton Google qui marche

## Étape 6 : tester le site en ligne avant d'ouvrir

Fais ce parcours avec deux comptes (par exemple toi et un proche), sur téléphone. Coche chaque ligne qui marche ; si une ligne ne marche pas, envoie-moi une capture d'écran.

- [ ] Inscription en 4 étapes, e-mail de confirmation reçu, profil créé tout seul
- [ ] Inscription avec Google
- [ ] Profil complet avec photo, photo validée dans /admin
- [ ] Chaque compte voit l'autre dans Découvrir
- [ ] Like réciproque : un Match apparaît
- [ ] 3 messages gratuits, puis le 4e est bloqué
- [ ] Un numéro de téléphone dans un message est refusé
- [ ] Déblocage 1 USD (paiement de test) : messages illimités
- [ ] Premium (paiement de test) : badge doré et avantages actifs
- [ ] Roi Salomon répond (si la clé Anthropic est ajoutée)
- [ ] « Mot de passe oublié » : e-mail en français, le lien marche
- [ ] Bloquer et signaler depuis une conversation
- [ ] Le signalement apparaît dans /admin

Quand tout est coché en mode test, passe Stripe en mode réel (étape 3, point 8) et fais un vrai paiement de 1 USD pour vérifier. Tu peux ensuite ouvrir le site au public.

## Mises à jour futures de la base

Comme tu n'utilises plus Lovable, personne n'applique les changements de base tout seul. Si une future version du code ajoute un fichier dans `supabase/migrations/`, il faudra l'exécuter dans le **SQL Editor** de Supabase (je te le dirai à chaque fois).

## Plus tard : ce qui peut attendre

Ces points n'empêchent pas d'ouvrir le site, mais amélioreront l'expérience :

- **E-mails de notification** : aujourd'hui, les notifications s'affichent dans le site (la cloche), mais aucun e-mail n'est envoyé.
- **Paiement Mobile Money** : seul Stripe (carte bancaire) est prêt. Mobile Money demandera un autre prestataire.
- **Renouvellement automatique du Premium** : pour l'instant, on paie un mois ou un an à la fois.
- **Mentions légales, conditions d'utilisation et politique de confidentialité** : obligatoires pour un site public qui garde des données personnelles. Fais-les relire par un professionnel.
- **Notifications sur téléphone** et installation comme une application.
