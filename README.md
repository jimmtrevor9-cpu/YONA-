# Faithful Connections

PHASE 1 — FONDATIONS TECHNIQUES DU SAAS



RÔLE



Tu es un ingénieur logiciel senior spécialisé dans la conception et le développement de SaaS modernes, sécurisés, évolutifs et maintenables.



Tu dois agir comme :



- Software Architect ;

- Senior Full-Stack Developer ;

- Database Architect ;

- Security Engineer ;

- UX/UI Engineer.



Tu vas construire progressivement une plateforme SaaS de rencontre chrétienne.



IMPORTANT :



NE CONSTRUIS PAS TOUTE L'APPLICATION MAINTENANT.



Nous allons développer l'application par phases successives.



Cette première intervention correspond UNIQUEMENT à :



PHASE 1 — FONDATIONS TECHNIQUES



Ton objectif est de mettre en place une architecture solide qui permettra de construire les fonctionnalités suivantes progressivement sans devoir refaire la base du projet.



---



1. OBJECTIF DU PRODUIT



Nous construisons une plateforme de rencontre chrétienne permettant aux utilisateurs de :



- créer un compte ;

- créer un profil chrétien détaillé ;

- rechercher d'autres utilisateurs ;

- découvrir des profils ;

- swiper ;

- liker ;

- obtenir des Matchs ;

- discuter après un Match ;

- débloquer individuellement une conversation ;

- souscrire à Premium.



Mais ces fonctionnalités seront développées dans les phases suivantes.



Pour cette Phase 1, concentre-toi sur l'architecture et les fondations.



---



2. AUTHENTIFICATION



Mettre en place une architecture d'authentification propre.



Prévoir :



- inscription ;

- connexion ;

- déconnexion ;

- gestion des sessions ;

- récupération du mot de passe ;

- protection des routes ;

- distinction entre utilisateur et administrateur.



Prévoir deux rôles :



USER



ADMIN



Les permissions doivent être conçues de manière sécurisée.



---



3. BASE DE DONNÉES



Créer une structure relationnelle propre et normalisée.



Prévoir au minimum les entités suivantes :



users



Contenir les informations fondamentales du compte.



Prévoir notamment :



- id ;

- email ;

- statut du compte ;

- rôle ;

- date de création ;

- date de mise à jour ;

- dernière activité ;

- informations nécessaires à l'authentification.



---



profiles



Informations générales du profil.



Prévoir notamment :



- user_id ;

- prénom ;

- date de naissance ou âge calculable ;

- sexe ;

- localisation ;

- profession ;

- études ;

- situation matrimoniale ;

- enfants ;

- biographie ;

- statut du profil ;

- visibilité.



---



christian_profiles



Informations relatives au profil chrétien.



Prévoir une architecture extensible permettant d'ajouter de nouveaux champs.



Exemples :



- dénomination ;

- engagement dans la foi ;

- participation à l'église ;

- pratique de la prière ;

- vision du mariage ;

- valeurs chrétiennes ;

- vision du couple.



---



preferences



Préférences de recherche.



Prévoir notamment :



- âge minimum ;

- âge maximum ;

- sexe recherché ;

- localisation ;

- distance ;

- préférences liées au profil chrétien ;

- projet sentimental ;

- projet familial ;

- autres critères.



La structure doit être facilement extensible.



---



photos



Prévoir :



- id ;

- user_id ;

- URL/storage reference ;

- photo principale ;

- ordre ;

- statut ;

- date de création.



---



likes



Prévoir :



- id ;

- sender_id ;

- receiver_id ;

- date ;

- statut éventuel.



Ajouter les contraintes nécessaires pour éviter les doublons et les auto-Likes.



---



matches



Prévoir :



- id ;

- user_1_id ;

- user_2_id ;

- created_at ;

- statut.



Un Match doit être unique pour une paire d'utilisateurs.



---



conversations



Prévoir :



- id ;

- match_id ;

- user_1_id ;

- user_2_id ;

- statut ;

- created_at ;

- updated_at.



---



messages



Prévoir :



- id ;

- conversation_id ;

- sender_id ;

- contenu ;

- statut ;

- created_at ;

- informations nécessaires à la modération.



Prévoir dès maintenant les champs nécessaires à une future détection des numéros de téléphone.



---



conversation_unlocks



Prévoir :



- id ;

- conversation_id ;

- paid_by_user_id ;

- amount ;

- currency ;

- starts_at ;

- expires_at ;

- status ;

- payment_id.



Le système doit permettre de savoir qu'un seul paiement peut débloquer une conversation pour les deux participants.



---



subscriptions



Prévoir :



- id ;

- user_id ;

- plan ;

- amount ;

- currency ;

- status ;

- starts_at ;

- expires_at ;

- payment_id.



Le plan Premium doit pouvoir être identifié clairement.



---



payments



Prévoir :



- id ;

- user_id ;

- type ;

- amount ;

- currency ;

- provider ;

- provider_transaction_id ;

- status ;

- metadata ;

- created_at ;

- updated_at.



Ne jamais considérer le paiement comme valide uniquement parce que le frontend indique qu'il a réussi.



---



reports



Prévoir :



- id ;

- reporter_id ;

- reported_user_id ;

- conversation_id éventuelle ;

- message_id éventuel ;

- reason ;

- description ;

- status ;

- created_at.



---



blocks



Prévoir :



- id ;

- blocker_id ;

- blocked_id ;

- created_at.



Empêcher les interactions normales entre utilisateurs bloqués.



---



moderation_actions



Prévoir :



- id ;

- admin_id ;

- target_user_id ;

- action ;

- reason ;

- metadata ;

