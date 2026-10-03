# Registre des traitements de données — YONA (version minimale)

> Document interne, à tenir à jour par le responsable du site. Il résume **quelles données**
> YONA traite, **pourquoi**, **sur quelle base**, **combien de temps** et **qui y a accès**.
> Il ne remplace pas l'avis d'un juriste. Dernière mise à jour : 3 octobre 2026.

## Responsable du traitement

| | |
|---|---|
| Nom | YONA (forme juridique et immatriculation à compléter dans `src/lib/legal.ts`) |
| Siège | Libreville, Gabon |
| Contact | angeboussamba12@gmail.com — 074 77 42 66 |
| Autorités de contrôle | Gabon : CNPDCP · France : CNIL · Belgique : APD · Québec : CAI |

## Sous-traitants (prestataires techniques)

| Prestataire | Rôle | Données concernées | Lieu |
|---|---|---|---|
| Vercel | Hébergement du site et des fonctions serveur | Toutes les requêtes (dont adresse IP) | États-Unis / Europe |
| Supabase | Base de données, comptes, stockage des fichiers | Toutes les données du site | Selon la région du projet Supabase |
| Google | Connexion « avec Google » (si choisie) | Nom, e-mail Google | États-Unis |
| Stripe | Paiements par carte | Montant, e-mail ; la carte est saisie chez Stripe | États-Unis / Europe |
| Anthropic | Assistant Roi Salomon, Ice Breaker | Texte des questions posées | États-Unis |
| Amazon Web Services (Rekognition) | Comparaison des visages — **seulement si** `FACE_MATCH_PROVIDER=aws` | Selfies et photo de la pièce, le temps de l'analyse | Région AWS choisie |

Par défaut (`FACE_MATCH_PROVIDER` vide ou `local`), la comparaison des visages se fait **sur le
serveur YONA (Vercel)**, sans envoyer d'image à un autre prestataire.

## Traitements

### 1. Compte et profil
- **Données** : e-mail, mot de passe (chiffré par Supabase), prénom, date de naissance, sexe,
  pays/ville, biographie, centres d'intérêt, photos, préférences ; foi et valeurs (facultatif).
- **Finalité** : créer le compte, montrer le profil, proposer des profils compatibles.
- **Base légale** : exécution du service ; **consentement** pour la foi (donnée sensible).
- **Durée** : tant que le compte existe ; suppression complète à la suppression du compte.
- **Accès** : le membre ; les autres membres voient seulement le profil public ; les
  administrateurs pour la modération.

### 2. Vérification d'identité (données **biométriques** et pièces d'identité — sensibles)
- **Données** : selfie en direct (de face + tête tournée), photo de la pièce (carte
  d'identité, passeport, carte d'étudiant ou scolaire) si choisie ; résultat, scores de
  ressemblance, motif, moteur utilisé, date du consentement.
- **Finalité unique** : vérifier que la personne correspond à ses photos (lutte contre les
  faux profils et les arnaques). Aucune autre utilisation.
- **Base légale** : **consentement explicite** (case à cocher obligatoire avant la caméra,
  date enregistrée dans `profile_verifications.consent_at`).
- **Durée** :
  - images : supprimées **dès la décision** (réglage `file_retention_hours` = 0 par défaut,
    modifiable dans Admin → Vérifications) ; essai abandonné : effacé après 30 minutes ;
    cas incertain : gardé jusqu'à la décision de l'équipe ;
  - résultat et scores (sans image) : tant que le compte existe.
- **Accès** : le serveur (clé `SUPABASE_SERVICE_ROLE_KEY`) ; les administrateurs voient les
  images **seulement** pour les cas incertains, par des liens privés valables 10 minutes.
