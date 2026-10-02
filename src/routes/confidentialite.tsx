import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME } from "@/lib/config";

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
    title: "1. Les données que nous collectons",
    text: [
      "Données de compte : adresse e-mail, mot de passe (enregistré sous forme chiffrée), prénom, date de naissance et genre.",
      "Données de profil : photos, description, confession et pratique de foi, centres d'intérêt, ville et préférences de recherche. Ces informations sont visibles par les autres membres.",
      "Données d'utilisation : messages échangés, demandes de contact, favoris, blocages et signalements.",
      "Position : si vous l'autorisez, votre localisation sert uniquement à calculer une distance approximative. Votre position exacte n'est jamais montrée aux autres membres.",
    ],
  },
  {
    title: "2. Pourquoi nous les utilisons",
    text: [
      "Créer et gérer votre compte, vous proposer des profils compatibles et permettre les échanges entre membres.",
      "Assurer la sécurité de la communauté : vérification des photos, modération des contenus, traitement des signalements et lutte contre les faux profils et les arnaques.",
      "Gérer les offres payantes (Premium, déblocage de conversation) et répondre à vos demandes d'aide.",
    ],
  },
  {
    title: "3. Base légale",
    text: [
      "Vos données sont traitées pour exécuter le contrat qui nous lie (les conditions d'utilisation), pour respecter nos obligations légales et, pour la localisation, avec votre consentement, que vous pouvez retirer à tout moment.",
      "Certaines informations que vous choisissez de partager (comme votre foi) sont des données sensibles : vous les renseignez librement et elles ne servent qu'à vous proposer des rencontres.",
    ],
  },
  {
    title: "4. Qui peut voir vos données",
    text: [
      "Les autres membres voient uniquement votre profil public. Vos messages ne sont visibles que par vous et la personne avec qui vous échangez, sauf en cas de signalement examiné par l'équipe de modération.",
      "Nous faisons appel à des prestataires techniques pour héberger le site et la base de données, et pour traiter les paiements (Stripe). Vos données de carte bancaire ne sont jamais stockées par nos soins.",
      "Nous ne vendons jamais vos données et ne les utilisons pas pour de la publicité.",
    ],
  },
  {
    title: "5. Durée de conservation",
    text: [
      "Vos données sont conservées tant que votre compte est actif. Lorsque vous supprimez votre compte, votre profil, vos photos et vos messages sont effacés, sauf les informations que la loi nous oblige à garder pendant une durée limitée (par exemple les preuves de paiement).",
    ],
  },
  {
    title: "6. Vos droits",
    text: [
      "Vous pouvez à tout moment consulter, corriger ou compléter vos informations depuis votre profil, masquer votre profil ou supprimer définitivement votre compte depuis les paramètres.",
      "Vous disposez aussi d'un droit d'accès, d'opposition, de limitation et de portabilité de vos données. Pour l'exercer, écrivez-nous depuis la page Aide une fois connecté.",
      "Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer une réclamation auprès de l'autorité de protection des données de votre pays (en France, la CNIL).",
    ],
  },
  {
    title: "7. Âge minimum",
    text: [
      `${APP_NAME} est réservé aux personnes de 18 ans et plus. Nous ne collectons pas sciemment de données concernant des mineurs ; tout compte d'une personne mineure est supprimé.`,
    ],
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro={`La protection de votre vie privée est essentielle pour ${APP_NAME}. Cette page explique simplement quelles données nous utilisons, pourquoi, et comment vous gardez la main dessus.`}
      sections={SECTIONS}
    />
  );
}
