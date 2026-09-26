# Phase 1 — Étape 1.14 — Vérifier la visibilité du profil

Date : 2026-09-26 · Statut : **VALIDÉE**

## Constat

- Règles de lecture en place (étape 0.6) : un profil, son profil chrétien, ses photos
  validées et leurs fichiers ne sont montrés aux autres que si le profil est « actif »,
  « visible », le compte actif et sans blocage. Vérifiées ici de bout en bout.
- **Faille** : un membre pouvait passer son profil en « actif » directement via l'API,
  sans prénom, sexe ni date de naissance → profil vide montré aux autres.
- **Faille** : un membre pouvait se mettre lui-même « suspendu » (statut réservé à la
  modération), puis ne plus pouvoir en sortir.
- Le membre ne savait pas si son profil était visible.

## Réalisation

**Serveur** — `supabase/migrations/20260926140000_phase1_visibilite_profil.sql` (+ miroir
`drizzle/migrations/0011_…`) : déclencheur `profiles_check_visibility`
(fonction `check_profile_visibility`) sur les requêtes des membres :
- statut « actif » refusé sans prénom (non vide), sexe et date de naissance
  (`profile_incomplete`, HTTP 400) — y compris en effaçant ces champs plus tard ;
- passage en « suspendu » refusé (`profile_status_forbidden`, HTTP 403).
Administrateurs et serveur non concernés.

**Interface** :
- `src/features/profiles/visibility.ts` : état de visibilité du profil du membre ;
- `src/routes/_authenticated/profile.tsx` : message en haut de la page Profil
  (« visible », « masqué », « suspendu » ; profil non finalisé : « … il n'est pas encore
  visible par les autres membres » + bouton Continuer existant) ;
- `src/features/profiles/personal-info.ts` : traduction du refus `profile_incomplete`.

Le réglage « masquer mon profil » par le membre est prévu à l'étape 20.2 (`/settings`).

## Tests (`etape-1.14-visibilite-profil.mjs`) — 34/34

| Test | Résultat |
|---|---|
| Visible : profil, foi, photo et fichier vus par un autre membre | ✅ |
| Non finalisé invisible ; son propre profil toujours lisible | ✅ ×2 |
| « Actif » sans sexe/date, sans date, prénom vide : refusé | ✅ ×3 |
| Se mettre « suspendu » : refusé (403) | ✅ |
| Profil complet : « actif » accepté et visible | ✅ ×2 |
| Profil actif : effacer sexe / date refusé | ✅ ×2 |
| Masqué (visibilité ou statut) → invisible ; réaffiché → visible | ✅ ×5 |
| Suspendu (modération) invisible, non levable par le membre | ✅ ×2 |
| Compte suspendu invisible ; blocage dans les deux sens ; déblocage | ✅ ×4 |
| Découverte : carte présente / absente / revenue ; non finalisé absent | ✅ ×4 |
| Messages de la page Profil (visible, masqué, suspendu, non finalisé) | ✅ ×4 |
| 320 px sans débordement ; aucune erreur JavaScript ; nettoyage | ✅ ×4 |

Remarque : un Like vers un profil masqué reste accepté par la base (règle
`likes_insert_own`) ; la fonction serveur `likeProfile` le refuse déjà. À traiter à
l'étape 2.2 (Enregistrer le Like).

## Non-régression

Base réinstallée à zéro (13 migrations). 0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 ·
1.1 : 27/27 · 1.2 : 12/12 · 1.3 : 16/16 · 1.4 : 14/14 · 1.5 : 16/16 · 1.6 : 17/17 ·
1.7 : 26/26 · 1.8 : 18/18 · 1.9 : 23/23 · 1.10 : 11/11 · 1.11 : 16/16 · 1.12 : 18/18 ·
1.13 : 23/23 — aucun compte ni fichier de test restant.

Type-check : 0 erreur · Build : réussi · Lint : 1 038 (inchangé, fichiers modifiés sans
remarque).