- created_at.



---



user_activity



Prévoir les informations nécessaires pour gérer :



- dernière connexion ;

- dernière activité ;

- présence éventuelle ;

- événements importants.



---



4. RELATIONS



Mettre en place correctement les relations entre les entités.



Architecture logique :



USER



↓



PROFILE



↓



CHRISTIAN PROFILE



↓



PREFERENCES



↓



PHOTOS



USER



↓



LIKES



↓



MATCHES



↓



CONVERSATIONS



↓



MESSAGES



CONVERSATION



↓



CONVERSATION UNLOCK



↓



PAYMENT



USER



↓



SUBSCRIPTION



↓



PAYMENT



Prévoir des clés étrangères, contraintes et index appropriés.



---



5. SÉCURITÉ



C'est une priorité absolue.



Les données ne doivent pas être accessibles directement à un autre utilisateur simplement parce qu'il connaît un ID.



Prévoir des règles d'accès strictes.



Un utilisateur doit uniquement pouvoir :



- modifier son propre profil ;

- modifier ses propres préférences ;

- gérer ses propres photos ;

- consulter les données autorisées des autres profils ;

- accéder uniquement aux conversations auxquelles il appartient ;

- envoyer des messages uniquement lorsqu'il est autorisé.



L'ADMIN doit disposer de permissions spécifiques.



---



6. RÈGLES MÉTIER À PRÉPARER



Même si nous ne développons pas encore ces fonctionnalités, l'architecture doit être capable de gérer :



Messages gratuits



Maximum :



3 messages par conversation après Match.



---



Déblocage



Prix :



350 FCFA



Durée :



3 jours.



Lorsqu'un utilisateur paie :



la conversation correspondante est débloquée pour les deux participants.



---



Premium



Prix :



2 500 FCFA / mois.



Premium + Premium :



conversation illimitée.



Premium + Gratuit :



règle normale des 3 messages puis déblocage individuel.



---



7. DERNIÈRE CONNEXION



Préparer la structure nécessaire pour afficher ultérieurement :



- En ligne ;

- Actif récemment ;

- Dernière activité.



Ne pas afficher d'informations sensibles inutilement.



---



8. MODÉRATION DES MESSAGES



Préparer l'architecture afin qu'avant l'enregistrement définitif d'un message, le serveur puisse effectuer des contrôles de sécurité.



Notamment :



détection future des numéros de téléphone.



IMPORTANT :



Le contrôle devra être effectué côté serveur.



Le frontend ne devra jamais être considéré comme une protection suffisante.



---



9. STRUCTURE DE NAVIGATION



Créer uniquement les routes et écrans fondamentaux nécessaires à l'architecture.



Prévoir notamment :



- "/"

- "/login"

- "/register"

- "/onboarding"

- "/profile"

- "/search"

- "/discover"

- "/matches"

- "/messages"

- "/messages/:conversationId"

- "/premium"

- "/settings"

- "/admin"



Les fonctionnalités de chaque page seront développées dans les phases suivantes.



Pour l'instant, certaines pages peuvent être des placeholders propres et fonctionnels.



---



10. DESIGN SYSTEM



Créer une première base visuelle.



Direction artistique :



- premium ;

- moderne ;

- élégante ;

- chaleureuse ;

- rassurante ;

- chrétienne ;

- orientée relation sérieuse.



L'interface doit être :



- mobile-first ;

- responsive ;

- propre ;

- accessible ;

- cohérente.



Créer des composants réutilisables :



- Button ;

- Input ;

- Select ;

- Card ;

- Modal ;

- Avatar ;

- ProfileCard ;

- Badge ;

- Navigation ;

- Toast ;

- Loading state ;

- Empty state ;

- Error state.



---



11. ARCHITECTURE DU CODE



Organiser le projet de manière modulaire.



Séparer clairement :



- authentification ;

- utilisateurs ;

- profils ;

- préférences ;

- découverte ;

- Likes ;

- Matches ;

- conversations ;

- messages ;

- paiements ;

- Premium ;

- modération ;

- administration.



Ne pas créer un énorme fichier contenant toute la logique.



Le code doit être :



- lisible ;

- maintenable ;

- réutilisable ;

- évolutif.



---



12. CE QUE TU NE DOIS PAS ENCORE DÉVELOPPER



NE construis PAS complètement maintenant :



- le Swipe fonctionnel ;

- l'algorithme de découverte ;

- le système complet de Like ;

- la création automatique des Matchs ;

- la messagerie complète ;

- le compteur des 3 messages ;

- le paiement réel ;

- le déblocage réel ;

- l'abonnement Premium réel ;

- la détection complète des numéros ;

- les notifications avancées ;

- l'algorithme avancé de compatibilité.



Ces éléments seront construits dans les prochaines phases.



---



13. OBJECTIF FINAL DE CETTE PHASE



À la fin de cette Phase 1, je veux avoir :



1. une architecture de projet propre ;

2. une base de données structurée ;

3. les relations entre les tables ;

4. l'authentification ;

5. les rôles USER / ADMIN ;

6. les protections de base ;

7. les routes principales ;

8. les composants UI fondamentaux ;

9. une structure prête à accueillir les fonctionnalités suivantes.



NE cherche pas à impressionner en ajoutant des fonctionnalités non demandées.



La prior ité est :



SOLIDITÉ → SÉCURITÉ → EXTENSIBILITÉ → CLARTÉ



---



14. AVANT DE CODER



Commence par analyser cette spécification.



Détermine :



- l'architecture technique ;

- les tables ;

- les relations ;

- les contraintes ;

- les permissions ;

- les routes ;

- les composants principaux ;

