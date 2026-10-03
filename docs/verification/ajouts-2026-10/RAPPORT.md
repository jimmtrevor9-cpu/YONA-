# Rapport de vérification — ajouts A à G (3 octobre 2026)

Tout ce qui est écrit ici a été **lancé et observé**, ce jour, sur la version finale du code.
Ce qui n'a pas pu être testé est dit à la fin.

## Environnement de test

- PostgreSQL 16 local, avec une imitation de Supabase (`scripts/data/supabase-local-shim.sql`)
  en deux modes : projet « classique » et projet « 2026 sans droits automatiques » (strict).
- Pile Supabase locale montée à la main (PostgreSQL, PostgREST, Supabase Auth, Storage,
  passerelle) : les images Docker de Supabase ne peuvent pas être téléchargées ici.
- Le site testé est **la version Vercel** (`NITRO_PRESET=vercel`), servie en local.
- Navigateur : Chromium (Playwright).

## 1. Code

| Contrôle | Résultat |
|---|---|
| Types (`npx tsc --noEmit`) | ✅ 0 erreur |
| Lint (`npm run lint`) | ✅ 0 erreur (7 avertissements anciens, composants d'interface) |
| Construction Vercel (`NITRO_PRESET=vercel vite build`) | ✅ fonction serveur de 69 Mo (moteur de visages compris), 60 s maximum |
| Secrets dans les fichiers du dépôt | ✅ aucun (recherche de clés Stripe, Supabase, Anthropic, AWS, JWT, clés privées) |

## 2. Base de données : `YONA_base_de_donnees_complete.sql`

Script : `g-base-rejouable/tester.sh` (sortie complète ci-dessous, résumée).

| Essai | Strict | Classique |
|---|---|---|
| 1re exécution dans une base vide, comme le SQL Editor (une seule requête) : structure, droits, stockage, temps réel et données identiques aux 96 migrations | ✅ | ✅ |
| 2e exécution (rejeu) : aucune erreur, bilan ✅, base toujours identique | ✅ | ✅ |
| Parcours réels (inscription, vérification, like, Match, messages, admin, suppression…) | ✅ 37/37 | ✅ 37/37 |
| 3e exécution sur cette base déjà utilisée : aucune donnée modifiée, profils de démonstration remplacés non remis | ✅ | ✅ |
| Les 5 parties (`supabase/nouvelle-base/parties/`) exécutées deux fois : identique aux migrations | ✅ | ✅ |
| Base contenant une ancienne version de YONA : refus clair, rien de modifié | ✅ | — |
| Base contenant d'autres tables : refus clair | ✅ | — |

Suites de tests des tâches, lancées sur une base créée par ce fichier :

| Suite | Strict | Classique |
|---|---|---|
| `b-decouverte.sql` | 16/16 | 16/16 |
| `d1-journal.sql` | 22/22 | 22/22 |
| `d2-tableau-de-bord.sql` | 26/26 | 26/26 |
| `d3-publicites.sql` | 31/31 | 31/31 |
| `e-localisation.sql` | 22/22 | 22/22 |
| `f-verification.sql` | 31/31 | 31/31 |

## 3. Navigateur (version Vercel servie en local)

| Suite | Résultat |
|---|---|
| `d2-admin-navigateur.mjs` (tableau de bord, membres, journaux, CSV, suppression) | ✅ 24/24 |
| `d3-publicites-navigateur.mjs` (création, affichage aux gratuits seulement, vidéo, statistiques) | ✅ 38/38 |
| `e-localisation-navigateur.mjs` (VPN simulé, ville déclarée, GPS, drapeau admin) | ✅ 13/13 |
| `f-verification-navigateur.mjs` (vrai moteur de visages, caméra simulée) | ✅ 17/17 |

## 4. Captures d'écran (dossier `captures/`, préfixe `g-`)

320, 768 et 1 440 px, aucun débordement horizontal mesuré :

- `g-accueil-*` : accueil (« Vérifiée — identité de chaque membre »).
- `g-decouvrir-*` : Découvrir (membre gratuit vérifié).
- `g-pub-decouvrir-*` : carte « Sponsorisé » dans Découvrir.
- `g-pub-messages-*` : bannière sponsorisée dans Messages.
- `g-verification-*` : page « Vérifie ton identité » (page entière).
- `g-decouvrir-non-verifie-*` : Découvrir bloqué tant que l'identité n'est pas vérifiée.
- `g-admin-tableau-*`, `g-admin-publicites-*`, `g-admin-verifications-*` : administration.

Textes vérifiés dans les pages servies : la politique de confidentialité contient la
biométrie, le consentement explicite, les 12 mois et les profils de démonstration ; les CGU
contiennent « Sponsorisé », les profils de démonstration et « pas infaillible » ; plus
aucune page ne dit « 100 % profils vérifiés » ni « aucune publicité ».

## 5. Non testé ici (dit honnêtement)

- **Le vrai Supabase en ligne** : le fichier a été exécuté sur une imitation fidèle, pas
  sur supabase.com. Les tâches automatiques (`pg_cron`) n'existent pas dans l'imitation :
  la ligne « Tâches automatiques » y indique « ⚠️ facultatif ».
- **La reconnaissance faciale sur de vraies personnes** : testée avec des portraits générés
  par IA et une caméra simulée (le « tourner la tête » est une déformation d'image, d'où un
  seuil de rotation abaissé pendant l'essai). Les premiers vrais résultats sont à surveiller.
- **AWS Rekognition** : code branché, jamais appelé (pas de compte AWS).
- **Stripe réel, clé Anthropic réelle, envoi d'e-mails** : non testés (voir le README).
- **Taille maximale acceptée par l'éditeur SQL de Supabase** : inconnue ; d'où les 5 parties
  de 83 à 91 Ko, à utiliser si le fichier entier (426 Ko) est refusé.
