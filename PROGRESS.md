# YONA — Suivi de progression

Dernière mise à jour : 2026-10-03

## État des phases

| Phase | Sujet | État |
|---|---|---|
| 0 à 11 | Environnement, inscription, Découvrir, Like/Pass, Match, messages, quota 3 messages, numéros, déblocage 1 USD, favoris, visites, présence, recherche | ✅ Terminé (travail précédent) |
| 12 | Demandes de contact | ✅ Terminé (12.1 avant, 12.2 à 12.6 le 2026-09-30) |
| 13 | Roi Salomon | ✅ Terminé (2026-09-30) |
| 14 | Premium (page, paiement, badge, expiration) | ✅ Terminé et testé (46/46) |
| 15 | Avantages Premium | ✅ Terminé et testé (50/50) |
| 16 | Ice Breaker | ✅ Terminé et testé (21/21 avec 17 et 18) |
| 17 | Message Flash | ✅ Terminé et testé |
| 18 | Compatibilité | ✅ Terminé et testé |
| 19 | Notifications | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 20 | Paramètres `/settings` | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 21 | Blocage | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 22 | Signalement | ✅ Terminé et testé (44/44 pour 19 à 22) |
| 23 | Administration `/admin` | ✅ Terminé et testé (26/26) |
| 24 | Sécurité finale | ✅ Audit terminé (33/33) |
| 25 | Tests | ✅ Tous les tests relancés sur une base propre |
| 26 | Validation finale + README | ✅ Terminé (types, lint, build, migrations à neuf, écrans, README) |
| + | Nouvelle inscription fluide (captures wazz241) + Google | ✅ Terminé et testé (82/82, 2026-10-01) |
| + | Corrections visuelles, pages légales, PWA, compte d'abord, pays/régions/villes, profils virtuels, vérification du profil | ✅ Terminé (2026-10-02) : types, lint, build, migrations rejouées sur PostgreSQL 16, écrans 320 à 1 440 px |
| + | Base complète en un fichier pour un projet Supabase neuf (généré par `scripts/generate-base-complete.py`) | ✅ Terminé et testé (2026-10-03) ; remplacé par `YONA_base_de_donnees_complete.sql` (tâche G) |
| A | 40 profils de démonstration (21 femmes, 19 hommes, 22-35 ans, un prénom), photos fournies, étiquette « Profil de démonstration » | ✅ Terminé et testé (2026-10-03), migrations 0086-0087 |
| B | Découverte et recherche filtrées par sexe côté serveur, ordre mélangé | ✅ Terminé et testé (16/16), migration 0088 |
| C | Page Découvrir sur le modèle de la capture | ✅ Terminé (captures 320 / 768 / 1 440), migration 0089 |
| D1 | Journal de tout ce qui se passe (connexions, inscriptions, paiements, actions, erreurs, admins) | ✅ Terminé et testé (22/22), migration 0090 |
| D2 | Tableau de bord admin (graphiques, périodes, membres, journaux, export CSV, suppression) | ✅ Terminé et testé (26/26 SQL, 24/24 navigateur), migration 0091 |
| D3 | Publicités sponsorisées (gratuits seulement) | ✅ Terminé et testé (31/31 SQL, 38/38 navigateur), migration 0092 |
| E | Localisation réelle des membres (appareil, ville déclarée, IP) et drapeau VPN | ✅ Terminé et testé (22/22 SQL, 13/13 navigateur), migration 0093 |
| F | Vérification d'identité automatique (selfie en direct, pièce, comparaison des visages) | ✅ Terminé et testé (31/31 SQL, 17/17 navigateur sur la version Vercel), migration 0094 |
| G | Livrables : textes légaux, registre RGPD, documentation, `YONA_base_de_donnees_complete.sql` rejouable (+ 5 parties), captures, ZIP | ✅ Terminé et testé (2026-10-03) : rapport `docs/verification/ajouts-2026-10/RAPPORT.md` |

## Tâche en cours

Aucune : toutes les phases du plan (0 à 26) et les ajouts A à G sont terminés.

