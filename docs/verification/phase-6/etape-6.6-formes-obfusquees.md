# Phase 6 — Étape 6.6 — Détecter les formes obfusquées

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Les étapes 6.1 à 6.5 reconnaissaient les chiffres ordinaires séparés par des espaces,
tirets ou parenthèses. Un numéro volontairement déguisé (points, barres, émojis entre
les chiffres, chiffres spéciaux ou en lettres, lettre « o » pour zéro…) échappait encore
à la détection.

## Réalisation

- Migration `20260927230000_phase6_formes_obfusquees.sql` (miroir
  `drizzle/migrations/0033_phase6_formes_obfusquees.sql`) : `contains_phone_number`
  réécrite en conservant toutes les règles de 6.1 à 6.5, et complétée :
  - caractères invisibles supprimés (largeur nulle, sélecteurs d'émoji, touches) ;
  - chiffres spéciaux ramenés aux chiffres ordinaires (pleine largeur, exposants,
    indices, cerclés, gras / doubles / sans empattement / chasse fixe mathématiques,
    arabes-indiens, émojis touches) ;
  - nombres en lettres convertis : français (zéro à seize, dix-sept à dix-neuf, dizaines,
    soixante-dix…, quatre-vingt…, composés « trente-quatre », « soixante-dix-huit »,
    « quatre-vingt-douze », avec ou sans accents ni tirets) et anglais (zero à nine) ;
  - lettres « o », « l », « i », « | » entre des chiffres lues comme 0 ou 1 ;
  - tout signe entre les chiffres traité comme séparateur (points, barres, tirets bas,
    virgules, deux-points, étoiles, dièses, puces, émojis…) ainsi que les mots
    « point », « tiret », « espace », « virgule », « slash », « dot », « dash » ;
  - formes ordinaires écartées en plus : montants à séparateurs de milliers en points,
    virgules ou apostrophes, dates avec points ou barres, heures et plages horaires.
- Analyse rapide : environ 0,1 s pour un message de 4 000 caractères, même dans le pire
  cas (uniquement chiffres et séparateurs).

Limite connue (inchangée depuis 6.3) : une suite d'au moins quatre petits nombres
séparés (« 23, 24, 25, 26 ») ressemble à un numéro et sera considérée comme tel.

Aucun changement visible dans l'application.

## Tests (`etape-6.6-formes-obfusquees.mjs`) — 13/13

| Test | Résultat |
|---|---|
| Séparateurs variés : 16 numéros détectés (. / _ , : * # \| •, émojis, « point », « tiret ») ; 12 messages ordinaires acceptés (dates, heures, plages, montants, versets, scores, adresse) | ✅ ×2 |
| Chiffres spéciaux : 11 numéros détectés ; 3 messages acceptés | ✅ ×2 |
| Chiffres en lettres (français, anglais, mélangés) : 11 numéros détectés ; 8 phrases ordinaires acceptées (âges, heures, comptine, verset, année en lettres) | ✅ ×2 |
| Lettres à la place des chiffres : 6 numéros détectés ; 3 messages acceptés | ✅ ×2 |
| Exemples des étapes 6.1 à 6.5 toujours corrects ; fonction réservée au serveur | ✅ ×3 |
| Message long et pire cas de 4 000 caractères : analysés en ~0,1 s | ✅ ×2 |

## Non-régression

Base réinstallée à zéro (35 migrations). Tests 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 ·
6.4 : 5/5 · 6.5 : 5/5 ; contrôles de la base 0.6 : 73/73 · 0.7 : 32/32 — aucun compte
ni fichier de test restant. La fonction n'est encore utilisée par aucun traitement.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
