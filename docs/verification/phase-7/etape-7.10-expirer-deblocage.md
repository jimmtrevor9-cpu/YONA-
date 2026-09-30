# Phase 7 — Étape 7.10 — Expirer après 3 jours

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Chaque déblocage a une date de fin fixée par le serveur (3 jours après son début,
étape 7.7) et `has_active_conversation_unlock` ne le compte que tant que cette date
n'est pas passée : l'effet s'arrête donc déjà à l'heure exacte. En revanche, le statut
du déblocage restait « actif » pour toujours, ce qui aurait faussé l'historique
(administration, statistiques).

## Réalisation

- Migration `20260928090000_phase7_expirer_deblocage.sql` (miroir
  `drizzle/migrations/0043_phase7_expirer_deblocage.sql`) :
  - `expire_conversation_unlocks()` : passe au statut « expiré » tout déblocage actif
    dont la date de fin est passée ; renvoie le nombre concerné ; réservée au serveur ;
  - tâche planifiée `yona-expirer-deblocages` toutes les 5 minutes (extension pg_cron,
    créée si l'hébergeur la propose ; sinon la migration continue, l'expiration par date
    restant exacte) ; rattrapage immédiat à l'installation.
- `.env.example` et `docs/CONNECTER_UNE_BASE_SUPABASE.md` : réglage `PAYMENT_PROVIDER`
  documenté (vide tant qu'aucun prestataire réel ; « test » réservé aux environnements
  de vérification), tâche planifiée et 47 fonctions.

Aucun changement de l'interface : à la fin de la période, l'écran revient de lui-même à
l'état « quota épuisé » (bandeau retiré, champ fermé, offre de nouveau proposée).

## Tests (`etape-7.10-expirer-deblocage.mjs`) — 16/16

| Test | Résultat |
|---|---|
| Déblocage de 3 jours exactement ; envoi accepté pendant la période | ✅ ×2 |
| 3 s avant la fin : débloquée ; date passée : plus débloquée pour les deux, sans intervention ; quota de nouveau appliqué ; statut encore « actif » avant la tâche | ✅ ×4 |
| Tâche : 1 déblocage « expiré », puis 0 ; tâche planifiée toutes les 5 minutes ; non appelable par un membre ; réactivation par un membre refusée | ✅ ×5 |
| Écran : bandeau retiré, champ fermé, offre de nouveau proposée | ✅ ×2 |
| Nouveau paiement : nouveau déblocage, l'ancien reste « expiré » | ✅ |
| Aucune erreur JS ; nettoyage | ✅ ×2 |

Premier passage : 15/16 — erreur du test (conversion du statut en texte dans une
requête de vérification) ; corrigée.

## Non-régression

Séries touchant la base, la messagerie et le déblocage (phases 0, 4, 5, 6, 7) :
0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 4.1 : 18/18 · 4.2 : 14/14 · 4.3 : 15/15 ·
4.4 : 20/20 · 4.5 : 21/21 · 4.6 : 26/26 · 4.7 : 25/25 · 4.8 : 42/42 · 4.9 : 22/22 ·
4.10 : 29/29 · 5.1 : 13/13 · 5.2 : 15/15 · 5.3 : 13/13 · 5.4 : 13/13 · 5.5 : 15/16 ·
5.6 : 18/18 · 5.7 : 22/22 · 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5 · 6.4 : 5/5 · 6.5 : 5/5 ·
6.6 : 13/13 · 6.7 : 13/13 · 6.8 : 16/16 · 6.9 : 15/15 · 6.10 : 16/16 · 7.1 : 12/12 ·
7.2 : 14/14 · 7.3 : 11/11 · 7.4 : 10/10 · 7.5 : 26/26 · 7.6 : 21/21 · 7.7 : 17/17 ·
7.8 : 19/19 · 7.9 : 18/18 · 7.10 : 16/16 — aucun compte ni fichier de test restant.

5.5 : 15/16 lors de ce passage — non reproduit sur 8 exécutions suivantes (16/16 à
chaque fois). Le script de série ne gardait que la dernière ligne de chaque test : la
vérification en échec n'a pas été conservée. Aucun code utilisé par 5.5 n'a changé à
cette étape (seulement la tâche d'expiration des déblocages). Le script de série garde
désormais les lignes en échec pour les prochains passages.
(Phases 1 à 3 non concernées ; série complète prévue en fin de phase 7.)

Base réinstallée à zéro (45 migrations, tâche planifiée créée). Type-check : 0 erreur ·
Build : réussi (aucun changement de code applicatif) · Lint : 1 111 (inchangé).
