# Ajouter uniquement l’action Like dans Découvrir

## Objectif
Conserver intégralement le projet fourni et ajouter sur chaque profil de `/discover` une action Like réelle, sans implémenter les Matchs ni aucune autre fonctionnalité future.

## Modifications prévues
- Importer le projet fourni comme base de référence, sans son historique Git ni ses dépendances générées, et sans remplacer son architecture.
- Ajouter un petit mécanisme de mutation dans le dossier existant des profils pour insérer un Like dans la table `likes` déjà présente.
- Déduire l’émetteur de la session authentifiée et laisser les règles existantes de la base vérifier l’identité, l’auto-Like et les blocages.
- Ajouter au composant de profil existant un bouton `Like` avec l’icône cœur et le composant Button du projet.
- Afficher un état de traitement, bloquer les clics répétés, confirmer le succès et présenter une erreur claire en cas d’échec.
- Marquer les profils déjà likés à partir des données réelles accessibles à l’utilisateur, afin d’éviter les doublons après actualisation.
- Retirer uniquement le texte devenu contradictoire annonçant les Likes comme fonctionnalité future.

## Limites respectées
- Aucune nouvelle table, migration, fonction SQL ou architecture parallèle.
- Aucun profil fictif et aucune donnée de démonstration.
- Aucun Pass, Match, message, notification, favori, paiement, quota, Premium ou autre étape future.
- Aucun changement visuel extérieur aux cartes de `/discover`.

## Validation
- Vérifier lint et compilation avec les commandes existantes.
- Vérifier `/discover` connecté : bouton visible, clic, chargement, succès, doublon et erreur.
- Vérifier qu’un visiteur non connecté est redirigé vers la connexion.
- Vérifier visuellement `/discover` en mobile et en ordinateur, y compris le cas sans profil.
- Contrôler les erreurs navigateur et l’absence de régression de navigation.
