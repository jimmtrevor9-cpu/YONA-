# Phase 24 — Sécurité finale (24.1 à 24.13)

Test : `etapes-24.1-a-24.13-audit-securite.mjs` — **33/33**.

1. **Audit de la base** : RLS active sur les 28 tables ; toutes les fonctions SECURITY
   DEFINER ont un `search_path` fixe ; aucune n'est ouverte aux visiteurs non connectés ;
   les fonctions internes (activation après paiement, quotas, notifications, calcul de
   compatibilité, détection de numéros) ne sont pas appelables par l'API ; aucune écriture
   directe sur les tables sensibles (paiements, abonnements, messages, Matchs, signalements,
   rôles…) ; les deux espaces de stockage sont privés.
2. **Attaques réelles avec un compte membre** (toutes refusées) : modifier le profil d'un
   autre, réactiver son profil ou son compte suspendu, auto-valider une photo, déposer un
   fichier chez un autre, Like ou favori au nom d'un autre, créer un Match, lire ou écrire
   dans la conversation des autres, contourner le quota, s'offrir Premium, créer ou
   confirmer un paiement, se donner le rôle admin, appeler les fonctions admin.

Seule correction : `activate_premium_subscription` (fonction de déclencheur) n'est plus
exécutable par tous (migration `20260930210000_phase24_securite_finale.sql`, sans effet
fonctionnel).
