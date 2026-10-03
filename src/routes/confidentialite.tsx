import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { APP_NAME } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/confidentialite")({
  head: () => ({
    meta: [
      { title: `Politique de confidentialité — ${APP_NAME}` },
      {
        name: "description",
        content: `Comment ${APP_NAME} collecte, utilise et protège vos données personnelles.`,
      },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "1. Qui est responsable de vos données",
    blocks: [
      `${LEGAL.brand}, dont le siège social est situé à ${LEGAL.headOffice}, est responsable des données traitées sur le site et l'application ${APP_NAME}. Pour toute question : ${LEGAL.email} ou ${LEGAL.phoneDisplay}.`,
    ],
  },
  {
    title: "2. Les données que nous collectons",
    blocks: [
      {
        list: [
          "Compte : adresse e-mail, mot de passe (enregistré sous forme chiffrée) ou, si vous utilisez Google, votre nom et votre adresse e-mail Google.",
          "Profil : prénom, date de naissance, sexe, pays, région, ville, biographie, centres d'intérêt, photos et préférences de recherche.",
          "Foi et attentes : dénomination, pratique religieuse, valeurs et projet de vie, si vous choisissez de les renseigner.",
          "Position : la position de votre appareil, uniquement si vous l'autorisez, ou à défaut la ville que vous indiquez, pour calculer une distance approximative. Votre position exacte n'est jamais montrée aux autres membres.",
          "Pays et ville estimés d'après votre adresse IP, fuseau horaire et langue de votre navigateur : ils servent à repérer les incohérences (par exemple un VPN) pour lutter contre les faux profils. Ils ne sont pas montrés aux autres membres.",
          "Activité : likes, matchs, favoris, visites, demandes de contact, messages, signalements et blocages.",
          "Vérification d'identité : selfie pris en direct (de face, puis tête tournée) et, si vous la choisissez, photo de votre pièce (carte d'identité, passeport, carte d'étudiant ou carte scolaire). Le visage sert à calculer une ressemblance : c'est une donnée biométrique, traitée seulement avec votre accord (voir la partie « Vérification d'identité »).",
          "Paiements : type d'offre, montant et date. Les données de carte bancaire sont traitées par le prestataire de paiement, jamais par YONA.",
          "Données techniques : dates de connexion et de dernière activité, adresse IP, type d'appareil et de navigateur, journal des actions sur le site (likes, matchs, envois de messages sans leur contenu, paiements, signalements).",
          "Annonces sponsorisées : quelles annonces vous ont été montrées et lesquelles vous avez ouvertes (abonnés gratuits uniquement).",
        ],
      },
      "Vos convictions religieuses sont des données sensibles : vous les donnez librement, et vous pouvez les modifier ou les retirer à tout moment depuis votre profil.",
    ],
  },
  {
    title: "3. Pourquoi nous les utilisons",
    blocks: [
      {
        list: [
          "Créer et gérer votre compte, et vous proposer des profils compatibles.",
          "Permettre les échanges entre membres (likes, matchs, messagerie).",
          "Protéger la communauté : vérification d'identité, modération, lutte contre les faux profils et les arnaques.",
          "Afficher des annonces sponsorisées aux abonnés gratuits, choisies seulement selon le pays, le sexe et l'âge.",
          "Traiter les paiements et répondre à vos demandes d'aide.",
          "Vous envoyer des nouvelles de YONA, seulement si vous l'avez accepté.",
        ],
      },
      "Nous ne vendons jamais vos données. Les annonces sponsorisées ne sont montrées qu'aux abonnés gratuits (jamais aux membres Premium) ; aucune donnée personnelle n'est transmise aux annonceurs, qui reçoivent seulement des chiffres globaux.",
    ],
  },
  {
    title: "4. Sur quelle base",
    blocks: [
      "Nous traitons vos données pour exécuter le service que vous avez demandé (votre inscription), avec votre consentement (informations sur votre foi, position de l'appareil, e-mails d'actualité), avec votre consentement explicite pour les données biométriques de la vérification d'identité, pour notre intérêt légitime à garantir la sécurité des membres (adresse IP, journal d'activité, détection des incohérences de localisation), et pour respecter nos obligations légales (par exemple comptables).",
    ],
  },
  {
    title: "5. Vérification d'identité et données biométriques",
    blocks: [
      "Pour voir les profils et écrire aux membres, chaque membre doit vérifier son identité. Avant toute prise de vue, nous vous demandons de cocher une case de consentement : sans votre accord, aucune image n'est prise.",
      {
        list: [
          "Ce qui est fait : un selfie pris en direct avec la caméra (pas depuis la galerie), une seconde image avec la tête tournée pour vérifier qu'il s'agit d'une vraie personne, puis la comparaison de votre visage avec vos photos de profil et, si vous l'avez choisie, avec la photo de votre pièce.",
          "But unique : confirmer que la personne derrière le profil est bien celle des photos. Ces données ne servent à rien d'autre, ne sont jamais publiées et jamais vendues.",
          "Durée : les images sont supprimées dès la décision. Seuls le résultat et les scores de ressemblance sont gardés.",
          "Décision : elle est automatique. Si le résultat est incertain, une personne de l'équipe examine le dossier. Vous pouvez toujours recommencer (dans la limite de quelques essais par jour) ou nous écrire pour demander un nouvel examen.",
          "Retrait : vous pouvez retirer votre accord à tout moment en supprimant votre compte ; vos vérifications et leurs fichiers sont alors effacés.",
        ],
      },
      "La reconnaissance faciale n'est pas parfaite : elle peut, rarement, refuser une vraie personne ou se tromper. C'est pourquoi les cas incertains sont relus par l'équipe.",
    ],
  },
  {
    title: "6. Profils de démonstration",
    blocks: [
      `Pendant son lancement, ${APP_NAME} peut afficher des profils de démonstration destinés à animer la communauté. Ce ne sont pas des membres : ils portent toujours l'étiquette « Profil de démonstration », ne répondent jamais, ne vous écrivent jamais et ne peuvent pas recevoir de message. Aucune de vos données ne leur est montrée.`,
    ],
  },
  {
    title: "7. Qui peut voir vos données",
    blocks: [
      {
        list: [
          "Les autres membres voient seulement votre profil public : prénom, âge, ville, biographie, centres d'intérêt et photos validées. Jamais votre e-mail, votre téléphone ni votre position exacte.",
          "Les images de vérification ne sont jamais publiées. Elles sont analysées automatiquement ; seule l'équipe chargée de la vérification peut les voir, et seulement quand le résultat automatique est incertain.",
          "L'équipe YONA y accède uniquement pour la modération, la vérification et le support.",
        ],
      },
      "Nous faisons appel à des prestataires techniques, qui traitent les données uniquement pour notre compte : Vercel (hébergement du site), Supabase (base de données et stockage des fichiers), Amazon Web Services (comparaison des visages, seulement si ce service est activé ; sinon l'analyse est faite sur nos propres serveurs), Google (connexion avec Google, si vous la choisissez), notre prestataire de paiement, et Anthropic (assistant Roi Salomon : seules les questions que vous lui posez lui sont transmises pour produire la réponse).",
    ],
  },
  {
    title: "8. Transferts hors du Gabon",
    blocks: [
      "Certains prestataires sont situés hors du Gabon, notamment aux États-Unis. Nous choisissons des prestataires reconnus, qui appliquent des mesures de sécurité adaptées, et nous limitons les données transmises au strict nécessaire.",
    ],
  },
  {
    title: "9. Combien de temps nous les gardons",
    blocks: [
      {
        list: [
          "Tant que votre compte existe. Si vous supprimez votre compte, votre profil, vos photos, vos messages vocaux, vos vérifications d'identité (et leurs fichiers), votre position et vos données de compte sont supprimés. Dans le journal et les statistiques d'annonces, les lignes restantes ne sont plus reliées à vous.",
          "Les images de vérification (selfies, pièce) : supprimées automatiquement dès la décision. Si le résultat est incertain, elles sont gardées seulement jusqu'à l'examen par l'équipe ; un essai abandonné est effacé après 30 minutes. Seul le résultat (vérifié ou non, date, scores de ressemblance) est gardé, tant que votre compte existe.",
          "Adresse IP et appareil dans le journal : 12 mois, puis ils sont effacés. L'historique de localisation et le journal des erreurs : 12 mois, puis ils sont supprimés.",
          "Les informations de paiement : le temps imposé par les obligations comptables.",
        ],
      },
    ],
  },
  {
    title: "10. Sécurité",
    blocks: [
      "Les échanges avec le site sont chiffrés (HTTPS). L'accès aux données est contrôlé directement dans la base : chaque membre ne peut lire que ce qui lui est autorisé. Les images de vérification sont rangées dans un espace de stockage privé, accessible seulement par nos serveurs.",
    ],
  },
  {
    title: "11. Vos droits",
    blocks: [
      "Vous pouvez à tout moment accéder à vos données, les corriger, les supprimer, vous opposer à leur utilisation, retirer votre consentement et demander à les recevoir. La plupart de ces actions se font directement depuis votre profil et vos paramètres ; sinon, écrivez-nous.",
      "Vous pouvez aussi adresser une réclamation à l'autorité de protection des données de votre pays : au Gabon, la Commission nationale pour la protection des données à caractère personnel (CNPDCP) ; en France, la CNIL ; en Belgique, l'Autorité de protection des données ; au Québec, la Commission d'accès à l'information.",
    ],
  },
  {
    title: "12. Mineurs",
    blocks: [
      `${APP_NAME} est strictement réservé aux personnes de 18 ans et plus. Tout compte d'une personne mineure est supprimé dès qu'il est repéré.`,
    ],
  },
  {
    title: "13. Modifications",
    blocks: [
      "Cette politique peut évoluer. La version en vigueur est toujours celle publiée sur cette page ; en cas de changement important, vous en serez informé.",
    ],
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Informations légales"
      title="Politique de confidentialité"
      intro="Votre confiance compte plus que tout. Voici, simplement, ce que nous faisons de vos données et comment nous les protégeons."
      sections={SECTIONS}
    />
  );
}
