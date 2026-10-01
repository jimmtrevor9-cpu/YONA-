# Nouvelle inscription fluide (captures d'écran) + Google — rapport de test

Date : 2026-10-01 · Script : `etapes-inscription-fluide.mjs` · Résultat : **82/82**

Testé dans Chromium (390 px et 320 px) contre un Supabase local, confirmation d'e-mail
activée (Mailpit).

| Partie | Ce qui est vérifié |
|---|---|
| A. Accueil `/register` | Bouton « Créer mon compte », « ou continuer avec » Google / E-mail, « Déjà membre ? », « Installer l'application », bulle « Rebecca (Gabon) vient de s'inscrire » (vrai membre, prénom seul), bandeau cookies retenu, pas de défilement horizontal |
| B. Parcours e-mail | 4 étapes avec barre de progression ; 3 photos (Galerie / Photo) ; prénom obligatoire ; moins de 18 ans refusé ; Homme / Femme ; Hommes / Femmes / Tous ; curseur double 18 – 60+ ; 4 passions max ; bio proposée ; Retour garde les réponses ; « Pourquoi tu es là ? » ; e-mail et mot de passe vérifiés ; conditions avec case « 18 ans ou plus » (Annuler = aucun compte) ; e-mail de confirmation ; profil créé tout seul avec toutes les réponses, 2 photos, préférences, « Reste au courant » ; brouillon effacé |
| B. Fenêtres d'accueil | Bienvenue ; fenêtre photo sautée (2 photos) ; « Découvre qui est tout près » ; « Complète ton profil en 20 secondes » (enfants, origine, église, culte) enregistré ; ne reviennent pas |
| C. Autre appareil | Lien de confirmation ouvert ailleurs : profil créé depuis le compte ; « Ajoute ta première photo » et envoi depuis la fenêtre |
| D. Google | Même parcours ; dernière étape sans e-mail, « M'inscrire avec Google » ; départ vers Google (`provider=google`, retour sur `/login`) ; compte Google → prénom tiré du nom ; au retour, profil créé depuis le brouillon avec la photo |
| E. Google direct | « Continuer avec Google » sur `/login` ; nouveau compte sans parcours → parcours sur `/onboarding` (prénom Google pré-rempli, bouton « Terminer ») |
| F. Foi | Profil → « Ma foi et mes attentes » ouvre le formulaire complet déjà rempli |
| G. Serveur | `recent_signups` : prénom, pays, date seulement ; profils non terminés exclus ; date d'acceptation des conditions impossible à effacer ; limites région / origine |
| H. Divers | Page `/cgu`, application installable (manifeste + icônes), 320 px |

Limite locale : le conteneur de test ne peut pas joindre Google (réseau fermé). Le départ
vers Google est vérifié (adresse exacte), et le retour est simulé avec un compte de type
Google. Le vrai bouton marchera dès que Google sera activé dans Supabase (guide, étape 5 bis).

Anciens tests adaptés au nouveau parcours (rien supprimé) : 0.5, 1.2, 1.8, 1.9, 1.11, 1.12
(outil commun `docs/verification/outils/inscription.mjs`).