## Prochaine action précise

Créer le projet Supabase neuf avec `YONA_base_de_donnees_complete.sql`, puis brancher les
vrais services : clés Stripe (`PAYMENT_PROVIDER=stripe`), clé Anthropic, et un service
d'e-mail (voir `docs/GUIDE_MISE_EN_LIGNE.md` et le README, section « Limites connues »).
Surveiller les premières vérifications d'identité réelles et ajuster les seuils dans /admin.

## Décisions techniques

- **2026-10-03 (ajouts A à G)** : vérification d'identité **obligatoire** pour voir les
  profils et écrire (contrôlée en base : `can_browse_profiles`, déclencheur
  `require_verified_sender`). Moteur de visages open source `@vladmandic/face-api` exécuté
  sur le serveur (WASM, modèles intégrés au code, images décodées par `sharp`), AWS
  Rekognition en option (`FACE_MATCH_PROVIDER=aws`). Fonction Vercel : 60 s maximum.
  Localisation : appareil > ville déclarée > IP ; les profils de démonstration gardent leur
  propre ville (refus de leur donner celle du membre : ce serait faire croire qu'ils sont
  près de lui). Publicités sans cookie ni traceur. Base complète : fichier rejouable
  (`IF NOT EXISTS`, `OR REPLACE`, contrôle avant chaque contrainte, profils de démonstration
  ajoutés une seule fois) qui refuse une base étrangère ou une ancienne version de YONA.

- **2026-10-02** : logo, images du slider et vidéo servis depuis `public/` (les anciens liens
  Lovable `/__l5e/…` ne marchent pas sur Vercel). Base géographique GeoNames (CC BY 4.0) en
  fichiers par pays dans `public/geo/`. Inscription : compte d'abord, retour par `/login`
  qui redirige seul. Profils virtuels : comptes `auth.users` sans mot de passe, fournisseur
  « virtual », suppression par déclencheur (une seule par vrai membre, jamais bloquante).
  Vérification : bucket privé `verifications`, examen dans /admin → Vérifications, photo
  supprimée après décision, `profiles.verified_at` posé si validé. Migrations 0084-0085.

- **Hébergement (2026-10-01)** : le propriétaire quitte Lovable. Site déployé sur **Vercel**
  (`vercel.json`, construction testée : préréglage Nitro « vercel », Node 22), base sur son
  propre projet Supabase `ahljepryelikxepfpnuq` (structure créée avec
  `YONA_structure_base_complete.sql`). Les migrations futures sont à exécuter à la main.
  Plus aucune dépendance à Lovable : `vite.config.ts` n'utilise plus
  `@lovable.dev/vite-tanstack-config` (plugins TanStack Start, React, Tailwind et Nitro
  déclarés directement, cible « vercel » par défaut) ; retirés aussi le partage de session
  avec l'éditeur Lovable, le rapport d'erreurs Lovable, `cron-auth.ts` (inutilisé, secrets
  `LOVABLE_CRON_*`) et le dossier `.lovable`. drizzle-kit lit `DATABASE_URL`.

- **Nouvelle inscription (demande du 2026-10-01)** : parcours des captures d'écran fourni
  par le propriétaire. Le profil est rempli AVANT la création du compte ; les réponses sont
  gardées dans le navigateur (photos dans IndexedDB) et, pour l'e-mail, dans les
  métadonnées du compte (lien de confirmation ouvert sur un autre appareil). `/onboarding`
  crée alors le profil tout seul. Adaptations : date de naissance (et non âge seul) pour le
  contrôle exact des 18 ans ; « Je suis » Homme / Femme seulement (la base et la recherche
  ne connaissent que ces deux valeurs) ; « Pourquoi tu es là ? » adapté à une rencontre
  chrétienne sérieuse ; inscription par téléphone et connexion par empreinte non faites
  (service SMS et passkeys à ajouter) ; la bulle « … vient de s'inscrire » montre de vrais
  membres (prénom et pays seulement). L'ancien formulaire 3 étapes reste accessible
  (Profil → « Ma foi et mes attentes ») pour le détail de la foi.

