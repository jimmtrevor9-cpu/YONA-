import { createFileRoute, Link } from "@tanstack/react-router";

import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { APP_NAME } from "@/lib/config";
import { LEGAL } from "@/lib/legal";

export const Route = createFileRoute("/mentions-legales")({
  head: () => ({
    meta: [
      { title: `Mentions légales — ${APP_NAME}` },
      { name: "description", content: `Éditeur, hébergement et contact de ${APP_NAME}.` },
    ],
  }),
  component: LegalNoticePage,
});

const company = [
  LEGAL.legalForm
    ? `${LEGAL.brand}, ${LEGAL.legalForm}`
    : `${LEGAL.brand}, société immatriculée au Gabon`,
  LEGAL.registration ? `Immatriculation : ${LEGAL.registration}` : null,
  `Siège social : ${LEGAL.headOffice}`,
].filter((line): line is string => !!line);

const SECTIONS: LegalSection[] = [
  {
    title: "Éditeur du site",
    blocks: [
      {
        list: [
          ...company,
          <>
            Téléphone :{" "}
            <a href={LEGAL.phoneHref} className="text-gold underline-offset-4 hover:underline">
              {LEGAL.phoneDisplay}
            </a>
          </>,
          <>
            E-mail :{" "}
            <a
              href={`mailto:${LEGAL.email}`}
              className="text-gold underline-offset-4 hover:underline"
            >
              {LEGAL.email}
            </a>
          </>,
        ],
      },
    ],
  },
  {
    title: "Directeur de la publication",
    blocks: [LEGAL.publicationDirector],
  },
  {
    title: "Hébergement",
    blocks: [
      {
        list: [
          "Site et application : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (vercel.com).",
          "Base de données, comptes et fichiers (photos) : Supabase, Inc. (supabase.com).",
        ],
      },
    ],
  },
  {
    title: "Propriété intellectuelle",
    blocks: [
      `Le nom ${APP_NAME}, le logo, les textes, les images, la vidéo de présentation et la mise en page du site sont protégés. Toute reproduction ou réutilisation, totale ou partielle, sans autorisation écrite de ${LEGAL.brand} est interdite.`,
      "Les photos et textes publiés par les membres restent leur propriété ; ils nous autorisent seulement à les afficher sur le service, le temps de leur inscription.",
    ],
  },
  {
    title: "Données personnelles et cookies",
    blocks: [
      {
        node: (
          <p>
            La manière dont nous protégeons vos données est expliquée dans la{" "}
            <Link to="/confidentialite" className="text-gold underline-offset-4 hover:underline">
              politique de confidentialité
            </Link>{" "}
            et dans la{" "}
            <Link to="/cookies" className="text-gold underline-offset-4 hover:underline">
              politique des cookies
            </Link>
            .
          </p>
        ),
      },
    ],
  },
  {
    title: "Crédits",
    blocks: [
      "Données géographiques (pays, régions, villes) : GeoNames (geonames.org), sous licence Creative Commons Attribution 4.0 (CC BY 4.0). Noms des pays en français : Unicode CLDR.",
    ],
  },
  {
    title: "Signaler un contenu",
    blocks: [
      `Un profil, une photo ou un message vous semble illicite ou contraire à nos règles ? Utilisez le bouton « Signaler » dans l'application, ou écrivez-nous à ${LEGAL.email}. Nous traitons chaque signalement dans les meilleurs délais.`,
    ],
  },
];

function LegalNoticePage() {
  return <LegalPage eyebrow="Informations légales" title="Mentions légales" sections={SECTIONS} />;
}
