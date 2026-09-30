# Phases 19 à 22 — Notifications, paramètres, blocage, signalement

Test : `etapes-19-a-22-notifications-parametres-blocage-signalement.mjs` — **44/44**.

- **19 Notifications** : Like, Match, message (regroupés par conversation), favori, visite
  (auteur masqué pour un gratuit), demande de contact ; compteur, « lu », « tout marquer comme
  lu » ; aucune écriture ni lecture possible des notifications d'un autre.
- **20 Paramètres** : profil visible/masqué, activité visible/masquée (présence « inconnue »),
  choix des notifications, mot de passe, liste des bloqués, suppression définitive du compte
  (mot « SUPPRIMER » + mot de passe).
- **21 Blocage** : Match et conversation fermés, demandes annulées, favoris retirés ; Like,
  favori, visite et message refusés ; déblocage depuis les Paramètres.
- **22 Signalement** : profil ou message, motif obligatoire, description ≤ 2 000 caractères,
  pas de doublon, 10 par jour ; écriture directe interdite.

Non testé en réel : l'envoi d'e-mails (aucun service d'e-mail branché, le choix est enregistré).
