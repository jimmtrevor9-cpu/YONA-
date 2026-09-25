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

Résultat attendu : 21 tables (toutes protégées par RLS), 21 fonctions, 66 règles
d'accès, bucket `photos` privé avec 4 règles d'accès.

## 4. Vérification réalisée (étape 0.2)

Testé avec un Supabase local complet (`supabase start`) : l'application buildée
avec uniquement ces variables se connecte au projet choisi, l'authentification
accepte un vrai jeton de ce projet et refuse un jeton falsifié.
