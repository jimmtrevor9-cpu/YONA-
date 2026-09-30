# Phase 11 — Étape 11.5 — Filtre distance

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

- Le profil avait des colonnes `latitude` / `longitude`, mais aucun écran ne les
  remplissait.
- Ces colonnes étaient lisibles par les autres membres avec le reste du profil (règle
  `profiles_select_visible`). Y stocker une position aurait exposé l'adresse approximative
  de chacun.

## Réalisation

Migration `20260929010000_phase11_filtre_distance.sql` (drizzle `0060`) :
- **Table `profile_locations` :** une ligne par membre. Le propriétaire est le seul à
  pouvoir la lire, et aucune écriture directe n'est permise.
- **`set_my_location(latitude, longitude)` :** enregistre la position de la personne
  connectée, arrondie à 0,01° (environ 1 km). Une coordonnée hors limites, non finie ou
  nulle donne le refus `invalid_location`. `clear_my_location()` retire la position.
- **Déclencheur `profiles_no_coordinates` :** `profiles.latitude` et `profiles.longitude`
  restent toujours vides, car la position n'est jamais stockée dans le profil public.
- **`distance_km` :** distance à vol d'oiseau (formule de haversine).
- **`search_profiles`, filtre `max_distance_km` :** seulement 5, 10, 25, 50, 100, 250 ou
  500 km. Des rayons fixes empêchent d'affiner les recherches pour localiser quelqu'un
  précisément. La recherche se fait autour de la position de la personne connectée ;
  sans position enregistrée, le serveur refuse avec `location_required`. Les profils sans
  position ne correspondent jamais.

Application :
- `src/features/profiles/location.ts` (nouveau) : lecture de sa position, position de
  l'appareil (autorisation du navigateur), enregistrement, retrait, messages d'erreur.
- `src/components/MyLocationPanel.tsx` (nouveau), sur la page Profil, encadré « Ma
  position » avec :
  - l'état : aucune position, ou « Enregistrée le … » ;
  - l'explication de confidentialité ;
  - les boutons « Utiliser ma position actuelle » / « Mettre à jour » et « Retirer ma
    position ».
- `src/routes/_authenticated/search.tsx` : champ « Distance » (« Toutes distances » ou « À
  moins de N km »). Sans position enregistrée, il est désactivé et un lien mène vers le
  profil. Un message clair s'affiche en cas de refus `location_required`.
- `src/features/search/filters.ts`, `queries.ts` : rayons proposés ; pas de nouvelle
  tentative automatique sur `location_required`.
- `src/integrations/supabase/types.ts` : table et fonctions ajoutées.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 23 tables, 57 fonctions, 67 règles d'accès.

## Tests (`etape-11.5-filtre-distance.mjs`) — 32/32

La position de l'appareil est simulée dans le navigateur (Playwright `geolocation`).

| Test | Résultat |
|---|---|
| Sans position : `location_required` ; `set_my_location` arrondie à 0,01° ; latitude 91, longitude -181 et valeur nulle refusées ; visiteur refusé | ✅ ×6 |
| Rayons 10 (aucun), 25, 250, 500 km ; distances réelles cohérentes (Douala–Yaoundé ≈ 195 km) ; profil sans position ; distance combinée au pays et au sexe | ✅ ×8 |
| Refus `invalid_filter` : rayon libre 7 km, 1000 km, texte, nul | ✅ ×4 |
| Confidentialité : position d'un autre illisible ; colonnes du profil toujours vides, même si on les écrit ; écriture et modification directes refusées ; lecture de sa propre position | ✅ ×6 |
| Page : champ Distance désactivé sans position ; « Utiliser ma position actuelle » (arrondie) ; 7 rayons ; recherche 250 km ; « Retirer ma position » | ✅ ×6 |
| Aucune erreur JS ; nettoyage (comptes et positions) | ✅ ×2 |

## Problème rencontré

Deux vérifications du premier jet étaient trop faibles : l'une était toujours vraie,
l'autre ne testait qu'un résultat vide. Elles ont été remplacées par des vérifications
réelles : rayon 10 km sans résultat ; distance combinée au pays et au sexe avec des
résultats attendus.

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 1.9 : 23/23 · 1.13 : 23/23 · 1.14 : 34/34 · 9.3 : 12/12 ·
11.1 : 26/26 · 11.2 : 18/18 · 11.3 : 22/22 · 11.4 : 24/24 · 11.5 : 32/32. Aucun compte ni
fichier restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 173
au total (fichier généré).
