# Phase 1 — Étape 1.15 — Vérifier l'éligibilité à la découverte

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Profils proposés : déjà limités par les règles d'accès (actif, visible, compte actif,
  sans blocage, hors soi-même) — vérifié à l'étape 1.14.
- **Faille** : un compte sans profil finalisé, un profil suspendu ou un compte suspendu
  pouvait parcourir tous les profils, leurs informations chrétiennes et leurs photos.
- Les préférences enregistrées (sexe recherché, tranche d'âge) n'étaient **jamais
  utilisées** par la découverte.
- Message de liste vide trompeur pour un membre au profil déjà finalisé
  (« Complétez le vôtre pour être visible »).

## Réalisation

**Serveur** — `supabase/migrations/20260926150000_phase1_eligibilite_decouverte.sql`
(+ miroir `drizzle/migrations/0012_…`) :
- `can_browse_profiles()` : peut parcourir = compte actif et profil finalisé (statut
  « actif » ou « masqué »), ou administrateur ; ajouté aux 4 règles de lecture (profils,
  profils chrétiens, photos, fichiers photos) ;
- `discover_profiles(_limit)` : profils proposés, avec les droits du membre (règles
  d'accès appliquées), filtrés par sexe recherché et tranche d'âge, les plus récemment
  mis à jour d'abord, 50 au maximum, uniquement les champs de la carte.

**Interface** :
- `src/features/profiles/discovery.ts` : `discoverFeedQuery` (appel du serveur) ;
- `src/routes/_authenticated/discover.tsx` : profil non finalisé → « Finalisez votre
  profil pour découvrir les autres membres. » + Continuer ; suspendu → message ;
  liste vide → « Aucun profil ne correspond à vos préférences pour le moment… » ;
- `src/integrations/supabase/types.ts` : 2 fonctions ajoutées.

La page Recherche garde sa requête (filtres explicites, Phase 11) ; les règles d'accès
s'y appliquent aussi (un membre non éligible n'y voit aucun profil).

## Tests (`etape-1.15-eligibilite-decouverte.mjs`) — 31/31

| Test | Résultat |
|---|---|
| Profils proposés = exactement les éligibles conformes aux préférences | ✅ ×2 |
| Soi-même, sexe non recherché, hors tranche d'âge (24, 41, 45 ans) exclus | ✅ ×3 |
| Bornes d'âge incluses (25 ans aujourd'hui, 40 ans veille des 41) | ✅ |
| Masqué, bloqué, compte suspendu exclus | ✅ |
| Ordre, champs renvoyés limités à la carte | ✅ ×2 |
| Préférences modifiées prises en compte ; limites 1 / 50 | ✅ ×3 |
| Nouveau profil proposé automatiquement ; liste vide sans erreur | ✅ ×2 |
| Membre éligible : accès profil, foi, photo, fichier | ✅ |
| Non finalisé, profil suspendu, compte suspendu : aucun accès | ✅ ×3 |
| Profil masqué par son propriétaire : peut découvrir ; propre profil lisible ; visiteur 401 | ✅ ×3 |
| Page : cartes exactes, pas de message, liste vide expliquée | ✅ ×3 |
| Page : non finalisé (message + Continuer → /onboarding), suspendu | ✅ ×3 |
| 320 px, aucune erreur JavaScript, préparation, nettoyage | ✅ ×4 |

## Non-régression

Base réinstallée à zéro (14 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 050 (+12, toutes dans le fichier généré
`types.ts`, format sans point-virgule conservé ; autres fichiers sans remarque).