- les risques techniques.



Puis implémente uniquement la Phase 1.



À la fin, fournis un résumé clair de :



- ce qui a été créé ;

- les tables créées ;

- les relations ;

- les règles de sécurité ;

- les routes ;

- les composants ;

- ce qui reste volontairement à construire dans la Phase 2.



IMPORTANT : NE PAS PASSER À LA PHASE 2 AUTOMATIQUEMENT.



CAHIER DES CHARGES COMPLET



Plateforme SaaS de rencontre chrétienne



1. VISION DU PROJET



Créer une plateforme SaaS de rencontre chrétienne moderne, sécurisée, premium et orientée vers les relations sérieuses.



La plateforme doit combiner :



- la richesse des profils et des critères de recherche d'une plateforme comme Meetic ;

- la simplicité et le système de découverte par swipe inspiré de Tinder ;

- un système de Match basé sur les Likes réciproques ;

- un système de messagerie freemium ;

- une monétisation par déblocage individuel de conversation ;

- un abonnement Premium mensuel ;

- un système de protection contre le partage de numéros de téléphone ;

- une architecture SaaS évolutive permettant d'ajouter ultérieurement de nouvelles fonctionnalités.



L'objectif du MVP est de permettre à un utilisateur de :



1. créer un compte ;

2. construire un profil chrétien détaillé ;

3. définir ses préférences ;

4. rechercher d'autres membres ;

5. découvrir des profils ;

6. liker des profils ;

7. obtenir un Match lorsque le Like est réciproque ;

8. commencer une conversation ;

9. envoyer jusqu'à trois messages gratuitement après un Match ;

10. payer pour débloquer une conversation pendant trois jours ;

11. souscrire à Premium ;

12. bénéficier de conversations illimitées lorsqu'il échange avec un autre membre Premium.



---



2. TYPES D'UTILISATEURS



2.1 Utilisateur gratuit



Un utilisateur gratuit peut :



- créer un compte ;

- se connecter ;

- compléter son profil ;

- ajouter ses photos ;

- renseigner ses informations chrétiennes ;

- définir ses préférences ;

- rechercher des profils ;

- consulter les profils ;

- voir la dernière connexion d'un profil ;

- utiliser le système de découverte ;

- swiper ;

- liker des profils ;

- obtenir des Matchs ;

- consulter ses Matchs ;

- ouvrir une conversation après un Match ;

- envoyer maximum trois messages gratuits dans une conversation.



Restrictions :



- il ne peut pas voir la liste des personnes qui l'ont liké avant Match ;

- il ne peut pas envoyer plus de trois messages gratuits dans une conversation sans déblocage ;

- il ne bénéficie pas automatiquement de conversations illimitées avec les utilisateurs Premium ;

- il doit payer le déblocage individuel lorsqu'il souhaite continuer une conversation avec une personne donnée.



---



3. SYSTÈME DE LIKE ET DE MATCH



Le système fonctionne de manière réciproque.



Exemple :



Utilisateur A → Like → Utilisateur B.



À ce stade :



- aucun Match n'est créé ;

- B ne doit pas voir que A l'a liké dans son espace gratuit.



Si B Like également A :



Utilisateur A → Like → Utilisateur B

Utilisateur B → Like → Utilisateur A



Alors :



MATCH = TRUE



Les deux utilisateurs sont informés du Match.



Un Match crée automatiquement une conversation associée aux deux utilisateurs.



---



4. SYSTÈME DE DÉCOUVERTE



La plateforme doit proposer deux modes complémentaires.



4.1 Recherche avancée



L'utilisateur peut rechercher des profils selon différents critères.



Exemples :



- sexe ;

- tranche d'âge ;

- localisation ;

- distance ;

- statut matrimonial ;

- situation familiale ;

- présence d'enfants ;

- dénomination/confession ;

- niveau d'engagement chrétien ;

- projet de couple ;

- projet familial ;

- centres d'intérêt ;

- certaines préférences personnelles.



Les critères exacts doivent être configurables dans l'architecture afin de pouvoir être enrichis ultérieurement.



4.2 Découverte / Swipe



L'utilisateur peut découvrir les profils compatibles sous forme de cartes.



Actions :



- Swipe gauche = passer ;

- Swipe droite = Like ;

- clic = consulter le profil détaillé.



La logique de découverte doit éviter autant que possible :



- les profils déjà likés ;

- les profils déjà refusés ;

- les utilisateurs bloqués ;

- les utilisateurs signalés ;

- son propre profil ;

- les profils incompatibles avec les critères fondamentaux.



---



5. PROFIL UTILISATEUR



Le profil doit être beaucoup plus détaillé qu'un simple profil de réseau social.



Informations personnelles



Le profil peut contenir :



- prénom ;

- âge ;

- sexe ;

- ville/pays ;

- profession ;

- niveau d'études ;

- situation matrimoniale ;

- enfants ;

- informations générales.



Profil chrétien



Le profil doit permettre de renseigner notamment :



- dénomination/confession ;

- niveau d'engagement dans la foi ;

- fréquence de participation à l'église ;

- place de la foi dans la vie ;

- pratique de la prière ;

- vision de la relation chrétienne ;

- valeurs importantes ;

- vision du mariage.



Les champs doivent être configurables et extensibles.



Personnalité



Exemples :



- personnalité ;

- centres d'intérêt ;

- loisirs ;

- passions ;

- habitudes ;

- qualités ;

- valeurs ;

- style de vie.



Projet sentimental



Le membre doit pouvoir indiquer :



- recherche d'une relation sérieuse ;

- recherche du mariage ;

- vision du couple ;

- projet familial ;

- désir d'avoir des enfants ;

