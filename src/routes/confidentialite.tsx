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
          "Position : uniquement si vous l'autorisez, pour calculer une distance approximative. Votre position exacte n'est jamais montrée.",
          "Activité : likes, matchs, favoris, visites, demandes de contact, messages, signalements et blocages.",
          "Vérification du profil : selfie ou photo de votre pièce d'identité, si vous les envoyez.",
          "Paiements : type d'offre, montant et date. Les données de carte bancaire sont traitées par le prestataire de paiement, jamais par YONA.",
          "Données techniques : dates de connexion et de dernière activité.",
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
          "Protéger la communauté : vérification des profils, modération, lutte contre les arnaques.",
          "Traiter les paiements et répondre à vos demandes d'aide.",
          "Vous envoyer des nouvelles de YONA, seulement si vous l'avez accepté.",
        ],
      },
      "Nous ne vendons jamais vos données et nous n'affichons aucune publicité.",
    ],
  },
  {
    title: "4. Sur quelle base",
    blocks: [
      "Nous traitons vos données pour exécuter le service que vous avez demandé (votre inscription), avec votre consentement (informations sur votre foi, position, e-mails d'actualité, vérification), pour notre intérêt légitime à garantir la sécurité des membres, et pour respecter nos obligations légales (par exemple comptables).",
    ],
  },
  {
    title: "5. Qui peut voir vos données",
    blocks: [
      {
        list: [
          "Les autres membres voient seulement votre profil public : prénom, âge, ville, biographie, centres d'intérêt et photos validées. Jamais votre e-mail, votre téléphone ni votre position exacte.",
          "Les photos de vérification ne sont jamais publiées : seule l'équipe chargée de la vérification peut les consulter.",
          "L'équipe YONA y accède uniquement pour la modération, la vérification et le support.",
        ],
      },
      "Nous faisons appel à des prestataires techniques, qui traitent les données uniquement pour notre compte : Vercel (hébergement du site), Supabase (base de données et stockage des fichiers), Google (connexion avec Google, si vous la choisissez), notre prestataire de paiement, et Anthropic (assistant Roi Salomon : seules les questions que vous lui posez lui sont transmises pour produire la réponse).",
    ],
  },
  {
    title: "6. Transferts hors du Gabon",
    blocks: [
      "Certains prestataires sont situés hors du Gabon, notamment aux États-Unis. Nous choisissons des prestataires reconnus, qui appliquent des mesures de sécurité adaptées, et nous limitons les données transmises au strict nécessaire.",
    ],
  },
  {
    title: "7. Combien de temps nous les gardons",
    blocks: [
      {
        list: [
          "Tant que votre compte existe. Si vous supprimez votre compte, votre profil, vos photos, vos messages vocaux et vos données de compte sont supprimés.",
          "Les photos de vérification : le temps nécessaire à la vérification.",
          "Les informations de paiement : le temps imposé par les obligations comptables.",
        ],
      },
    ],
  },
  {
    title: "8. Sécurité",
    blocks: [
      "Les échanges avec le site sont chiffrés (HTTPS). L'accès aux données est contrôlé directement dans la base : chaque membre ne peut lire que ce qui lui est autorisé. Les photos de vérification sont rangées dans un espace de stockage privé.",
    ],
  },
  {
    title: "9. Vos droits",
    blocks: [
      "Vous pouvez à tout moment accéder à vos données, les corriger, les supprimer, vous opposer à leur utilisation, retirer votre consentement et demander à les recevoir. La plupart de ces actions se font directement depuis votre profil et vos paramètres ; sinon, écrivez-nous.",
      "Vous pouvez aussi adresser une réclamation à l'autorité de protection des données de votre pays : au Gabon, la Commission nationale pour la protection des données à caractère personnel (CNPDCP) ; en France, la CNIL ; en Belgique, l'Autorité de protection des données ; au Québec, la Commission d'accès à l'information.",
    ],
  },
  {
    title: "10. Mineurs",
    blocks: [
      `${APP_NAME} est strictement réservé aux personnes de 18 ans et plus. Tout compte d'une personne mineure est supprimé dès qu'il est repéré.`,
    ],
  },
  {
    title: "11. Modifications",
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
