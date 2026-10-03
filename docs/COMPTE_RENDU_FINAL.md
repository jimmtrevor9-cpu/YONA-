# Compte rendu final — ajouts YONA (3 octobre 2026)

## Ce qui a été ajouté

- **A. 40 profils de démonstration** (21 femmes, 19 hommes, 22 à 35 ans, un seul prénom),
  avec tes photos (39 sur 40 : celle de Nadège manque), toujours marqués « Profil de
  démonstration ». Ils ne répondent pas et ne reçoivent ni message ni demande.
- **B. Découverte** : seulement le sexe recherché et la bonne tranche d'âge, filtré par la
  base (impossible à contourner), dans un ordre mélangé.
- **C. Page Découvrir** sur le modèle de ta capture.
- **D. Administration** : journal de tout ce qui se passe (connexions, inscriptions,
  paiements, actions, erreurs), tableau de bord avec graphiques et périodes au choix, liste
  des membres avec fiche, historique et suppression, export CSV ; **publicités
  sponsorisées** (image ou vidéo) montrées seulement aux membres gratuits.
- **E. Localisation réelle** des membres : appareil (si accord), sinon ville déclarée, sinon
  adresse IP ; drapeau « VPN possible » pour l'administration.
- **F. Vérification d'identité automatique** : selfie en direct (de face puis tête tournée),
  pièce d'identité au choix, comparaison des visages par un moteur gratuit intégré ;
  obligatoire pour voir les profils et écrire.
- **G. Livrables** : pages légales et registre RGPD, documentation, fichier SQL complet
  rejouable (et en 5 parties), captures d'écran, ZIP.

## Fichiers existants modifiés (et pourquoi)

Nouveaux fichiers : plus de 400 (migrations 0086 à 0094, code des nouvelles fonctions,
tests, captures, photos des profils de démonstration). Fichiers **existants** modifiés :

