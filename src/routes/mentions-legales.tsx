import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: `Mentions légales — ${APP_NAME}` },
      { name: "description", content: `Les informations légales concernant ${APP_NAME}.` },
    ],
  }),
  component: LegalNoticePage,
});

// Les champs entre crochets sont à compléter par l'éditeur du site avant la mise en ligne publique.
const SECTIONS: LegalSection[] = [
  {
    title: "1. Éditeur du site",
    text: [
      `Le site ${APP_NAME} est édité par : [nom de la personne ou de la société], [forme juridique et numéro d'immatriculation le cas échéant], [adresse postale].`,
      "Directeur de la publication : [nom du responsable].",
      "Contact : depuis la page Aide une fois connecté, ou à l'adresse [adresse e-mail de contact].",
    ],
  },
  {
    title: "2. Hébergement",
    text: [
      "Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).",
      "Les données des membres sont stockées par Supabase Inc. (supabase.com).",
    ],
  },
  {
    title: "3. Propriété intellectuelle",
    text: [
      `Le nom ${APP_NAME}, le logo, les textes, les images et la structure du site sont protégés. Toute reproduction sans autorisation est interdite.`,
      "Les photos et textes publiés par les membres restent leur propriété ; ils nous autorisent seulement à les afficher sur le service.",
    ],
  },
  {
    title: "4. Données personnelles",
    text: [
      "Le traitement de vos données est décrit dans la Politique de confidentialité. L'usage des cookies est détaillé dans la Politique de cookies.",
    ],
  },
  {
    title: "5. Signaler un contenu",
    text: [
      "Tout contenu illicite ou contraire aux règles peut être signalé directement depuis le profil ou la conversation concernée, grâce au bouton de signalement.",
    ],
  },
];

function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro={`Informations sur l'éditeur et l'hébergeur du site ${APP_NAME}.`}
      sections={SECTIONS}
    />
  );
}
