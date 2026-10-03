# Plan des ajouts d'octobre 2026 (demande « PROMPT_CLAUDE_CODE_YONA_AJOUTS »)

Rédigé le 3 octobre 2026, avant le code. Règle suivie : on ajoute, on ne casse rien ;
chaque migration est nouvelle (0086 et suivantes, copie horodatée dans
`supabase/migrations/`) ; RLS sur chaque nouvelle table ; commit après chaque tâche testée.

## Décisions prises avant de coder (consigne §11 : dire ce qui est impossible)

1. **Photos fournies pour les profils virtuels : non utilisées.** Ce sont des photos
   personnelles de personnes réelles (selfies, captures d'écran de téléphone, fichiers
   envoyés le jour même sur un autre site de rencontre). Les afficher comme membres YONA,
   ou en tirer des variantes (même pose, même décor, autre tenue), utiliserait leur image
   sans accord (droit à l'image) et tromperait les membres. Aucune image ne peut d'ailleurs
   être générée dans cet environnement.
   **Alternative codée** : les 40 profils de démonstration existent en base mais restent
   **cachés tant qu'ils n'ont pas de photo**. L'administrateur ajoute lui-même, dans
   `/admin` → « Profils de démo », une photo **autorisée** (visage généré d'une personne
   qui n'existe pas, ou banque d'images dont la licence autorise les sites de rencontre),
   avec une attestation à cocher. Chaque profil de démonstration porte l'étiquette
   visible « Profil de démonstration ».
   **Mise à jour du 3 octobre (après le plan)** : le propriétaire a ensuite fourni des
   images générées par IA (personnes qui n'existent pas) dont il détient les droits ; 39
   sont livrées avec le site (`public/demo-profils/`) et attribuées aux profils. La photo
   de Nadège manque : ce profil reste caché jusqu'à l'ajout d'une photo dans /admin.
2. **Localisation des profils virtuels calquée sur celle du membre : non faite.** Faire
   croire que des profils fictifs habitent la ville de chaque membre, à quelques km, est
   une pratique commerciale trompeuse. Les profils de démonstration gardent leur propre
   ville ; la distance affichée est la vraie distance. La localisation réelle des membres
   (tâche E) est faite pour les vrais membres.
3. **Tests** : l'environnement ne peut pas télécharger les images Docker de Supabase. Les
   tests tournent sur un Supabase local monté à la main (PostgreSQL 16, PostgREST,
   Supabase Auth, Supabase Storage, passerelle Node) dans `/var/tmp/yona-e2e`.

## Tâches et fichiers

### A — 40 profils de démonstration (21 femmes, 19 hommes, 22-35 ans, un prénom)
- `scripts/data/demo-profiles.mjs` (nouveau) : les 40 définitions (prénom seul, âge
  22-35, pays, ville, confession, intérêts, bio courte) ; 80 % Afrique francophone
  (Gabon, Cameroun, Côte d'Ivoire, Congo, Togo, Bénin, Sénégal, Mali), 20 % France.
- `scripts/generate-virtual-profiles.mjs` : produit `supabase/donnees/profils-demo.sql`
  (rejouable : crée les 40, retire les autres virtuels).
- Migration `0086_profils_demo_40` : colonne `profiles.demo_photo_path`, bucket public
  `demo-profils` (écriture admin), règle « profil virtuel visible seulement avec photo »,
  suppression déclenchée par la **vérification d'identité** (et plus par la fin du
  profil), de préférence du sexe **recherché**, pays retenu (tâche E), fichiers photo
  supprimés.
- Admin : onglet « Profils de démo » (photo + attestation, retrait).

### B — Découverte filtrée par sexe (serveur)
- Migration `0087_decouverte_par_sexe` : `discover_profiles` et `search_profiles`
  appliquent le sexe recherché du membre (le filtre de recherche ne peut que le
  restreindre), la préférence réciproque des vrais profils, et intercalent hommes et
  femmes quand le membre cherche les deux. Profils déjà vus/bloqués exclus.
- Tests : `docs/verification/ajouts-2026-10/b-decouverte.mjs`.

### C — Page Découvrir sur le modèle de la capture
- `src/routes/_authenticated/discover.tsx` (réécrit en pile de cartes),
  `src/components/discover/*` (carte plein écran, fiche détaillée, barre d'actions,
  carte publicitaire), `src/components/BottomNav.tsx` (même style que la capture, mêmes
  destinations), `discover_profiles` renvoie aussi photo, vérifié, objectif, distance.
- Boutons : retour (Premium), Passer, Like, Message Flash (Premium), Demande de contact.

### D — Administration
- Migrations `0088_journal_activite`, `0089_tableau_de_bord`, `0090_publicites`.
- Journaux : connexions (réussies/échouées), inscriptions (étapes), paiements
  (tentatives, webhooks), actions (likes, matchs, messages comptés, blocages,
  signalements…), publicités (vues/clics), erreurs serveur, audit admin.
- `src/features/admin/*` + nouveaux onglets dans `/admin` : Statistiques (recharts,
  périodes, comparaison), Journaux (tableaux triables, filtres, pagination, CSV),
  fiche membre enrichie, Publicités (création, médias, ciblage, dates, aperçu, stats).
- Publicités servies par le serveur aux seuls membres gratuits.

### E — Localisation des vrais membres
- Migration `0091_localisation` : `profile_locations` + source (`device`, `declared`,
  `ip`), pays/région/ville retenus, indices (fuseau, langue, pays IP), drapeau
  d'incohérence.
- Fonction serveur : géocodage inverse à partir de la base GeoNames embarquée
  (`scripts/generate-geo.mjs` produit les coordonnées), en-têtes Vercel pour l'IP.

### F — Vérification d'identité automatique
- Migration `0092_verification_automatique` : réglages (`app_settings` : seuils,
  essais par jour, durée de conservation), tentatives, types de pièce, consentement,
  accès découverte/messages réservé aux membres vérifiés.
- `src/features/verification/face-matching.provider.ts` : moteur local open source
  (`@vladmandic/face-api`, modèles dans le dépôt, exécuté côté serveur) ou AWS
  Rekognition (variable d'environnement). Moteur indisponible = « en attente ».
- Page `/verification` : consentement, selfie caméra en direct avec consigne aléatoire
  (tourner la tête), pièce au choix (carte d'identité, passeport, carte d'étudiant,
  carte scolaire).

### G — Livrables
- Types, lint, build ; migrations rejouées à neuf ; tests A-F ; captures 320/768/1440 ;
  `PROGRESS.md`, `README.md`, `.env.example`, `docs/verification/ajouts-2026-10/` ;
  registre RGPD `docs/REGISTRE_RGPD.md` ; pages légales ; ZIP `YONA_version_finale.zip` ;
  fichier `YONA_base_de_donnees_complete.sql` rejouable ; poussée sur `main`.
