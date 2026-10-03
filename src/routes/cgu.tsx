import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { APP_NAME } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: `Conditions d'utilisation — ${APP_NAME}` },
      { name: "description", content: `Les règles d'utilisation de ${APP_NAME}.` },
    ],
  }),
  component: TermsPage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "1. Qui peut s'inscrire",
    blocks: [
      `${APP_NAME} est un service de rencontre chrétienne réservé aux personnes majeures (18 ans et plus) qui cherchent une relation sincère et sérieuse.`,
      "En créant un compte, vous certifiez avoir 18 ans ou plus et fournir des informations vraies.",
    ],
  },
  {
    title: "2. Respect des autres membres",
    blocks: [
      "Sont interdits : les insultes, le harcèlement, les arnaques ou demandes d'argent, les contenus sexuels ou choquants, les faux profils et la publicité.",
      "Chaque membre peut bloquer ou signaler un autre membre. L'équipe peut suspendre ou supprimer un compte qui ne respecte pas ces règles.",
    ],
  },
  {
    title: "3. Photos et informations",
    blocks: [
      "Vos photos doivent vous représenter. Elles sont vérifiées par l'équipe avant d'être montrées aux autres membres.",
      "Votre position exacte n'est jamais montrée : seule une distance approximative sert à la recherche.",
    ],
  },
  {
    title: "4. Offres payantes",
    blocks: [
      "L'inscription est gratuite. Le Premium (mensuel ou annuel) et le déblocage d'une conversation sont des paiements uniques, sans renouvellement automatique.",
      "Les abonnés gratuits voient des annonces sponsorisées, toujours signalées par l'étiquette « Sponsorisé ». Les membres Premium n'en voient aucune.",
    ],
  },
  {
    title: "5. Vos données",
    blocks: [
      "Nous utilisons seulement les cookies nécessaires pour vous garder connecté : aucun cookie publicitaire ni de mesure d'audience, y compris pour les annonces sponsorisées.",
      "Vous pouvez masquer votre profil ou supprimer votre compte à tout moment depuis les paramètres.",
    ],
  },
  {
    title: "6. Objet du service",
    blocks: [
      `${APP_NAME} met en relation des célibataires chrétiens francophones qui souhaitent construire une relation durable, en vue du mariage. Le service est édité par ${LEGAL.brand}, dont le siège social est situé à ${LEGAL.headOffice} (voir les mentions légales).`,
      "En utilisant le site ou l'application, vous acceptez les présentes conditions. Si vous ne les acceptez pas, merci de ne pas utiliser le service.",
    ],
  },
  {
    title: "7. Votre compte",
    blocks: [
      "Vous pouvez créer votre compte avec une adresse e-mail et un mot de passe, ou avec votre compte Google. Un seul compte est autorisé par personne.",
      "Vous êtes responsable de la confidentialité de votre mot de passe et de tout ce qui est fait depuis votre compte. Prévenez-nous sans attendre si vous pensez que votre compte est utilisé par quelqu'un d'autre.",
    ],
  },
  {
    title: "8. Vérification du profil",
    blocks: [
      "Pour protéger la communauté contre les faux profils et les arnaques, chaque membre doit vérifier son identité avant de voir les profils et d'écrire aux autres membres. Au choix : un selfie pris en direct, une pièce (carte d'identité, passeport, carte d'étudiant ou carte scolaire), ou les deux.",
      "La vérification est automatique : votre visage est comparé à vos photos de profil et, si vous l'avez choisie, à votre pièce. Elle n'a lieu qu'avec votre accord explicite, donné avant la prise de vue. Les cas incertains sont relus par l'équipe.",
      "Les images de vérification sont privées : elles ne sont jamais publiées et sont supprimées dès la décision. Les détails sont dans la politique de confidentialité.",
      "La reconnaissance faciale n'est pas infaillible. En cas de refus que vous pensez injustifié, vous pouvez recommencer ou nous écrire pour demander un examen par une personne.",
    ],
  },
  {
    title: "9. Profils de démonstration",
    blocks: [
      `Pendant le lancement, ${APP_NAME} peut afficher des profils de démonstration destinés à animer la communauté et à montrer le fonctionnement du service. Ce ne sont pas des membres : ils sont toujours signalés par l'étiquette « Profil de démonstration ».`,
      "Ils ne vous écrivent jamais, ne peuvent pas recevoir de demande de contact ni de Message Flash, ne vous demandent jamais d'argent et ne donnent lieu à aucun paiement. Ils disparaissent au fur et à mesure que de vrais membres, dont l'identité est vérifiée, s'inscrivent.",
      "Tous les membres inscrits passent par une vérification d'identité.",
    ],
  },
  {
    title: "10. Messagerie et sécurité",
    blocks: [
      "Les messages sont modérés. Pour votre sécurité, l'envoi de numéros de téléphone est bloqué dans la messagerie.",
      {
        list: [
          "N'envoyez jamais d'argent à une personne rencontrée sur YONA, quelle que soit la raison invoquée.",
          "Pour une première rencontre, choisissez un lieu public et prévenez un proche.",
          "Signalez tout comportement suspect : l'équipe examine chaque signalement.",
        ],
      },
    ],
  },
  {
    title: "11. Suspension et suppression",
    blocks: [
      "En cas de manquement à ces conditions, l'équipe peut retirer un contenu, suspendre ou supprimer un compte, sans remboursement des sommes déjà payées lorsque le manquement est grave.",
      "Vous pouvez supprimer votre compte à tout moment depuis les paramètres. Vos données sont alors supprimées dans les conditions prévues par la politique de confidentialité.",
    ],
  },
  {
    title: "12. Responsabilité",
    blocks: [
      `${APP_NAME} met tout en œuvre pour offrir un service sûr et disponible, mais ne peut pas garantir une rencontre ni le comportement des membres. Chaque membre reste responsable de ses propos, de ses photos et de ses actes, en ligne comme lors d'une rencontre.`,
    ],
  },
  {
    title: "13. Modification des conditions",
    blocks: [
      "Ces conditions peuvent évoluer. En cas de changement important, vous en serez informé sur le site ou par e-mail. La version en vigueur est toujours celle publiée sur cette page.",
    ],
  },
  {
    title: "14. Droit applicable",
    blocks: [
      "Les présentes conditions sont soumises au droit gabonais. En cas de désaccord, nous chercherons d'abord une solution amiable ; à défaut, les tribunaux de Libreville seront compétents, sous réserve des règles plus protectrices du pays de résidence du consommateur.",
    ],
  },
];

function TermsPage() {
  return (
    <LegalPage
      eyebrow="Informations légales"
      title="Conditions générales d'utilisation"
      intro={`Les règles qui permettent à chacun de vivre sur ${APP_NAME} des rencontres sincères, sûres et respectueuses.`}
      sections={SECTIONS}
    />
  );
}