- vision du rôle de chacun dans le couple ;

- valeurs recherchées chez un partenaire.



Photos



Un utilisateur doit pouvoir :



- ajouter plusieurs photos ;

- sélectionner une photo principale ;

- supprimer une photo ;

- réorganiser ses photos.



Les photos doivent être protégées et modérables.



---



6. DERNIÈRE CONNEXION



La plateforme doit enregistrer l'activité de connexion des utilisateurs.



Le profil peut afficher une information telle que :



- En ligne ;

- Actif récemment ;

- Actif il y a quelques heures ;

- Actif hier ;

- Actif il y a plusieurs jours.



La logique exacte d'affichage doit protéger autant que possible la vie privée.



---



7. MESSAGERIE



La messagerie fonctionne uniquement entre deux utilisateurs ayant obtenu un Match.



Limite gratuite



Après un Match :



- chaque utilisateur dispose d'une possibilité de conversation gratuite ;

- maximum : 3 messages gratuits dans cette conversation.



Après le troisième message :



- le quatrième message est bloqué ;

- la conversation devient verrouillée ;

- l'utilisateur reçoit une proposition de déblocage.



Important :



Le système doit compter les messages côté serveur.



Le frontend ne doit jamais être la seule source de vérité.



---



8. DÉBLOCAGE INDIVIDUEL



Prix :



350 FCFA



Le déblocage concerne uniquement la conversation sélectionnée.



Exemple :



Utilisateur A possède les conversations :



- A ↔ B ;

- A ↔ C ;

- A ↔ D.



A paie 350 FCFA pour A ↔ B.



Résultat :



- A ↔ B = débloqué ;

- A ↔ C = toujours verrouillé ;

- A ↔ D = toujours verrouillé.



Le paiement ne donne aucun accès global.



Durée



Le déblocage est valable :



3 jours



Après trois jours :



- la conversation redevient verrouillée selon les règles normales ;

- un nouveau déblocage peut être proposé.



Effet du paiement



Lorsqu'un des deux participants paie :



la conversation est débloquée pour les deux participants.



Les deux utilisateurs peuvent donc poursuivre la conversation pendant la durée du déblocage.



---



9. ABONNEMENT PREMIUM



Prix :



2 500 FCFA / mois



Le Premium donne notamment accès à des conversations illimitées avec les utilisateurs qui possèdent eux-mêmes un abonnement Premium actif.



Premium ↔ Premium



Si :



Utilisateur A = Premium actif



et



Utilisateur B = Premium actif



alors :



conversation illimitée.



Aucune limite de trois messages.



Premium ↔ Gratuit



Si :



Utilisateur A = Premium



Utilisateur B = Gratuit



alors le Premium ne débloque PAS automatiquement la conversation.



Les règles normales s'appliquent :



- maximum trois messages gratuits ;

- puis déblocage individuel à 350 FCFA.



Cette règle est fondamentale et doit être appliquée côté serveur.



---



10. PROTECTION DES NUMÉROS DE TÉLÉPHONE



La plateforme doit empêcher les utilisateurs d'échanger leurs numéros de téléphone dans la messagerie.



La détection doit être effectuée côté serveur avant l'enregistrement et la livraison du message.



Le système doit détecter différentes formes :



- 0612345678 ;

- 06 12 34 56 78 ;

- 06-12-34-56-78 ;

- 06.12.34.56.78 ;

- +33 6 12 34 56 78 ;

- +33612345678 ;

- formats internationaux ;

- numéros avec parenthèses ;

- variantes avec séparateurs.



Le système doit également prévoir des mécanismes contre certaines formes simples d'obfuscation.



Règle absolue



Si un message contient un numéro détecté :



1. le message est bloqué ;

2. il n'est pas livré au destinataire ;

3. il ne doit pas être enregistré comme message délivré ;

4. le destinataire ne reçoit aucune partie du message ;

5. l'expéditeur reçoit une notification indiquant que son message a été bloqué.



La validation doit être effectuée côté serveur.



Le frontend peut effectuer une première vérification pour améliorer l'expérience utilisateur, mais le serveur reste l'autorité finale.



---



11. BLOCAGE ET SIGNALEMENT



Chaque utilisateur doit pouvoir :



- bloquer un autre utilisateur ;

- signaler un profil ;

- signaler un message ;

- signaler un comportement inapproprié.



Lorsqu'un utilisateur bloque un autre utilisateur :



- ils ne doivent plus pouvoir interagir normalement ;

- les profils peuvent être masqués ;

- les conversations doivent être traitées selon les règles de sécurité définies.



Les signalements doivent être accessibles à l'administration.



---



12. ADMINISTRATION



Un espace administrateur doit être prévu.



L'administrateur doit pouvoir :



- consulter les utilisateurs ;

- rechercher un utilisateur ;

- consulter les profils ;

- suspendre un compte ;

- désactiver un compte ;

- gérer les signalements ;

- consulter les paiements ;

- consulter les abonnements ;

- consulter les déblocages ;

- consulter certaines statistiques ;

- effectuer des actions de modération ;

- consulter les événements de sécurité nécessaires.



Le rôle ADMIN doit être séparé du rôle USER.



---



13. MODÈLE DE DONNÉES



L'architecture doit prévoir au minimum les principales entités suivantes :



users



Informations fondamentales du compte.



profiles



Informations générales du profil.



christian_profiles



Informations relatives au profil chrétien.



preferences



Préférences de recherche et de compatibilité.



photos



Photos associées au profil.



likes



Likes envoyés entre utilisateurs.



matches



Matches créés par des Likes réciproques.



conversations



Conversations associées aux Matches.



