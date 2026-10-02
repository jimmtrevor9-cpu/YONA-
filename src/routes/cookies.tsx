import { createFileRoute } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: `Politique de cookies — ${APP_NAME}` },
      { name: "description", content: `Les cookies et le stockage utilisés par ${APP_NAME}.` },
    ],
  }),
  component: CookiesPage,
});

const SECTIONS: LegalSection[] = [
  {
    title: "1. Qu'est-ce qu'un cookie ?",
    text: [
      "Un cookie est un petit fichier enregistré par votre navigateur. Des technologies proches (comme le stockage local du navigateur) servent au même usage. Nous les appelons ici « cookies ».",
    ],
  },
  {
    title: "2. Les cookies que nous utilisons",
    text: [
      "Connexion : pour vous garder connecté de façon sécurisée entre deux visites.",
      "Préférences : pour retenir que vous avez fermé le bandeau d'information, et pour conserver votre inscription en cours si vous quittez la page avant la fin.",
      "Application installée : pour que le site s'ouvre plus vite et reste utilisable avec une connexion faible.",
      "Ces cookies sont strictement nécessaires au fonctionnement du service : ils ne demandent donc pas votre accord préalable.",
    ],
  },
  {
    title: "3. Ce que nous n'utilisons pas",
    text: [
      "Aucun cookie publicitaire, aucun cookie de mesure d'audience et aucun pistage par des réseaux sociaux.",
      "Lors d'un paiement, notre prestataire de paiement (Stripe) peut déposer ses propres cookies, nécessaires à la sécurité de la transaction.",
    ],
  },
  {
    title: "4. Gérer les cookies",
    text: [
      "Vous pouvez supprimer les cookies à tout moment depuis les réglages de votre navigateur. Attention : vous serez alors déconnecté et devrez vous reconnecter.",
    ],
  },
];

function CookiesPage() {
  return (
    <LegalPage
      title="Politique de cookies"
      intro={`${APP_NAME} utilise uniquement les cookies indispensables à son fonctionnement.`}
      sections={SECTIONS}
    />
  );
}
