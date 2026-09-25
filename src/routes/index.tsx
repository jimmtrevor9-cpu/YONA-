import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Check,
  Crown,
  Eye,
  Gift,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
} from "lucide-react";

import logoAsset from "@/assets/yona-logo.png.asset.json";
import { HeroStoryCarousel } from "@/components/HeroStoryCarousel";
import { Reveal } from "@/components/Reveal";
import { StepReveal } from "@/components/StepReveal";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, APP_VERSE } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — ${APP_TAGLINE}` },
      { name: "description", content: APP_DESCRIPTION },
      { property: "og:title", content: `${APP_NAME} — ${APP_TAGLINE}` },
      { property: "og:description", content: APP_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const reasons = [
  {
    icon: UserCheck,
    title: "Zéro faux profil",
    text: "Chaque inscription est vérifiée à la main. Ici, tu échanges avec de vraies personnes.",
  },
  {
    icon: Heart,
    title: "Des intentions claires",
    text: "Pas de badinage, pas de photos déplacées. Des chrétiens qui envisagent le mariage.",
  },
  {
    icon: Eye,
    title: "Ta vie privée d'abord",
    text: "Mode discret, photos floutées : c'est toi qui décides qui peut te voir.",
  },
  {
    icon: Sparkles,
    title: "Accompagnement personnel",
    text: "Des conseils et des amorces de conversation pour démarrer avec justesse.",
  },
];

const safety = [
  {
    title: "Vérification manuelle",
    text: "Pas de bot, pas de faux profil. Chaque inscription passe par notre équipe avant validation.",
  },
  {
    title: "Modération attentive",
    text: "Chaque message est filtré. Contenu déplacé ? Bloqué immédiatement.",
  },
  {
    title: "Contrôle total",
    text: "Mode discret, photos floutées. Tu décides qui voit quoi. Tes données restent les tiennes.",
  },
];

const steps = [
  {
    n: "01",
    title: "Inscris-toi en 5 minutes",
    text: "Prénom, email, quelques informations. C'est rapide et entièrement gratuit.",
  },
  {
    n: "02",
    title: "Découvre des profils compatibles",
    text: "Nous te proposons des personnes qui partagent ta foi et ta vision du couple.",
  },
  {
    n: "03",
    title: "Échange avec respect",
    text: "Messages modérés, amorces de conversation. Pas de dérive, juste l'essentiel.",
  },
  {
    n: "04",
    title: "Rencontre celle ou celui qui t'attend",
    text: "Que Dieu bénisse votre chemin et votre union. Amen.",
  },
];

const freeFeatures = [
  "Création de profil complète",
  "Jusqu'à 3 photos de profil",
  "5 demandes de contact par jour",
  "3 questions par jour au Roi Salomon, ton assistant IA",
  "Découverte et consultation des profils",
  "Recherche de profils",
  "Likes et Matchs",
  "3 messages gratuits après chaque Match",
  "Ton Match peut aussi t'envoyer 3 messages gratuits",
  "Répondre aux messages reçus",
  "Ice Breaker : idées de messages",
  "Support par email",
];

const freeLimits = [
  "Demandes de contact illimitées",
  "Questions illimitées au Roi Salomon",
  "Voir qui t'a ajouté en favoris",
  "Voir qui a visité ton profil",
  "Plus de 3 photos (jusqu'à 10 photos HD)",
  "Messagerie 100 % illimitée",
  "Messages vocaux",
  "Voir qui est connecté",
  "Ice Breaker personnalisé",
  "Message Flash",
  "Score de compatibilité IA détaillé",
  "Meilleur classement dans les résultats",
  "Filtres avancés",
  "Boosts de profil inclus",
  "Badge Premium vérifié",
  "Support prioritaire 7 j/7",
];

const premiumFeatures = [
  "Demandes de contact illimitées",
  "Roi Salomon : questions illimitées",
  "Voir qui t'a ajouté en favoris",
  "Voir qui a visité ton profil",
  "Jusqu'à 10 photos HD sur ton profil",
  "Messagerie 100 % illimitée",
  "Messages vocaux",
  "Voir qui est connecté",
  "Ice Breaker personnalisé",
  "Message Flash",
  "Score de compatibilité IA détaillé",
  "Mieux classé dans les résultats",
  "Filtres avancés",
  "Boosts de profil inclus",
  "Badge Premium vérifié",
  "Support prioritaire 7 j/7",
];

const commerce = [
  {
    icon: Gift,
    title: "Gratuit",
    text: "Crée ton profil, recherche, like, matche et commence gratuitement une conversation.",
  },
  {
    icon: MessageCircle,
    title: "1 $",
    text: "Quelqu'un t'intéresse vraiment ? Débloque cette conversation pendant 3 jours.",
  },
  {
    icon: Crown,
    title: "Premium",
    text: "Plus aucune limite, pour maximiser tes chances : 5 $/mois ou 35 $/an.",
  },
];

const testimonials = [
  {
    quote:
      "Enfin une plateforme où je me sens respectée. Aucun message déplacé, que des profils sérieux.",
    initial: "C",
    name: "Claire M., 27 ans",
    city: "Lyon, France",
  },
  {
    quote:
      "L'interface est claire, les profils sont vérifiés et l'équipe répond vite. Exactement ce qu'il nous fallait.",
    initial: "J",
    name: "Jean-Marc T., 31 ans",
    city: "Bruxelles, Belgique",
  },
  {
    quote:
      "J'avais peur de m'exposer en ligne. Ici, le mode discret me rassure : je cherche sereinement.",
    initial: "E",
    name: "Élise R., 25 ans",
    city: "Abidjan, Côte d'Ivoire",
  },
];

function StoreButtons() {
  return (
    <div className="flex flex-nowrap items-center gap-3">
      <Button asChild size="lg" className="btn-sheen h-12 flex-1 px-5 text-sm sm:text-base">
        <Link to="/register">Créer mon profil</Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="secondary"
        className="h-12 flex-1 px-5 text-sm sm:text-base"
      >
        <Link to="/login">J'ai déjà un compte</Link>
      </Button>
    </div>
  );
}

function Index() {
  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
            aria-label={`Revenir en haut de la page d'accueil ${APP_NAME}`}
            className="flex items-center rounded-md transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={logoAsset.url}
              alt={APP_NAME}
              width={64}
              height={64}
              className="size-14 object-contain"
            />
          </button>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#pourquoi" className="transition-colors hover:text-foreground">
              Pourquoi {APP_NAME}
            </a>
            <a href="#securite" className="transition-colors hover:text-foreground">
              Sécurité
            </a>
            <a href="#etapes" className="transition-colors hover:text-foreground">
              Comment ça marche
            </a>
            <a href="#tarifs" className="transition-colors hover:text-foreground">
              Tarifs
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Connexion</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="gold-halo mx-auto max-w-5xl px-5 pb-16 pt-10">
        <div className="grid items-start gap-10 md:grid-cols-2">
          <div className="animate-rise">
            <p className="eyebrow">{APP_TAGLINE}</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Rencontrer quelqu'un qui marche dans la même direction.
            </h1>
            <p className="mt-5 max-w-prose text-base text-muted-foreground">{APP_DESCRIPTION}</p>
            <div className="mt-8">
              <StoreButtons />
            </div>
            <p className="mt-8 text-[11px] text-muted-foreground">{APP_VERSE}</p>
          </div>

          <section aria-labelledby="presentation-title" className="md:col-start-1 md:row-start-2">
            <div>
              <span className="eyebrow">Découvre YONA</span>
              <h2
                id="presentation-title"
                className="mt-3 font-display text-2xl font-semibold text-foreground sm:text-3xl"
              >
                Une plateforme pensée pour toi
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                1 minute pour comprendre comment YONA va t'aider à trouver ta moitié.
              </p>
              <Reveal
                variant="left"
                className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="relative aspect-video w-full">
                  <iframe
                    src="https://player.vimeo.com/video/1226115080?autoplay=1&loop=1&controls=1&title=0&byline=0&portrait=0"
                    title="Présentation de YONA"
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </Reveal>
            </div>
          </section>

          <Reveal variant="right" className="md:col-start-2 md:row-span-2 md:row-start-1 md:h-full">
            <HeroStoryCarousel />
          </Reveal>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-3 sm:gap-5">
          {[
            { icon: Users, k: "+12 000", v: "membres actifs" },
            { icon: BadgeCheck, k: "100 %", v: "profils vérifiés" },
            { icon: Gift, k: "Gratuite", v: "inscription" },
          ].map((s, index) => (
            <Reveal
              key={s.v}
              variant="up"
              delay={index * 75}
              className="panel-2 flex flex-col items-center gap-2 px-3 py-5 text-center sm:flex-row sm:justify-center sm:gap-4 sm:px-5 sm:text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--color-gold)_45%,transparent)] bg-accent/60 sm:size-11">
                <s.icon className="size-5 text-primary" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold leading-tight text-foreground sm:text-2xl">
                  {s.k}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground sm:text-sm">
                  {s.v}
                </span>
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pourquoi */}
      <section id="pourquoi" className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">Pourquoi {APP_NAME}</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Pas une app de flirt. Une app pour bâtir un foyer.
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Nous avons créé ce que nous aurions aimé trouver : une plateforme sérieuse, fidèle à nos
          valeurs, sans les dérives des autres applications.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {reasons.map((r, index) => (
            <Reveal
              key={r.title}
              variant={index % 2 === 0 ? "left" : "right"}
              delay={(index % 2) * 80}
              className="panel gold-thread p-6"
            >
              <r.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{r.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sécurité */}
      <section id="securite" className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">Sécurité</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Ta sécurité n'est pas négociable
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Faux profils, arnaques, messages déplacés : nous nous en occupons. Toi, concentre-toi sur
          ta recherche.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {safety.map((s, index) => (
            <Reveal key={s.title} variant="fade" delay={index * 85} className="panel-2 p-6">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Étapes */}
      <section id="etapes" className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">4 étapes</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          De l'inscription au mariage
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Simple, rapide, sincère. Celle ou celui que tu cherches est peut-être à quelques clics.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {steps.map((s, i) => (
            <StepReveal key={s.n} index={i}>
              <div className="panel flex h-full flex-col items-center p-6 text-center">
                <span className="yona-step-badge font-display text-2xl font-semibold">{s.n}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </StepReveal>
          ))}
        </div>

        <Reveal variant="scale" className="panel gold-thread mt-10 p-8 text-center">
          <h3 className="font-display text-2xl font-semibold text-foreground">
            Celle ou celui qui t'attend fait peut-être le premier pas aujourd'hui.
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Inscription gratuite. 5 minutes. Zéro engagement.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg" className="btn-sheen">
              <Link to="/register">Je me lance</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">Tarifs</p>
        <h2 className="mt-3 font-display text-[1.6rem] font-semibold leading-tight text-foreground sm:text-4xl">
          <span className="whitespace-nowrap">Gratuit pour commencer.</span>{" "}
          <span className="whitespace-nowrap sm:whitespace-normal">
            Premium pour aller plus loin.
          </span>
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Tu peux utiliser {APP_NAME} gratuitement. Pour maximiser tes chances, passe en Premium.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Reveal variant="left" className="panel-2 p-7">
            <h3 className="font-display text-xl font-semibold text-foreground">Gratuit</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Découvre la plateforme et commence à faire des rencontres gratuitement.
            </p>
            <p className="mt-5 font-display text-3xl font-semibold text-foreground">0 $</p>
            <p className="text-xs text-muted-foreground">Pour toujours</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {freeFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
              {freeLimits.map((f) => (
                <li key={f} className="flex gap-2 opacity-60">
                  <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="line-through">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-xl border border-border bg-accent/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Besoin de continuer une conversation ?</p>
              <p className="mt-2">
                Après tes 3 messages gratuits : <strong className="text-foreground">1 $</strong>{" "}
                pour une messagerie illimitée pendant 3 jours avec cette personne. Le paiement
                débloque uniquement cette conversation, pour vous deux.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="mt-7 w-full">
              <Link to="/register">Commencer</Link>
            </Button>
          </Reveal>

          <Reveal variant="right" delay={80} className="panel gold-thread p-7">
            <span className="eyebrow">Le plus choisi</span>
            <h3 className="mt-2 flex items-center gap-2 font-display text-xl font-semibold text-foreground">
              <Crown className="size-5 text-primary" aria-hidden />
              Premium
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Maximise tes chances de trouver la bonne personne.
            </p>
            <p className="mt-5 font-display text-3xl font-semibold text-foreground">
              5 $ <span className="text-base font-normal text-muted-foreground">/ mois</span>
            </p>
            <p className="text-xs text-muted-foreground">ou 35 $ / an</p>
            <p className="mt-6 text-sm font-medium text-foreground">
              Tout le Gratuit, sans les limites
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {premiumFeatures.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="btn-sheen mt-7 w-full">
              <Link to="/register">Passer en Premium</Link>
            </Button>
          </Reveal>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {commerce.map((c, index) => (
            <Reveal key={c.title} variant="up" delay={index * 75} className="panel-2 p-6">
              <c.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-foreground">
                {c.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Témoignages */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <p className="eyebrow">Ils l'ont vécu</p>
        <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Des histoires qui finissent bien
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          Ils ont rencontré leur moitié sur {APP_NAME}. Et toi ?
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {testimonials.map((t, index) => (
            <Reveal
              as="figure"
              key={t.name}
              variant="depth"
              delay={index * 90}
              className="panel-2 p-6"
            >
              <MessageCircle className="size-5 text-primary" aria-hidden />
              <blockquote className="mt-4 text-sm text-muted-foreground">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent font-display text-sm text-accent-foreground">
                  {t.initial}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.city}</span>
                </span>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Verset + CTA final */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <Reveal variant="curtain" className="panel gold-halo gold-thread p-10 text-center">
          <h2 className="font-display text-2xl font-semibold leading-snug text-foreground sm:text-3xl">
            « Il n'est pas bon que l'homme soit seul »
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">Genèse 2:18</p>
          <p className="mt-6 text-base text-muted-foreground">
            Celle ou celui que tu cherches est peut-être ici. Fais le premier pas.
          </p>
          <div className="mt-7 flex justify-center">
            <Button asChild size="lg" className="btn-sheen">
              <Link to="/register">Créer mon profil gratuitement</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-base text-foreground">{APP_NAME}</span>
          <span>{APP_TAGLINE}</span>
        </div>
      </footer>
    </main>
  );
}