- **Sécurité** : espace de stockage privé `verifications` ; aucune lecture ni écriture
  directe par les membres (dépôt seulement à l'emplacement donné par le serveur).
- **Décision automatique** : oui. Garanties : relecture humaine des cas incertains,
  possibilité de recommencer (5 essais par jour par défaut) et de demander un examen humain
  par e-mail.

### 3. Localisation
- **Données** : position de l'appareil (si autorisée), ville déclarée, pays/ville estimés
  d'après l'adresse IP, fuseau horaire, langue ; drapeau « incohérence » (ex. VPN).
- **Finalité** : distance approximative entre membres ; détection des faux profils.
- **Base légale** : consentement (position de l'appareil) ; intérêt légitime (sécurité) pour
  l'IP, le fuseau horaire et la langue.
- **Durée** : position actuelle tant que le compte existe ; historique (`location_history`)
  **12 mois** puis suppression automatique.
- **Accès** : administrateurs uniquement ; les membres ne voient qu'une distance.

### 4. Journal d'activité et sécurité
- **Données** : connexions, inscriptions, paiements, actions (likes, matchs, envois de messages
  **sans leur contenu**, signalements…), erreurs serveur, actions des administrateurs ; avec
  adresse IP, pays/ville estimés, appareil et navigateur.
- **Finalité** : sécurité, lutte contre la fraude, statistiques du tableau de bord.
- **Base légale** : intérêt légitime ; obligations légales (paiements).
- **Durée** : adresse IP et appareil **effacés après 12 mois** (fonction `purge_old_logs`,
  tâche planifiée) ; erreurs serveur supprimées après 12 mois. À la suppression du compte, les
  lignes restantes ne sont plus reliées au membre.
- **Accès** : administrateurs uniquement (RLS).

### 5. Messagerie
- **Données** : messages texte et vocaux, demandes de contact.
- **Finalité** : échanges entre membres ; modération (blocage des numéros de téléphone).
- **Base légale** : exécution du service.
- **Durée** : tant que le compte existe.

### 6. Paiements
- **Données** : offre, montant, date, statut ; identifiant de session Stripe.
- **Base légale** : exécution du contrat ; obligations comptables.
- **Durée** : selon les obligations comptables (en général 10 ans pour les pièces comptables).

### 7. Annonces sponsorisées
- **Données** : annonce vue / cliquée, date, membre (abonnés gratuits seulement).
- **Finalité** : limiter la répétition des annonces, statistiques globales pour l'annonceur.
- **Ciblage** : seulement pays, sexe et âge. Aucun cookie publicitaire, aucun traceur tiers.
- **Base légale** : intérêt légitime (financement de l'offre gratuite).
- **Durée** : le lien avec le membre est retiré à la suppression du compte.

### 8. Profils de démonstration
- 40 profils fictifs (21 femmes, 19 hommes), toujours signalés « Profil de démonstration ».
  Ils ne concernent **aucune personne réelle** ; les photos sont fournies par le responsable,
  qui en détient les droits. Mention dans les CGU et la politique de confidentialité.

## Droits des personnes

| Droit | Comment |
|---|---|
| Accès, rectification | Profil et paramètres du membre ; sinon par e-mail |
| Suppression | Bouton « Supprimer mon compte » : supprime compte, profil, photos, messages vocaux, vérifications **et leurs fichiers**, position |
| Retrait du consentement | Biométrie : suppression du compte ; position : réglages du navigateur |
| Réclamation | Autorités listées en haut de ce document |

## Mesures de sécurité

- Règles d'accès (RLS) sur **toutes** les tables ; fonctions sensibles en `SECURITY DEFINER`
  avec `search_path` fixé, droits `GRANT`/`REVOKE` explicites.
- Clés secrètes uniquement côté serveur (jamais de variable `VITE_` pour un secret).
- Stockage privé pour les vérifications ; liens signés de courte durée.
- HTTPS partout ; journal des actions des administrateurs.

## À faire par le responsable

- [ ] Compléter la forme juridique et l'immatriculation dans `src/lib/legal.ts`.
- [ ] Vérifier la région du projet Supabase (Europe conseillée pour des membres européens).
- [ ] Si AWS Rekognition est activé : signer l'accord de traitement des données d'AWS et
      ajouter AWS dans la politique de confidentialité (déjà mentionné comme « si activé »).
- [ ] Relire ce registre une fois par an, ou à chaque nouveau traitement.
- [ ] Selon le pays des membres, une analyse d'impact (AIPD) peut être exigée pour la
      biométrie : à faire valider par un juriste.
