# Phase 3 — Étape 3.1 — Détecter un Like réciproque

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Table `matches` présente (paire ordonnée, unique), lisible par ses participants, sans
  aucune écriture possible par les membres ; aucune logique de Match.
- Rien ne détectait qu'un Like répondait à un Like reçu. Le membre ne peut pas le vérifier
  lui-même : il ne lit que ses Likes envoyés (voulu, pour la confidentialité).

## Réalisation

- `supabase/migrations/20260926190000_phase3_like_reciproque.sql` (+ miroir
  `drizzle/migrations/0016_…`) : fonction `has_mutual_like(_other)` — vrai seulement si la
  personne connectée et `_other` ont chacune un Like **actif** (pas un Pass, pas retiré)
  envers l'autre, sans blocage. Ne répond que pour la personne connectée : sans son propre
  Like, toujours « faux » (impossible de savoir qui vous a aimé sans aimer soi-même) ;
  refusée aux visiteurs non connectés.
- `src/features/profiles/likes.functions.ts` : `likeProfile` renvoie `mutual`
  (vrai / faux) après chaque Like, y compris un Like déjà enregistré.
- `src/integrations/supabase/types.ts` : fonction déclarée.
- `docs/CONNECTER_UNE_BASE_SUPABASE.md` : 34 fonctions.

Aucun changement visible : la création du Match est l'étape 3.2, son affichage l'étape
3.4. Test 2.3 adapté (la réponse du serveur contient désormais `mutual`).

## Tests (`etape-3.1-like-reciproque.mjs`) — 19/19

| Test | Résultat |
|---|---|
| Aucun Like / Like à sens unique : « faux » ; Likes croisés : « vrai » des deux côtés | ✅ ×4 |
| Confidentialité : Like reçu non deviné ; tiers ; visiteur refusé ; soi-même | ✅ ×4 |
| Pass ≠ Like ; Like retiré ; blocage → « faux » | ✅ ×4 |
| Page : réponse du serveur « réciproque » / « pas réciproque », confirmée par la base | ✅ ×4 |
| Aucun Match créé (étape 3.2) ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

Base réinstallée à zéro (18 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 · 1.14 : 34/34 · 1.15 : 31/31 · 2.1 : 20/20 · 2.2 : 25/25 · 2.3 : 18/18 ·
2.4 : 13/13 · 2.5 : 19/19 · 2.6 : 25/25 · 2.7 : 16/16 · 2.8 : 29/29 — aucun compte ni
fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 051 (+1 : ligne ajoutée dans le fichier
généré `types.ts`, format sans point-virgule conservé ; autres fichiers sans remarque).
