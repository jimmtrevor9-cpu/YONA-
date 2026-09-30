# Phase 1 — Étape 1.10 — Vérifier la présentation

Date : 2026-09-26 · Statut : **VALIDÉE**

La présentation (`profiles.bio`) est saisie dans l'onboarding (étape « Vous ») et sur
la page Profil, et affichée en aperçu (3 lignes) sur les cartes de découverte.

## Problème trouvé (confirmé par test avant correction)

La base limite la présentation à 2 000 caractères (`profiles_bio_length`), mais les
champs de saisie n'avaient aucune limite : un texte plus long était refusé avec
« Enregistrement impossible. Réessayez. » et **rien n'était enregistré**.

## Correction

- `src/features/profiles/personal-info.ts` : `BIO_MAX_LENGTH = 2000` et message
  « La présentation est limitée à 2000 caractères. » si le serveur refuse.
- Onboarding et page Profil : `maxLength={BIO_MAX_LENGTH}` sur le champ.

Aucune modification de mise en page.

## Tests (`etape-1.10-presentation.mjs`) — 11/11

| Test | Résultat |
|---|---|
| Champ limité à 2000 caractères (onboarding, profil) | ✅ ×2 (absents avant) |
| Texte de 2100 caractères collé → enregistré, limité à 2000 | ✅ (échouait avant) |
| Accents, emojis, retours à la ligne enregistrés tels quels ; espaces autour retirés | ✅ |
| Après rechargement : texte identique | ✅ |
| Espaces seulement → présentation vide | ✅ |
| Code HTML / script : enregistré comme texte, affiché comme texte chez un autre membre, jamais exécuté (0 alerte, 0 balise injectée) | ✅ ×3 |
| Serveur (API directe) : 2001 caractères refusés | ✅ |
| Aucune erreur JavaScript | ✅ |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23.

## À savoir (non modifié)

- **Numéros de téléphone dans la présentation** : rien n'empêche un membre d'y écrire
  son numéro, ce qui contournerait la protection prévue pour la messagerie (Phase 6) et
  le déblocage payant (Phase 7). Recommandation : appliquer aussi à la présentation le
  détecteur de numéros construit en Phase 6.
- Sur les cartes, les retours à la ligne apparaissent comme des espaces (aperçu de 3
  lignes) ; le texte complet sera visible sur le profil détaillé (étape 3.7).
