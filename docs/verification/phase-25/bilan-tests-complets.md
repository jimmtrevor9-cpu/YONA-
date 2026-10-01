# Phase 25 — Tous les tests (25.1 à 25.23)

Date : 2026-09-30. Base Supabase locale **remise à neuf** (`supabase db reset` : les 83
migrations appliquées sur une base vide), application construite (`npm run build`).

Résultat de la relance complète : **115 scripts, 113 réussis du premier coup**. Les 2
autres réussissent quand on les relance seuls :

- `phase-0/etape-0.6-rls-tests.mjs` : il compte les profils visibles et suppose une base
  sans autres comptes ; il avait tourné en même temps que le test de la phase 26.
- `phase-11/etape-11.5-filtre-distance.mjs` : un affichage (« Aucune position
  enregistrée ») lu trop tôt une fois ; 32/32 à la relance. Test sensible au temps.

Couverture des étapes du plan : inscription et onboarding (phases 0 et 1), photos (1.13,
15), Like / Pass / Match (2 et 3), conversation et 3 messages (4 et 5), protection du
téléphone (6), déblocage 1 USD et expiration (7), Premium mensuel et annuel (14),
Roi Salomon (13), favoris (8), visiteurs (9), présence (10), demandes de contact (12),
notifications, paramètres, blocage, signalement (19 à 22), administration (23), sécurité (24).

Anciens tests adaptés (sans rien retirer de ce qu'ils vérifient) : 0.2 crée son propre
compte de test ; 0.6 et 0.7 ne supposent plus une base vide ; 1.13 accepte « 0 / 10 · HD » ;
4.2 cherche l'onglet « Messages » par son nom exact ; 4.7 cible le bouton d'envoi (la zone
de message contient maintenant aussi Ice Breaker et le message vocal).

# Phase 26 — Validation technique finale

| Étape | Résultat |
|---|---|
| 26.1 TypeScript | `npx tsc --noEmit` : 0 erreur |
| 26.2 ESLint | `npm run lint` : 0 erreur (7 avertissements dans des composants d'interface fournis) |
| 26.3 Build | `npm run build` : OK ; page principale 182 Ko compressés, pages chargées à la demande |
| 26.4 Routes | 16 pages protégées → /login sans connexion (`phase-26/…routes-mobile-desktop.mjs`) |
| 26.5 Migrations | 83 migrations appliquées sur une base vide, sans erreur ; 28 tables, 2 tâches planifiées |
| 26.6 Mobile | 16 pages en 320 et 390 px, sans défilement horizontal |
| 26.7 Ordinateur | 16 pages en 1280 px, sans défilement horizontal |
| 26.8 Performances | Code découpé par page (91 fichiers), requêtes limitées côté base |
| 26.9 / 26.10 Non-régression | Relance complète ci-dessus |
