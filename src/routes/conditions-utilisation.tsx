import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/conditions-utilisation")({
  head: () => ({
    meta: [
      { title: `Conditions d'utilisation — ${APP_NAME}` },
      { name: "description", content: `Les règles d'utilisation de ${APP_NAME}.` },
    ],
  }),
  component: TermsOfUsePage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "1. Objet du service",
    text: [
      `${APP_NAME} est une plateforme de rencontre chrétienne qui met en relation des personnes célibataires cherchant une relation sincère et sérieuse, en vue d'une vie de couple.`,
    ],
  },
  {
    title: "2. Conditions d'inscription",
    text: [
      "L'inscription est réservée aux personnes majeures, âgées de 18 ans minimum, et non engagées dans une relation de couple.",
      "Vous vous engagez à fournir des informations exactes et à jour, et à ne créer qu'un seul compte. Vous êtes responsable de la confidentialité de votre mot de passe.",
    ],
  },
  {
    title: "3. Règles de bonne conduite",
    text: [
      "Sont interdits : les insultes, le harcèlement, les propos haineux ou discriminatoires, les arnaques et demandes d'argent, les contenus sexuels ou choquants, les faux profils, l'usurpation d'identité et la publicité.",
      "Vos photos doivent vous représenter personnellement et respecter la décence.",
    ],
  },
  {
    title: "4. Modération",
    text: [
      "Les photos sont vérifiées par l'équipe avant d'être montrées aux autres membres. Chaque membre peut bloquer ou signaler un autre membre à tout moment.",
      "En cas de manquement à ces règles, l'équipe peut retirer un contenu, suspendre ou supprimer un compte, sans préavis si la gravité des faits le justifie.",
    ],
  },
  {
    title: "5. Offres payantes",
    text: [
      "L'inscription est gratuite. Le Premium (mensuel ou annuel) et le déblocage d'une conversation sont des paiements uniques, sans renouvellement automatique. Le prix est toujours affiché avant le paiement.",
      "Les paiements sont traités de façon sécurisée par notre prestataire de paiement.",
    ],
  },
  {
    title: "6. Suppression du compte",
    text: [
      "Vous pouvez masquer votre profil ou supprimer définitivement votre compte à tout moment depuis les paramètres. La suppression efface votre profil, vos photos et vos messages.",
    ],
  },
  {
    title: "7. Responsabilité",
    text: [
      `${APP_NAME} met tout en œuvre pour offrir un espace sûr, mais ne peut garantir le comportement de chaque membre. Restez prudent : ne communiquez jamais d'argent ni d'informations bancaires, et privilégiez un lieu public pour une première rencontre.`,
    ],
  },
  {
    title: "8. Modification des conditions",
    text: [
      "Ces conditions peuvent évoluer. En cas de changement important, les membres en sont informés. La poursuite de l'utilisation du service vaut acceptation des nouvelles conditions.",
    ],
  },
];

function TermsOfUsePage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      intro={`En utilisant ${APP_NAME}, vous acceptez les règles suivantes. Elles protègent chaque membre et l'esprit de la communauté.`}
      sections={SECTIONS}
    />
  );
}
