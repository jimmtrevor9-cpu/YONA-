# Phase 11 — Étape 11.3 — Filtre pays

Date : 2026-09-28 · Statut : **VALIDÉE**

## Constat

Le pays du profil est un texte libre (profil et inscription). Un même pays peut donc être
écrit de plusieurs façons, par exemple « Côte d'Ivoire », « cote-d’ivoire » ou « COTE D
IVOIRE ». Aucun filtre pays n'existait.

## Réalisation

Migration `20260928235000_phase11_filtre_pays.sql` (drizzle `0058`) :
- **Extension `unaccent` :** elle est installée si elle manque. Elle est disponible sur
  Supabase et est mentionnée dans `docs/CONNECTER_UNE_BASE_SUPABASE.md`.
- **`normalize_place(text)` :** forme de comparaison d'un lieu, en minuscules et sans
  accents. Les tirets, apostrophes (droites ou typographiques) et espaces multiples
  deviennent un seul espace.
- **`search_profiles`, filtre `country` :** texte de 1 à 100 caractères, sinon refus
  `invalid_filter`. La comparaison est exacte sur la forme normalisée : pas de
  correspondance partielle ni approximative. Les caractères spéciaux sont traités comme
  du texte.
- **`list_search_countries()` :** liste des pays réellement renseignés par les profils que
  la personne peut voir (visibles, actifs, sans blocage), avec le nombre de profils.
  - Chaque pays n'apparaît qu'une fois.
  - L'orthographe affichée est la plus fréquente ; à égalité, on préfère la casse
    normale, puis la version avec accents.
  - Les visiteurs non connectés sont refusés.

Application :
- `src/features/search/filters.ts` : champ pays (100 caractères au plus, espaces
  normalisés).
- `src/features/search/queries.ts` : `searchCountriesQuery`.
- `src/routes/_authenticated/search.tsx` : champ « Pays » avec suggestions tirées de cette
  liste. Aucune liste fictive.
- `src/integrations/supabase/types.ts` : ajout des deux fonctions.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 52 fonctions, extension `unaccent`.

## Tests (`etape-11.3-filtre-pays.mjs`) — 22/22

| Test | Résultat |
|---|---|
| Serveur : 3 écritures du même pays trouvées ; pas de correspondance approximative ni partielle ; pays sans profil ; profil sans pays ; profil masqué ; combiné au sexe et à l'âge | ✅ ×8 |
| Refus `invalid_filter` : vide, espaces, plus de 100 caractères, nombre, nul ; « % » traité comme du texte | ✅ ×6 |
| Liste des pays : « Côte d'Ivoire » une seule fois (3 profils, masqué non compté), Cameroun, Gabon ; visiteur refusé | ✅ ×2 |
| Page : suggestions réelles ; « cote d'ivoire » donne les 3 profils ; pays affiché sur la carte ; pays vidé | ✅ ×4 |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

## Problème rencontré

La première version choisissait « COTE  D IVOIRE » (ordre alphabétique) quand plusieurs
écritures étaient à égalité. La règle de choix préfère désormais la casse normale, puis
les accents, et réduit les espaces multiples. Le test vérifie « Côte d'Ivoire ».

## Non-régression

0.6 : 73/73 · 0.7 : 33/33 · 2.7 : 16/16 · 11.1 : 26/26 · 11.2 : 18/18 · 11.3 : 22/22.
Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 139
au total (fichier généré).
