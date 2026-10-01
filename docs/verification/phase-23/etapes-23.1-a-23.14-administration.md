# Phase 23 — Administration (/admin)

Test : `etapes-23.1-a-23.14-administration.mjs` — **26/26**.

- Toutes les fonctions `admin_*` refusent un membre ou un visiteur (vérification en base).
- Tableau de bord, recherche et fiche d'un membre, signalements (traiter / rejeter), photos
  en attente (valider / refuser), paiements, abonnements, déblocages, tickets de support.
- Suspendre / réactiver / bannir : raison obligatoire, impossible sur soi ou un autre admin,
  chaque décision tracée ; un membre suspendu ou banni ne peut plus se connecter.
- Page /admin : redirection pour un non-admin, lien visible seulement pour l'admin, lisible à 320 px.
