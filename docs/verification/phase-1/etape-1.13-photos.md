# Phase 1 — Étape 1.13 — Vérifier les photos

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- **Aucune gestion de photos dans l'application** : impossible d'ajouter, voir, supprimer
  ou choisir une photo principale (la page Profil annonçait les photos « en Phase 2 »).
- Fondations serveur présentes : table `photos`, bucket privé `photos` (étape 0.4),
  limite 3 / 10 (`enforce_photo_limit`), statut forcé « en attente »
  (`protect_photo_status`), fichier dans le dossier du propriétaire (étape 0.6).
- Bucket sans restriction : tout type de fichier, toute taille.
- Photo principale sans règle (ajout, suppression).

## Réalisation

**Serveur** — `supabase/migrations/20260926130000_phase1_photos.sql` (+ miroir
`drizzle/migrations/0010_…`) :
- bucket `photos` : JPEG / PNG / WebP uniquement, 5 Mo maximum ;
- `photos_before_insert` : 1ʳᵉ photo = principale ; une photo ajoutée ne peut pas se
  déclarer principale ; position calculée ;
- `photos_after_delete` : suppression de la principale → la plus ancienne la remplace ;
- `set_primary_photo(photo)` : change la principale en une opération, uniquement ses
  propres photos (sinon HTTP 403).

**Interface** :
- `src/features/profiles/photos.ts` : liste avec liens d'affichage temporaires (bucket
  privé), ajout (fichier supprimé si l'enregistrement échoue), suppression, principale,
  messages d'erreur ;
- `src/components/ProfilePhotos.tsx` : section « Photos » de la page Profil (composants
  et style existants : panneau doré, boutons, badges) — compteur « n / 3 » (« n / 10 » en
  Premium), badges « Principale » / « En attente » / « Refusée » ;
- `src/routes/_authenticated/profile.tsx` : section insérée ; phrase du bas mise à jour
  (« Préférences avancées et abonnement Premium arrivent en Phase 2. »).

## Tests (`etape-1.13-photos.mjs`, images réelles dessinées par Chromium) — 23/23

| Test | Résultat |
|---|---|
| Section vide, compteur 0 / 3, sélecteur JPG/PNG/WebP | ✅ ×2 |
| JPEG ajouté → principale, « en attente », rangé dans le dossier du membre, image affichée | ✅ ×4 |
| PNG + WebP → 3 / 3, une seule principale, bouton d'ajout désactivé | ✅ ×2 |
| Changer la principale ; supprimer la principale → remplacée, fichier supprimé | ✅ ×2 |
| GIF et 6 Mo refusés avec message clair ; rechargement ; 320 px | ✅ ×4 |
| Serveur : GIF et 6 Mo refusés par le stockage ; photo ajoutée ne vole pas la principale ni ne s'auto-approuve ; 4ᵉ photo refusée ; principale d'un autre membre → 403 | ✅ ×5 |
| Autre membre : ne voit pas les photos en attente ; les voit (et l'image) après validation | ✅ ×2 |
| Membre Premium : 0 / 10 ; aucune erreur JavaScript | ✅ ×2 |

Capture visuelle (390 px) : section intégrée au style de la page ; badges rendus lisibles
sur la photo (fond clair).

## Non-régression

Base réinstallée à zéro (12 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18.

## À savoir (non modifié)

- **Modération** : une photo reste invisible des autres tant qu'un administrateur ne l'a
  pas validée ; l'interface d'administration arrive en Phase 23. D'ici là, la validation
  se fait directement en base.
- Réorganisation par glisser-déposer non prévue (seule la photo principale se choisit).
- Photos « HD » Premium (étape 15.5) : même limite de 5 Mo pour tous à ce stade.
- Les cartes de découverte n'affichent pas encore la photo principale.
- Le type de fichier est contrôlé par son type déclaré, pas par son contenu réel ; la
  modération humaine reste le dernier filet de sécurité.
