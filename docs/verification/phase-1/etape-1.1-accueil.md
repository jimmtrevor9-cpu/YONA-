# Phase 1 — Étape 1.1 — Vérifier la page d'accueil

Date : 2026-09-25 · Statut : **VALIDÉE** (aucune modification de la page)

## Tests techniques (`etape-1.1-accueil.mjs`, Chromium) — 27/27

| Test | Résultat |
|---|---|
| 5 largeurs (320, 375, 768, 1024, 1440 px) : pas de défilement horizontal | ✅ |
| 5 largeurs : tous les textes apparaissent après défilement (animations) | ✅ |
| 5 largeurs : aucune erreur JavaScript | ✅ |
| Titre d'onglet, langue `fr`, description pour les moteurs de recherche | ✅ |
| Un seul titre principal (h1), images avec texte alternatif, boutons nommés, vidéo titrée | ✅ |
| Menu (Pourquoi YONA, Sécurité, Comment ça marche, Tarifs) → sections existantes | ✅ |
| 8 boutons d'action → `/register` ou `/login` ; « Créer un compte » et « Connexion » fonctionnent | ✅ |
| Captures pleine page aux 5 largeurs : mise en page conforme (rose poudré, prune, doré) | ✅ contrôle visuel |

## Non testable dans cet environnement

- Logo et 5 photos du carrousel : servis par le CDN de Lovable (`/__l5e/assets-v1/…`),
  disponibles uniquement sur l'hébergement Lovable.
- Vidéo Vimeo et polices Google : bloquées par le réseau de l'environnement de test.

## Conformité au cahier des charges

- Offres affichées conformes : Gratuit (3 photos, 5 demandes/jour, 3 questions
  Roi Salomon/jour, 3 messages après Match, Ice Breaker), déblocage 1 $ / 3 jours
  pour les deux participants, Premium 5 $/mois ou 35 $/an avec les 16 avantages.

## Points à décider par le propriétaire (non modifiés)

1. **Chiffres affichés** : « +12 000 membres actifs » et « 100 % profils vérifiés »
   alors que la plateforme n'a encore aucun membre.
2. **Témoignages** (Claire M., Jean-Marc T., Élise R.) présentés comme réels
   (« Ils ont rencontré leur moitié sur YONA »).
3. **Promesses non prévues au cahier des charges** : vérification manuelle de chaque
   inscription, photos floutées, mode discret.
4. **Pied de page** sans mentions légales, CGU ni politique de confidentialité
   (données religieuses = données sensibles, RGPD art. 9).
5. **Poids du logo** : 1,8 Mo pour un affichage de 56 px (lent sur mobile).
