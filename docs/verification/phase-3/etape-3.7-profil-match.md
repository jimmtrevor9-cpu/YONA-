# Phase 3 — Étape 3.7 — Ouvrir le profil depuis un Match

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

La liste des Matchs (étape 3.6) n'ouvrait rien. Les règles d'accès existantes suffisent :
Match lisible par ses participants ; profil, profil chrétien et photos validées lisibles
seulement si le profil reste visible pour la personne connectée ; préférences strictement
privées. Aucune modification de la base.

## Réalisation

- `src/features/matches/queries.ts` : `matchProfileQuery(matchId)` — Match actif de la
  personne connectée, puis profil (colonnes utiles seulement), profil chrétien et photos
  validées (principale d'abord, liens temporaires) de l'autre personne ; `null` si le Match
  n'existe pas, n'est pas actif, n'appartient pas à la personne, si le profil n'est plus
  visible, ou si l'adresse est mal formée. Les préférences ne sont jamais lues.
- `src/routes/_authenticated/matches_.$matchId.tsx` : page `/matches/<identifiant du Match>`
  (espace protégé) — grande photo et vignettes, prénom · âge, ville, profession, date du
  Match, présentation, foi (libellés des formulaires existants), valeurs chrétiennes,
  centres d'intérêt ; sections vides non affichées ; « Ce profil n'est pas disponible. »
  avec retour aux Matchs ; lien « Mes Matchs ».
- `src/routes/_authenticated/matches.tsx` : chaque Match de la liste est un lien
  « Voir le profil de … ».
- `src/routeTree.gen.ts` : régénéré par la construction.

## Tests (`etape-3.7-profil-match.mjs`) — 24/24

| Test | Résultat |
|---|---|
| Clic depuis la liste → /matches/<id> ; prénom, âge, ville, profession, date, présentation, foi, valeurs | ✅ ×5 |
| Préférences privées jamais lues ; seules les colonnes utiles demandées | ✅ ×2 |
| Photos : seules les validées, principale d'abord, vignettes cliquables | ✅ ×3 |
| Lien « Mes Matchs », Retour du navigateur, rechargement ; profil minimal sans section vide | ✅ ×3 |
| L'autre participant voit le profil ; un tiers, un identifiant inexistant ou mal formé → « non disponible » | ✅ ×4 |
| Profil masqué, Match défait, blocage → « non disponible » | ✅ ×3 |
| Sans connexion → /login ; 320 px ; aucune erreur JS ; nettoyage | ✅ ×4 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 ·
1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 · 1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 ·
1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 · 1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 ·
2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 · 2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 ·
2.7 : 16/16 · 2.8 : 29/29 · 3.1 : 19/19 · 3.2 : 21/21 · 3.3 : 16/16 · 3.4 : 17/17 ·
3.5 : 14/14 · 3.6 : 17/17 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (inchangé).
