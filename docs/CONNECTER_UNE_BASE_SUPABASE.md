# Brancher YONA sur une nouvelle base Supabase

Le code de YONA ne contient **aucune adresse de base de données écrite en dur**.
Le projet Supabase est choisi uniquement par configuration. Pour passer à une
nouvelle base, il suffit de changer les réglages ci-dessous.

## 1. Les réglages à renseigner

| Variable | Où la trouver dans Supabase | Utilisée par |
|---|---|---|
| `VITE_SUPABASE_URL` | Project Settings → API → Project URL | navigateur |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → *Publishable key* | navigateur |
| `VITE_SUPABASE_PROJECT_ID` | Project Settings → General → Project ID | informatif |
| `SUPABASE_URL` | même valeur que `VITE_SUPABASE_URL` | serveur |
| `SUPABASE_PUBLISHABLE_KEY` | même valeur que `VITE_SUPABASE_PUBLISHABLE_KEY` | serveur |
| `SUPABASE_PROJECT_ID` | même valeur que `VITE_SUPABASE_PROJECT_ID` | informatif |

Modèle : fichier `.env.example` à la racine. Mettre `project_id` à jour dans
`supabase/config.toml`.

⚠️ Ne jamais mettre la clé secrète (`sb_secret_…` / `service_role`) dans une
variable `VITE_…` : tout ce qui commence par `VITE_` est visible dans le navigateur.

## 2. Avec Lovable Cloud

Lovable gère ces variables automatiquement lorsqu'une base est connectée au projet.

## 3. Création des tables (migrations)

Toutes les tables, règles de sécurité, fonctions et le stockage `photos` sont créés
par les fichiers de `supabase/migrations/`, appliqués **dans l'ordre**
(vérifié à l'étape 0.4 sur une base Supabase vide) :

- **Avec Lovable Cloud** : les migrations sont appliquées automatiquement.
- **Avec la CLI Supabase** (autre projet) :
  ```sh
  npx supabase link --project-ref <ID_DU_PROJET>
  npx supabase db push
  ```

Résultat attendu : 21 tables (toutes protégées par RLS), 30 fonctions, 65 règles
d'accès, bucket `photos` privé (JPG, PNG, WebP, 5 Mo max) avec 4 règles d'accès.

## 4. Réglages de l'authentification (Supabase → Authentication)

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Email provider | activé | inscription / connexion par email |
| Confirm email | **activé** | l'écran « Consultez votre boîte mail » s'affiche après l'inscription |
| Minimum password length | **8** | aligné sur les formulaires de YONA |
| Site URL | adresse du site (ex. `https://votre-domaine`) | liens des emails |
| Redirect URLs | `https://votre-domaine/login`, `https://votre-domaine/reset-password` | confirmation et mot de passe oublié |

### Email « mot de passe oublié » en français

Par défaut, Supabase envoie cet email en anglais. Modèle YONA prêt à l'emploi :
`supabase/templates/reinitialisation-mot-de-passe.html`.

- **Tableau de bord Supabase** : Authentication → Email Templates → *Reset Password* :
  sujet `Réinitialisez votre mot de passe YONA`, puis coller le contenu du fichier.
- **CLI Supabase** (`config.toml`) :
  ```toml
  [auth.email.template.recovery]
  subject = "Réinitialisez votre mot de passe YONA"
  content_path = "./supabase/templates/reinitialisation-mot-de-passe.html"
  ```

Délai entre deux emails (réglage *Email rate limits* / `max_frequency`) : 60 s
recommandé. YONA affiche alors « Pour votre sécurité, patientez N secondes… ».

## 5. Vérification réalisée (étape 0.2)

Testé avec un Supabase local complet (`supabase start`) : l'application buildée
avec uniquement ces variables se connecte au projet choisi, l'authentification
accepte un vrai jeton de ce projet et refuse un jeton falsifié.