messages



Messages envoyés.



conversation_unlocks



Déblocages individuels.



subscriptions



Abonnements Premium.



payments



Transactions financières.



reports



Signalements.



blocks



Blocages.



moderation_actions



Actions effectuées par l'administration.



user_activity



Activité et dernière connexion.



L'architecture doit être conçue pour pouvoir accueillir de nouvelles tables ultérieurement.



---



14. SÉCURITÉ



Les règles commerciales et les permissions doivent être appliquées côté serveur.



Le système ne doit jamais faire confiance uniquement au frontend pour :



- vérifier le statut Premium ;

- compter les messages ;

- autoriser une conversation ;

- valider un paiement ;

- vérifier la durée d'un déblocage ;

- créer un Match ;

- accéder à une conversation ;

- contourner une restriction.



Les règles d'accès aux données doivent être strictes.



Les informations sensibles doivent être protégées.



---



15. PAIEMENTS



Le système doit être conçu pour intégrer un prestataire de paiement adapté au marché ciblé.



Deux produits doivent être gérés :



Déblocage



350 FCFA



Durée : 3 jours.



Premium



2 500 FCFA



Durée : 1 mois.



Chaque paiement doit être associé à :



- utilisateur ;

- produit ;

- montant ;

- devise ;

- statut ;

- identifiant de transaction ;

- date ;

- éventuellement date d'expiration ;

- données nécessaires au rapprochement.



Les paiements doivent être confirmés côté serveur par le système du prestataire.



---



16. NOTIFICATIONS



Le MVP doit prévoir les notifications essentielles :



- nouveau Match ;

- nouveau message ;

- message bloqué ;

- conversation verrouillée ;

- conversation débloquée ;

- paiement confirmé ;

- Premium activé ;

- Premium bientôt expiré ;

- signalement ou action de modération si nécessaire.



L'architecture doit permettre d'ajouter ultérieurement :



- email ;

- notifications push ;

- SMS ;

- autres canaux.



---



17. INTERFACE



La plateforme doit avoir une identité visuelle :



- chrétienne sans être visuellement vieillotte ;

- élégante ;

- premium ;

- moderne ;

- chaleureuse ;

- rassurante ;

- masculine et féminine ;

- orientée relation sérieuse.



L'interface doit être :



- responsive ;

- mobile-first ;

- adaptée aux smartphones ;

- adaptée aux tablettes ;

- adaptée aux ordinateurs.



La navigation doit rester simple.



---



18. PAGES PRINCIPALES



Le MVP doit prévoir notamment :



- Landing page ;

- inscription ;

- connexion ;

- récupération du mot de passe ;

- onboarding ;

- création du profil ;

- modification du profil ;

- préférences ;

- recherche ;

- découverte/swipe ;

- profil détaillé ;

- Likes/Matchs ;

- conversations ;

- conversation individuelle ;

- paiement du déblocage ;

- Premium ;

- paramètres ;

- sécurité/confidentialité ;

- blocage/signalement ;

- administration.



---



19. MVP



Le MVP doit impérativement contenir :



- authentification ;

- inscription détaillée ;

- profil détaillé ;

- profil chrétien ;

- préférences ;

- photos ;

- recherche ;

- découverte ;

- swipe ;

- Like ;

- Match ;

- dernière connexion ;

- messagerie ;

- limite de 3 messages ;

- déblocage à 350 FCFA ;

- durée de 3 jours ;

- Premium à 2 500 FCFA/mois ;

- règle Premium ↔ Premium ;

- règle Premium ↔ Gratuit ;

- détection des numéros ;

- blocage ;

- signalement ;

- paiements ;

- notifications essentielles ;

- administration minimale ;

- sécurité serveur.



---



20. FONCTIONNALITÉS À REPORTER APRÈS LE MVP



Ne pas construire immédiatement :



- appels vidéo ;

- appels audio ;

- événements physiques ;

- groupes ;

- communautés ;

- coaching ;

- IA avancée de compatibilité ;

- Super Like ;

- cadeaux virtuels ;

- réseau social interne ;

- application mobile native ;

- vérification d'identité avancée ;

- algorithme complexe de recommandation ;

- fonctionnalités sociales avancées.



Ces fonctionnalités pourront être ajoutées après validation du MVP.



---



21. PRINCIPLE D'ARCHITECTURE



L'application doit être construite comme un véritable SaaS.



Les fonctionnalités doivent être séparées logiquement :



- authentification ;

- profils ;

- découverte ;

- matchmaking ;

- messagerie ;

- monétisation ;

- modération ;

- administration.



Chaque module doit pouvoir évoluer sans casser les autres.



La priorité absolue est :



fonctionnement fiable + sécurité + règles métier côté serveur + expérience utilisateur simple + architecture évolutive.



PLAN D'IMPLÉMENTATION COMPLET



SaaS de rencontres chrétiennes



---



1. STRATÉGIE GÉNÉRALE



Le développement doit être réalisé progressivement.



Il ne faut pas demander à l'outil de vibe coding de construire immédiatement toutes les fonctionnalités en une seule opération.



La méthode recommandée est :



«Architecture → Base de données → Authentification → Profil → Découverte → Like → Match → Messagerie → Monétisation → Sécurité → Administration → Tests.»



Chaque étape doit être testée avant de passer à la suivante.



---



2. PHASE 0 — PRÉPARATION



Avant de coder :



Définir



- nom du produit ;

- identité visuelle ;

- logo ;

- couleurs ;

- typographie ;

- ton de communication ;

- marché initial ;

- pays pris en charge ;

- devise principale ;

- règles de confidentialité ;

- règles de modération.



Résultat attendu