- **Base de travail** : le code du ZIP `YONA_PHASE_12_ETAPE_12.1` ; sauvegardé sur GitHub
  (`jimmtrevor9-cpu/YONA-`, branche `claude/yona-phase-12-onwards-7e8y61`).
- **Tests** : chaque phase a un script dans `docs/verification/phase-N/` exécuté contre un
  Supabase local (`supabase start`, Docker) + l'application construite. Rapport `.md` à côté.
- **Migrations** : chaque migration existe en double (`supabase/migrations/` pour la CLI
  Supabase et `drizzle/migrations/` pour drizzle-kit), comme dans le travail précédent.
  Une migration par phase (au lieu d'une par étape) pour aller plus vite, avec chaque
  étape commentée dans le fichier.
- **Installation** : `npm install` (npm uniquement ; `bun.lock` et `bunfig.toml` retirés).
- **Demandes de contact** : accepter une demande crée un Match (et la conversation). Une
  demande compte dans le quota dès son envoi, même annulée. Jour = jour calendaire UTC.
  Après un refus, pas de relance pendant 30 jours.

- **Roi Salomon** : Claude (Anthropic) via le SDK officiel, clé `ANTHROPIC_API_KEY` sur le
  serveur uniquement, modèle `claude-opus-5-5` par défaut (`AI_MODEL` pour changer). La
  discussion n'est pas enregistrée sur le serveur (gardée dans l'onglet). Si l'IA échoue,
  la question est rendue.

- **Premium** : paiement unique (mensuel ou annuel), sans renouvellement automatique ; un
  renouvellement s'ajoute après la période en cours. Stripe appelé en REST, confirmé par un
  webhook signé (`/api/stripe-webhook`). Prestataire « test » par défaut.
- **Compatibilité** : score calculé par des règles simples en SQL (dénomination, foi,
  église, prière, valeurs, intérêts, objectif, famille, âge, pays), pas par l'IA.
- **Boost** : 1 heure, une fois tous les 7 jours (Premium). Photos HD : 5 Mo en Premium,
  2 Mo (réduites à 1280 px) sinon. Messages vocaux : 120 s max, Premium, stockage privé.
- **Blocage** : ferme le Match et la conversation, annule les demandes, retire les favoris.
- **Admin** : toutes les fonctions `admin_*` revérifient le rôle en base ; suspendre ou
  bannir bloque aussi la connexion (Supabase Auth, fonction serveur).

## Problèmes connus

- Profils de démonstration : 39 photos sur 40 fournies (celle de Nadège manque) ; ce profil
  reste caché tant qu'un administrateur ne lui donne pas une photo (/admin → Profils de démo).
- Reconnaissance faciale : testée avec des visages de synthèse, pas encore avec de vraies
  personnes en nombre ; AWS Rekognition non testé (pas de compte). Voir le README.
- Accueil : le chiffre « +12 000 membres actifs » vient de la maquette d'origine ; à
  remplacer par un chiffre réel (ou à retirer) avant l'ouverture.
- Base géographique : certains noms de régions sont en anglais dans GeoNames (ex. « Far
  North », « Brittany ») ; les villes absentes peuvent être saisies à la main.
- Scripts de test `docs/verification/inscription/` et 1.x : écrits pour l'ancien ordre
  (profil puis compte) ; à adapter au parcours « compte d'abord ».

- Non testé en réel : Stripe en ligne (testé avec un faux Stripe local), vraie clé
  Anthropic, envoi d'e-mails (aucun service d'e-mail : la préférence est seulement enregistrée).
- Paiement réel : pas encore choisi par le propriétaire (question posée : Stripe ou
  Mobile Money). En attendant : prestataire « test » (sans argent réel).
- Lint : 0 erreur (7 avertissements dans des composants d'interface fournis par la
  bibliothèque). Les fichiers générés automatiquement sont exclus du contrôle.
- Les photos restent « en attente » tant qu'un admin ne les a pas validées (choix de la
  phase 1) : validation dans `/admin` → onglet Photos.