| Fichier | Raison |
|---|---|
| `.env.example` | Variables de la vérification d'identité (`FACE_MATCH_PROVIDER`, AWS en option), sans valeur |
| `.prettierignore` | Exclure les grosses données des villes de la mise en forme automatique |
| `PROGRESS.md`, `README.md`, `docs/GUIDE_MISE_EN_LIGNE.md` | Nouvelles fonctions, nouveau fichier SQL, variables, limites connues |
| `docs/verification/outils/demarrer-test-local.sh` | Outil de test : vérifier tous les fichiers construits |
| `package.json`, `package-lock.json` | Moteur de visages (`@vladmandic/face-api`, TensorFlow.js), `sharp` (images), `aws4fetch` (AWS en option) |
| `scripts/generate-base-complete.py` | Produit `YONA_base_de_donnees_complete.sql` rejouable et ses 5 parties |
| `scripts/generate-virtual-profiles.mjs` | 40 profils (21 femmes, 19 hommes, 22-35 ans, un prénom) |
| `vite.config.ts` | Moteur de visages intégré au serveur ; 60 s maximum sur Vercel |
| `src/components/BottomNav.tsx`, `ContactRequestButton.tsx` | Nouvelle page Découvrir (tâche C) |
| `src/components/MyLocationPanel.tsx`, `profile/FullProfileEditor.tsx`, `signup/WelcomeSequence.tsx`, `routes/_authenticated/onboarding.tsx` | Localisation réelle (appareil, ville déclarée) (tâche E) |
| `src/components/signup/SignupWizard.tsx` | Étapes d'inscription comptées pour le tableau de bord |
| `src/components/verification/SelfieCapture.tsx` (supprimé) | Remplacé par le selfie en direct (`LiveSelfieCapture.tsx`) : plus d'envoi depuis la galerie |
| `src/features/account/account.functions.ts`, `admin/admin.functions.ts` | Suppression de compte : tous les fichiers (vérifications comprises) ; suppression par l'admin |
| `src/features/ai/claude.server.ts`, `ai/roi-salomon.functions.ts`, `payments/stripe.server.ts`, `routes/api/stripe-webhook.ts` | Erreurs importantes enregistrées dans le journal de l'admin |
| `src/features/auth/AuthProvider.tsx`, `auth/useSignOut.ts`, `routes/login.tsx` | Journal : connexions, échecs, déconnexions ; indices de localisation |
| `src/integrations/supabase/auth-middleware.ts`, `client.server.ts` | Appareil, IP et pays transmis au journal (serveur seulement) |
| `src/features/contacts/requests.ts`, `messaging/send.ts`, `messaging/voice.ts` | Message clair « vérifie ton identité » quand la base refuse |
| `src/features/premium/features.ts`, `routes/index.tsx` | « Sans annonces sponsorisées » dans Premium ; « 100 % profils vérifiés » remplacé par « identité de chaque membre vérifiée » (honnête tant qu'il existe des profils de démonstration) |
| `src/features/profiles/discovery.ts`, `profiles/location.ts`, `routes/_authenticated/search.tsx` | Filtre par sexe côté serveur (tâche B), localisation (tâche E) |
| `src/features/profiles/verification.ts`, `routes/_authenticated/verification.tsx` | Nouvelle vérification automatique (tâche F) |
| `src/integrations/supabase/types.ts` | Types des nouvelles tables et fonctions |
| `src/lib/legal.ts`, `routes/cgu.tsx`, `routes/confidentialite.tsx` | Profils de démonstration, biométrie et consentement, IP 12 mois, publicités, suppression |
| `src/routes/_authenticated/admin.tsx` | Nouveaux onglets (tableau de bord, journaux, publicités, profils de démo, vérifications) |
| `src/routes/_authenticated/discover.tsx`, `matches.tsx`, `messages.tsx` | Nouvelle page Découvrir, publicités, blocage tant que l'identité n'est pas vérifiée |
| `supabase/nouvelle-base/creer-toute-la-base.sql` (supprimé) | Remplacé par `YONA_base_de_donnees_complete.sql` (rejouable) |

Aucune ancienne migration n'a été modifiée pendant ce travail.

## Ce qui reste à faire de ton côté

1. **Supabase** : créer un projet neuf, puis SQL Editor → coller **tout**
   `YONA_base_de_donnees_complete.sql` → Run (si l'éditeur refuse un fichier aussi long :
   les parties `supabase/nouvelle-base/parties/01_…` à `05_…`, dans l'ordre). Le tableau
   final doit afficher ✅. Rien à créer à la main pour les espaces de fichiers : ils sont
   dans le fichier.
2. **Vercel** : mettre les variables (guide `docs/GUIDE_MISE_EN_LIGNE.md`, étape 2), puis
   **Redeploy**. Aucune variable n'est nécessaire pour la vérification d'identité.
3. **Stripe** : clés `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_PROVIDER=stripe`
   (guide, étape 3).
4. **Premier administrateur** : t'inscrire sur le site, puis exécuter les 3 lignes
   commentées de l'avant-dernière section du fichier SQL, avec ton e-mail.
5. **Photo de Nadège** : à ajouter dans /admin → Profils de démo (sinon ce profil reste caché).
6. **Accueil** : le chiffre « +12 000 membres actifs » vient de la maquette d'origine ;
   le remplacer par un vrai chiffre ou le retirer avant l'ouverture.
7. Compléter la forme juridique et l'immatriculation dans `src/lib/legal.ts`, et relire
   `docs/REGISTRE_RGPD.md` (idéalement avec un juriste, à cause de la biométrie).

## Limites connues

- **VPN** : un VPN change l'adresse IP, donc le pays « vu » par le site. La position de
  l'appareil n'est pas trompée par un VPN, mais le membre peut refuser de la donner, ou
  fausser son GPS. Le site signale les incohérences à l'admin ; il ne peut pas être sûr à 100 %.
- **Reconnaissance faciale** : pas parfaite (lumière, caméra, photos anciennes, jumeaux).
  Le « tourne la tête » arrête une photo ou un écran simple, pas une vidéo truquée
  élaborée. Testée avec des visages générés, pas encore avec de vraies personnes : regarde
  les premiers résultats et ajuste les seuils dans /admin → Vérifications.
- **AWS Rekognition** : branché mais jamais testé (pas de compte).
- **Stripe réel, clé IA réelle, e-mails** : pas testés ici.

## Ce que j'ai refusé de faire (et ce que j'ai fait à la place)

- **Utiliser des photos de vraies personnes trouvées en ligne** pour les profils de
  démonstration : droit à l'image et tromperie des membres. À la place : tes images
  générées par IA, dont tu as les droits.
- **Donner aux profils de démonstration la ville de chaque membre** (faire croire qu'ils
  habitent à côté) : pratique commerciale trompeuse. Ils gardent leur propre ville ; la
  localisation réelle sert aux vrais membres.