Un document de référence permettant à l'IA de ne pas improviser l'identité du produit.



---



3. PHASE 1 — ARCHITECTURE TECHNIQUE



Mettre en place :



- frontend ;

- backend ;

- base de données ;

- authentification ;

- stockage des photos ;

- système de sessions ;

- API ;

- gestion des erreurs ;

- environnement de développement ;

- environnement de production.



Le principe fondamental est :



«Le frontend affiche et demande. Le backend décide et protège.»



---



4. PHASE 2 — MODÈLE DE DONNÉES



Créer les principales tables/collections :



users



profiles



christian_profiles



preferences



photos



likes



matches



conversations



messages



conversation_unlocks



subscriptions



payments



reports



blocks



moderation_actions



user_activity



---



5. PHASE 3 — AUTHENTIFICATION



Construire :



- inscription ;

- connexion ;

- déconnexion ;

- récupération du mot de passe ;

- vérification email si retenue ;

- vérification téléphone si retenue ;

- gestion de session ;

- protection des routes privées.



Tester :



- création d'un utilisateur ;

- connexion ;

- déconnexion ;

- session expirée ;

- compte inexistant ;

- mauvais mot de passe.



---



6. PHASE 4 — ONBOARDING



Construire l'inscription détaillée.



L'expérience doit être divisée en plusieurs étapes plutôt que présenter un formulaire énorme.



Exemple :



Écran 1



Bienvenue.



Écran 2



Informations personnelles.



Écran 3



Situation personnelle.



Écran 4



Foi chrétienne.



Écran 5



Vision du couple.



Écran 6



Projet familial.



Écran 7



Personnalité.



Écran 8



Centres d'intérêt.



Écran 9



Personne recherchée.



Écran 10



Photos.



Écran 11



Présentation.



Écran 12



Validation.



---



7. PHASE 5 — PROFIL



Construire :



- affichage du profil ;

- modification ;

- ajout/suppression de photos ;

- présentation ;

- informations chrétiennes ;

- valeurs ;

- projet ;

- préférences.



Créer également une vue :



«« Comment les autres voient mon profil ».»



---



8. PHASE 6 — DÉCOUVERTE



Créer l'écran :



DÉCOUVRIR



Afficher un profil à la fois.



Actions :



- Passer ;

- Like.



Prévoir une architecture pouvant accueillir plus tard :



- Super Like ;

- Coup de cœur ;

- retour arrière.



---



9. PHASE 7 — ALGORITHME DE RECOMMANDATION INITIAL



Ne pas commencer par une IA extrêmement complexe.



Le premier moteur peut utiliser :



- préférence de sexe ;

- tranche d'âge ;

- distance ;

- localisation ;

- critères religieux ;

- projet relationnel ;

- projet familial ;

- centres d'intérêt.



L'objectif initial est de produire des recommandations cohérentes.



Une version ultérieure pourra intégrer un système de scoring plus sophistiqué.



---



10. PHASE 8 — SYSTÈME DE RECHERCHE



Créer :



Recherche



Filtres de base.



Puis :



Recherche avancée



Filtres détaillés.



Les résultats doivent :



- respecter les préférences ;

- exclure les utilisateurs bloqués ;

- exclure les profils supprimés ;

- exclure les profils suspendus ;

- éviter de proposer constamment les mêmes personnes.



---



11. PHASE 9 — LIKE



Lorsqu'un utilisateur clique sur Like :



Le backend doit :



1. vérifier que l'utilisateur est authentifié ;

2. vérifier que la cible existe ;

3. vérifier que la cible n'est pas bloquée ;

4. enregistrer le Like ;

5. vérifier si un Like inverse existe.



Si aucun Like inverse :



«Like enregistré.»



Si le Like inverse existe :



«Match créé.»



---



12. PHASE 10 — MATCH



Lorsqu'un Match est créé :



Créer :



- Match ;

- conversation associée ;

- notification ;

- compteur de messages à zéro.



Le système doit empêcher les doublons.



---



13. PHASE 11 — MESSAGERIE GRATUITE



Mettre en place le compteur.



Exemple :



A → B : message 1



B → A : message 2



A → B : message 3



Le système considère qu'un maximum de trois messages gratuits ont été utilisés dans cette conversation.



IMPORTANT :



Le compteur doit être géré côté serveur.



Il ne doit jamais dépendre d'une simple variable JavaScript dans le navigateur.



---



14. PHASE 12 — MOTEUR DE DROITS DE MESSAGERIE



Créer une fonction centrale conceptuelle :



«canSendMessage(userA, userB, conversation)»



Cette fonction vérifie :



1. Match valide ;

2. blocage ;

3. statut Premium des deux utilisateurs ;

4. déblocage individuel actif ;

5. nombre de messages gratuits ;

6. expiration.



Elle doit retourner par exemple :



ALLOW



ou



DENY_FREE_LIMIT



ou



DENY_NO_MATCH



ou



DENY_BLOCKED



ou



DENY_UNLOCK_EXPIRED



Cette logique doit être centralisée afin d'éviter des règles différentes selon les écrans.



---



15. PHASE 13 — DÉBLOCAGE À 350 FCFA



Construire le produit :



«Débloquer cette conversation — 350 FCFA.»



Le paiement doit être associé à :



- user_id du payeur ;

- conversation_id ;

- match_id ;

- montant ;

- devise ;

- transaction_id ;

- statut ;

- date de paiement ;

- date de début ;

- date d'expiration.



Après confirmation du paiement :



«unlock_status = active»



et :



«expires_at = date de confirmation + 3 jours»



Le système doit ensuite permettre aux deux participants d'envoyer des messages.



