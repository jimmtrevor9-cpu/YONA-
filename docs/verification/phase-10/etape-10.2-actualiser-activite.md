# Phase 10 — Étape 10.2 — Actualiser l'activité

Date : 2026-09-28 · Statut : **VALIDÉE**

## Réalisation

- `src/features/activity/useActivityTracking.ts` : après le signal d'ouverture
  (étape 10.1), l'activité est actualisée chaque minute tant que la page est visible, et
  aussitôt que la personne revient sur la page (onglet réaffiché, fenêtre au premier
  plan). Rien n'est envoyé quand la page est cachée, et pas plus d'un signal par
  30 secondes quand on revient plusieurs fois de suite sur la page. Tout s'arrête à la
  déconnexion.
- Migration `20260928190000_phase10_actualiser_activite.sql` (drizzle `0053`) :
  `touch_activity()` n'écrit rien si l'activité date de moins de 30 secondes (elle est
  déjà à jour) et répond `true`. Cela limite les écritures quand plusieurs onglets sont
  ouverts. Les règles de l'étape 10.1 sont inchangées.

## Tests (`etape-10.2-actualiser-activite.mjs`) — 12/12

L'horloge de la page est simulée (Playwright `clock`) pour avancer de plusieurs minutes.

| Test | Résultat |
|---|---|
| Ouverture : 1 signal ; +1 min : 1 signal, activité à jour ; +3 min : 3 signaux | ✅ ×3 |
| Page cachée pendant 2 min : aucun signal ; retour : signal immédiat ; 5 retours rapides : aucun doublon | ✅ ×3 |
| Serveur : 2 signaux à moins de 30 s, le 2e sans écriture ; après 30 s, écriture ; compte suspendu : `false` | ✅ ×3 |
| Après déconnexion : plus aucun signal ; aucune erreur JS ; nettoyage | ✅ ×3 |

## Non-régression

0.5 : 24/24 · 0.6 : 73/73 · 0.7 : 32/32 · 1.4 : 14/14 · 1.7 : 26/26 · 4.7 : 25/25 ·
4.9 : 22/22 · 10.1 : 15/15 · 10.2 : 12/12. Aucun compte restant.

Type-check : 0 erreur · Build : réussi · Lint : 126 hors fichier généré (inchangé), 1 121
au total.
