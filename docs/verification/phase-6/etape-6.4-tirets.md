# Phase 6 — Étape 6.4 — Détecter les tirets

Date : 2026-09-27 · Statut : **VALIDÉE**

## Constat

Un numéro écrit avec des tirets (« 06-12-34-56-78 ») ou des tirets typographiques
(–, —, −…) échappait à la détection des étapes 6.1 à 6.3.

## Réalisation

- Migration `20260927210000_phase6_tirets.sql` (miroir
  `drizzle/migrations/0031_phase6_tirets.sql`) : `contains_phone_number`
  - tirets typographiques (‐ ‑ ‒ – — − ﹣ －) ramenés au tiret simple ;
  - tirets entre les chiffres ignorés, seuls, doublés ou mêlés d'espaces ;
  - formes ordinaires écartées : dates avec tirets (« 12-10-2026 », « 2026-10-12 ») et
    périodes d'années (« 2025-2026 ») ; les références bibliques et les tranches
    (« 15:11-32 », « 25-30 ans », « 10h-12h ») restent trop courtes pour ressembler à un
    numéro ;
  - règles de 6.1 à 6.3 conservées ; toujours réservée au serveur.

Aucun changement visible dans l'application.

## Tests (`etape-6.4-tirets.mjs`) — 5/5

| Test | Résultat |
|---|---|
| 18 numéros avec tirets détectés (paires, triplets, un par un, avec indicatif, tirets doublés, mêlés d'espaces, 7 sortes de tirets typographiques) | ✅ |
| 12 messages sans numéro acceptés (versets, dates, périodes, tranches d'âge, horaires, prix, chambre) | ✅ |
| Exemples des étapes 6.1 à 6.3 toujours corrects ; fonction réservée au serveur | ✅ ×3 |

## Non-régression

Tests 6.1 : 6/6 · 6.2 : 5/5 · 6.3 : 5/5. La fonction n'est encore utilisée par aucun
traitement.

Type-check : 0 erreur · Build : réussi (aucun changement de code applicatif) ·
Lint : 1 098 (inchangé).