---



16. PHASE 14 — ABONNEMENT MENSUEL À 2 500 FCFA



Construire :



«Premium mensuel — 2 500 FCFA / mois.»



Enregistrer :



- utilisateur ;

- statut ;

- date de début ;

- date d'expiration ;

- transaction ;

- fournisseur de paiement ;

- identifiant de transaction.



---



17. PHASE 15 — RÈGLE PREMIUM



Avant chaque message :



Le backend vérifie :



Utilisateur A Premium ?



Oui/non.



Utilisateur B Premium ?



Oui/non.



Si :



A = Premium



ET



B = Premium



→ conversation illimitée.



Sinon :



→ appliquer les règles normales.



Donc :



Premium + Premium



= illimité.



Premium + Gratuit



= pas automatiquement illimité.



Gratuit + Gratuit



= 3 messages gratuits puis déblocage individuel.



---



18. PHASE 16 — EXPIRATION AUTOMATIQUE



Le serveur doit gérer l'expiration des déblocages.



Un déblocage actif devient automatiquement expiré lorsque :



current_time >= expires_at



Il ne faut pas compter uniquement sur un cron pour empêcher l'accès.



La vérification de la date doit également être effectuée lors de chaque tentative d'envoi.



---



19. PHASE 17 — PROTECTION DES NUMÉROS DE TÉLÉPHONE



Créer un pipeline de traitement du message.



Lorsqu'un utilisateur écrit :



«« Mon numéro est... »»



Le message arrive au serveur.



Le serveur :



Étape 1



Normalise le texte.



Étape 2



Détecte les formats potentiels de téléphone.



Étape 3



Évalue le niveau de confiance de la détection.



Étape 4



Si un numéro est détecté :



«message rejeté.»



Étape 5



Ne jamais créer de message visible par le destinataire.



Étape 6



Retourner uniquement une erreur contrôlée à l'expéditeur.



---



20. IMPORTANT — ORDRE TECHNIQUE DE LA MODÉRATION



La séquence doit être :



Utilisateur écrit

      ↓

Frontend

      ↓

Serveur

      ↓

Authentification

      ↓

Vérification du droit de messagerie

      ↓

Analyse de sécurité

      ↓

Détection téléphone

      ↓

Détection spam éventuelle

      ↓

Enregistrement du message

      ↓

Livraison au destinataire



Le message ne doit jamais être livré avant l'analyse.



---



21. PHASE 18 — BLOCAGE ET SIGNALEMENT



Construire :



Bloquer



Lorsqu'un utilisateur bloque quelqu'un :



- il ne doit plus être recommandé ;

- il ne doit plus apparaître dans les recherches ;

- les interactions doivent être limitées ;

- la messagerie doit être bloquée selon les règles définies.



Signaler



Catégories possibles :



- faux profil ;

- harcèlement ;

- contenu inapproprié ;

- tentative d'arnaque ;

- comportement suspect ;

- autre.



---



22. PHASE 19 — ADMINISTRATION



Créer un dashboard séparé.



Sections :



Dashboard



Statistiques.



Utilisateurs



Gestion.



Profils



Modération.



Matchs



Monitoring éventuel.



Conversations



Accès limité et encadré pour la modération.



Signalements



Traitement.



Paiements



Transactions.



Premium



Abonnements.



Déblocages



Transactions de 350 FCFA.



---



23. PHASE 20 — NOTIFICATIONS



Prévoir :



Notification Match



«« Vous avez un nouveau Match ! »»



Notification message



«« Vous avez reçu un nouveau message. »»



Notification verrouillage



«« Votre conversation gratuite est terminée. »»



Notification expiration



«« Votre déblocage arrive bientôt à expiration. »»



Notification paiement



«« Votre conversation est maintenant débloquée. »»



---



24. PHASE 21 — DERNIÈRE CONNEXION



Enregistrer l'activité utilisateur.



Le système met à jour :



last_seen_at



lorsqu'un utilisateur utilise activement la plateforme.



Le frontend transforme ensuite cette donnée en texte lisible.



Exemple :



«En ligne maintenant»



ou :



«Actif aujourd'hui à 18:42»



ou :



«Actif hier.»



---



25. PHASE 22 — TESTS FONCTIONNELS CRITIQUES



Tester obligatoirement le scénario :



TEST A



Utilisateur A Like B.



Utilisateur B ne Like pas A.



→ Aucun Match.



TEST B



B Like A.



→ Match.



TEST C



Message 1.



→ autorisé.



TEST D



Message 2.



→ autorisé.



TEST E



Message 3.



→ autorisé.



TEST F



Message 4 sans paiement.



→ bloqué.



TEST G



A paie 350 FCFA.



→ conversation débloquée pour A et B.



TEST H



A et B communiquent.



→ messages autorisés pendant 3 jours.



TEST I



3 jours écoulés.



→ conversation verrouillée.



TEST J



A Premium + B Premium.



→ conversation illimitée.



TEST K



A Premium + B gratuit.



→ pas de conversation illimitée grâce au Premium.



TEST L



Message contenant un numéro.



→ message rejeté côté serveur.



TEST M



Le destinataire vérifie sa conversation.



→ aucun message contenant le numéro n'existe chez lui.



---



26. TESTS DE SÉCURITÉ



Tester également :



- tentative de modifier le prix côté navigateur ;

- tentative de modifier son statut Premium ;

- tentative de modifier la date d'expiration ;

- tentative d'envoyer un message directement via API ;

- tentative de contourner le compteur ;

- tentative d'utiliser un déblocage sur une autre conversation ;

- tentative d'accéder aux conversations d'un autre utilisateur ;

