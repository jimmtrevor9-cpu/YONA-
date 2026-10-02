import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: `Politique des cookies — ${APP_NAME}` },
      {
        name: "description",
        content: `Les cookies et le stockage utilisés par ${APP_NAME}.`,
      },
    ],
  }),
  component: CookiesPage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "1. De quoi parle-t-on",
    blocks: [
      "Un cookie est un petit fichier déposé par un site dans votre navigateur. Le « stockage local » joue le même rôle : il permet au site de se souvenir de certaines informations sur votre appareil.",
    ],
  },
  {
    title: "2. Ce que YONA utilise",
    blocks: [
      "Uniquement ce qui est nécessaire au fonctionnement du service :",
      {
        list: [
          "Votre session de connexion, pour que vous restiez connecté.",
          "Votre choix concernant le bandeau d'information sur les cookies.",
          "Le brouillon de votre inscription (réponses et photos), pour ne rien perdre si vous fermez la page.",
          "Le brouillon d'un message en cours d'écriture.",
          "Les fichiers de l'application installée sur votre écran d'accueil, pour qu'elle s'ouvre vite.",
        ],
      },
      "YONA n'utilise aucun cookie publicitaire et aucun outil de mesure d'audience.",
    ],
  },
  {
    title: "3. Services extérieurs",
    blocks: [
      "Certains services extérieurs peuvent déposer leurs propres cookies, selon leurs règles :",
      {
        list: [
          "Google, lorsque vous choisissez de vous connecter avec votre compte Google.",
          "Le prestataire de paiement, sur la page de paiement.",
          "Vimeo, si la vidéo de présentation est lue depuis Vimeo.",
          "Google Fonts, qui fournit les polices d'écriture du site (votre adresse IP lui est transmise pour afficher les polices).",
        ],
      },
    ],
  },
  {
    title: "4. Comment les gérer",
    blocks: [
      "Vous pouvez effacer les cookies et les données du site à tout moment dans les réglages de votre navigateur. Attention : vous serez alors déconnecté, et un brouillon d'inscription en cours sera perdu.",
      "Ces éléments étant indispensables au service, ils ne nécessitent pas votre accord préalable : le bandeau affiché à votre première visite sert à vous en informer.",
    ],
  },
];

function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Informations légales"
      title="Politique des cookies"
      intro={`${APP_NAME} utilise le strict minimum : seulement ce qui permet au site de fonctionner.`}
      sections={SECTIONS}
    />
  );
}
