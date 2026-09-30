# Phase 1 — Étape 1.9 — Vérifier les informations personnelles

Date : 2026-09-26 · Statut : **VALIDÉE**

Champs : prénom, sexe, date de naissance / âge, ville, pays (et profession sur la page
Profil). Saisis dans l'onboarding (étape « Vous ») et la page `/profile`.

## Problèmes trouvés (tous confirmés par test avant correction)

| # | Problème |
|---|---|
| 1 | **Aucun âge minimum** : un profil pouvait déclarer moins de 18 ans (ni interface, ni serveur) |
| 2 | Dates de naissance futures ou antérieures à 1900 acceptées |
| 3 | Onboarding : l'étape « Vous » se passait avec un prénom vide, sans sexe, sans date de naissance |
| 4 | Page Profil : le prénom pouvait être effacé |
| 5 | Ville / pays / profession : longueur illimitée |
| 6 | Calcul de l'âge décalé d'un jour autour de l'anniversaire dans les fuseaux à l'ouest de Greenwich (date lue en UTC) |

## Corrections

- **Serveur** — `supabase/migrations/20260926100000_phase1_infos_personnelles.sql`
  (+ miroir `drizzle/migrations/0007_…`) : déclencheur `profiles_check_personal_info`
  (date entre 1900 et « aujourd'hui − 18 ans », contrôlée quand elle change) ;
  contraintes `profiles_city_length`, `profiles_country_length`,
  `profiles_profession_length` (100 caractères).
- **Règles communes** — `src/features/profiles/personal-info.ts` : âge minimum, dates
  limites, longueurs, messages, traduction des refus du serveur.
- **Onboarding** : étape « Vous » bloquée tant que prénom, sexe et date de naissance
  valide (18 ans et plus) ne sont pas renseignés ; calendrier limité ; longueurs limitées.
- **Page Profil** : prénom obligatoire ; date de naissance valide (obligatoire une fois le
  profil créé) ; calendrier et longueurs limités ; messages clairs.
- **`computeAge`** : date lue sans fuseau horaire.
- `register.tsx` réutilise la constante commune `FIRST_NAME_MAX_LENGTH`.

Mise en page inchangée (seuls des attributs de champ et des messages ont été ajoutés).

## Tests (`etape-1.9-infos-personnelles.mjs`) — 23/23

| Test | Résultat |
|---|---|
| Onboarding : calendrier limité à « aujourd'hui − 18 ans », ville/pays 100 caractères | ✅ |
| Onboarding : prénom vide / sexe absent / date absente → étape bloquée avec message | ✅ ×3 |
| Onboarding : 18 ans demain → « YONA est réservé aux personnes majeures (18 ans et plus). » | ✅ |
| Onboarding : 1850 → « Date de naissance invalide. » ; exactement 18 ans aujourd'hui → accepté | ✅ ×2 |
| Profil : âge affiché ; calendrier limité ; prénom effacé refusé ; 17 ans refusé ; modifications valides enregistrées | ✅ ×5 |
| Âge le jour de l'anniversaire : New York, Abidjan, Tokyo → « 30 ans » | ✅ ×3 |
| Serveur (API directe) : 17 ans, date future, avant 1900, ville et pays de 150 caractères refusés ; date valide acceptée | ✅ ×6 |
| Aucune erreur JavaScript | ✅ |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · SQL 0.1 conformes.
Base réinstallée à zéro avec les 9 migrations : OK.

## À savoir

- Le sexe n'est pas modifiable depuis la page Profil (seulement dans l'onboarding).
- La règle des 18 ans utilise la date du serveur (UTC) : à quelques heures près autour
  de minuit, l'interface et le serveur peuvent différer d'un jour ; le serveur fait foi.
- Le serveur n'impose pas encore prénom / sexe / date de naissance pour qu'un profil soit
  « actif » : ce sera l'objet de l'étape 1.15 (éligibilité à la découverte).