- tentative de contourner la détection des numéros ;

- tentative de créer plusieurs comptes abusifs.



---



27. TESTS DU SYSTÈME DE PAIEMENT



Ne jamais considérer :



«« L'utilisateur est revenu sur la page après paiement »»



comme preuve suffisante de paiement.



Le backend doit utiliser la confirmation fiable du prestataire de paiement retenu.



Il faut prévoir :



- paiement réussi ;

- paiement échoué ;

- paiement annulé ;

- paiement en attente ;

- transaction répétée ;

- notification serveur ;

- remboursement éventuel ;

- transaction déjà traitée.



---



28. PHASE 23 — RESPONSIVE DESIGN



Le produit doit être conçu en priorité pour mobile puisque le swipe et la messagerie seront fortement utilisés sur smartphone.



Mais l'interface doit également fonctionner sur :



- smartphone ;

- tablette ;

- ordinateur.



---



29. PHASE 24 — OPTIMISATION UX



L'expérience doit rester extrêmement simple malgré la richesse de l'inscription.



Le principe :



«Inscription approfondie ≠ interface compliquée.»



Le questionnaire doit être divisé en petites étapes.



La découverte doit rester rapide.



La recherche doit rester claire.



Le paiement doit être compréhensible.



Le verrouillage doit expliquer exactement pourquoi l'utilisateur ne peut plus envoyer de message.



---



30. PHASE 25 — ANALYTICS



Prévoir dès le MVP les événements principaux :



- inscription commencée ;

- inscription terminée ;

- profil complété ;

- Like envoyé ;

- Match obtenu ;

- premier message ;

- troisième message ;

- quatrième message bloqué ;

- déblocage acheté ;

- abonnement mensuel acheté ;

- conversation active ;

- blocage ;

- signalement.



Ces données permettront ensuite de comprendre où les utilisateurs abandonnent.



---



31. PHASE 26 — LANCEMENT BÊTA



Ne pas lancer immédiatement à grande échelle.



Commencer avec un groupe limité.



Objectifs :



- vérifier la stabilité ;

- observer les comportements ;

- vérifier la qualité des profils ;

- mesurer le nombre de Matchs ;

- mesurer les conversations ;

- mesurer les achats de 350 FCFA ;

- mesurer les abonnements à 2 500 FCFA ;

- identifier les abus.



---



32. PHASE 27 — AMÉLIORATION APRÈS MVP



Après les premiers utilisateurs, analyser :



Acquisition



Combien s'inscrivent ?



Activation



Combien terminent leur profil ?



Engagement



Combien swipent ?



Match



Combien obtiennent un Match ?



Conversation



Combien envoient les 3 messages ?



Monétisation



Combien paient 350 FCFA ?



Combien prennent 2 500 FCFA/mois ?



Rétention



Combien reviennent après 7 jours ?



Après 30 jours ?



---



33. ORDRE FINAL DE CONSTRUCTION



L'ordre recommandé pour le vibe coding est :



01 — Architecture

        ↓

02 — Base de données

        ↓

03 — Authentification

        ↓

04 — Onboarding détaillé

        ↓

05 — Profil

        ↓

06 — Préférences

        ↓

07 — Recherche

        ↓

08 — Découverte / Swipe

        ↓

09 — Like

        ↓

10 — Match

        ↓

11 — Messagerie

        ↓

12 — Limite des 3 messages

        ↓

13 — Paiement 350 FCFA

        ↓

14 — Déblocage 3 jours

        ↓

15 — Premium 2 500 FCFA

        ↓

16 — Règle Premium ↔ Premium

        ↓

17 — Détection des numéros

        ↓

18 — Blocage / Signalement

        ↓

19 — Notifications

        ↓

20 — Administration

        ↓

21 — Tests

        ↓

22 — Sécurité

        ↓

23 — Optimisation UX

        ↓

24 — Bêta

        ↓

25 — Lancement



---



34. RÈGLE D'OR POUR LE VIBE CODING



Le projet ne doit pas être construit avec un seul prompt du type :



«« Construis-moi Tinder chrétien avec toutes ces fonctionnalités. »»



Il faut donner à l'IA :



1. le cahier des charges ;

2. l'architecture ;

3. les règles métier ;

4. le plan d'implémentation ;

5. puis des tâches précises une par une.



Chaque tâche doit être testée avant de passer à la suivante.



---



35. RÉSULTAT ATTENDU DU MVP



À la fin du MVP, un utilisateur doit pouvoir :



Créer son compte



↓



Compléter son profil détaillé



↓



Renseigner son profil chrétien



↓



Définir ses préférences



↓



Rechercher des personnes



↓



Swiper



↓



Liker



↓



Matcher



↓



Échanger gratuitement 3 messages



↓



Atteindre la limite



↓



Débloquer une conversation pour 350 FCFA pendant 3 jours



OU



être Premium avec une autre personne Premium



↓



Discuter



↓



Être protégé contre le partage de numéros



↓



Bloquer/signaler si nécessaire.



---



36. CE QUI RESTE VOLONTAIREMENT HORS MVP



Les fonctionnalités suivantes peuvent être ajoutées plus tard :



- vidéo ;

- audio ;

- événements ;

- groupes ;

- IA avancée ;

- coaching ;

- compatibilité extrêmement sophistiquée ;

- vérification d'identité avancée ;

- Super Like ;

- cadeaux virtuels ;

- système social ;

- application mobile native ;

- fonctionnalités communautaires avancées.



L'objectif est de construire d'abord un produit simple, stable et réellement utilisable.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sacred-heart-link.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8b31580f-6195-493b-8e5a-df314f6eaafd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitLab and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
