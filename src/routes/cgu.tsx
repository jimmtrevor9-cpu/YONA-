import { createFileRoute, Link } from "@tanstack/react-router";

import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/cgu")({
  head: () => ({
    meta: [
      { title: `Conditions d'utilisation — ${APP_NAME}` },
      { name: "description", content: `Les règles d'utilisation de ${APP_NAME}.` },
    ],
  }),
  component: TermsPage,
});

const SECTIONS: { title: string; text: string[] }[] = [
  {
    title: "1. Qui peut s'inscrire",
    text: [
      `${APP_NAME} est un service de rencontre chrétienne réservé aux personnes majeures (18 ans et plus) qui cherchent une relation sincère et sérieuse.`,
      "En créant un compte, vous certifiez avoir 18 ans ou plus et fournir des informations vraies.",
    ],
  },
  {
    title: "2. Respect des autres membres",
    text: [
      "Sont interdits : les insultes, le harcèlement, les arnaques ou demandes d'argent, les contenus sexuels ou choquants, les faux profils et la publicité.",
      "Chaque membre peut bloquer ou signaler un autre membre. L'équipe peut suspendre ou supprimer un compte qui ne respecte pas ces règles.",
    ],
  },
  {
    title: "3. Photos et informations",
    text: [
      "Vos photos doivent vous représenter. Elles sont vérifiées par l'équipe avant d'être montrées aux autres membres.",
      "Votre position exacte n'est jamais montrée : seule une distance approximative sert à la recherche.",
    ],
  },
  {
    title: "4. Offres payantes",
    text: [
      "L'inscription est gratuite. Le Premium (mensuel ou annuel) et le déblocage d'une conversation sont des paiements uniques, sans renouvellement automatique.",
    ],
  },
  {
    title: "5. Vos données",
    text: [
      "Nous utilisons seulement les cookies nécessaires pour vous garder connecté, sans publicité ni mesure d'audience.",
      "Vous pouvez masquer votre profil ou supprimer votre compte à tout moment depuis les paramètres.",
    ],
  },
];

function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-10">
      <article className="mx-auto max-w-2xl space-y-6">
        <Link to="/" className="font-display text-xl font-semibold text-foreground">
          {APP_NAME}
        </Link>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Conditions générales d'utilisation
        </h1>
        {SECTIONS.map((section) => (
          <section key={section.title} className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
            {section.text.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </section>
        ))}
        <p className="text-xs text-muted-foreground">
          Pour toute question, écrivez-nous depuis la page Aide une fois connecté.
        </p>
      </article>
    </main>
  );
}
