import { useCallback, useEffect, useRef, useState } from "react";

import { BRAND_SLIDE_URLS } from "@/lib/brand";

type Slide = {
  url: string;
  alt: string;
  caption: string;
};

const slides: Slide[] = [
  {
    url: BRAND_SLIDE_URLS[0]!,
    alt: "Couple africain chrétien en tenues modernes",
    caption: "Des célibataires chrétiens sérieux, prêts à bâtir une histoire à deux.",
  },
  {
    url: BRAND_SLIDE_URLS[1]!,
    alt: "Demande en mariage : un homme à genoux offre une bague à sa compagne",
    caption: "Une rencontre sincère, puis la promesse d'un « oui » pour la vie.",
  },
  {
    url: BRAND_SLIDE_URLS[2]!,
    alt: "Mariés chrétiens africains le jour de leur mariage",
    caption: "Le jour du mariage : deux chemins qui n'en font plus qu'un.",
  },
  {
    url: BRAND_SLIDE_URLS[3]!,
    alt: "Jeune couple marié tenant son nouveau-né",
    caption: "Les premiers pas d'une famille bénie.",
  },
  {
    url: BRAND_SLIDE_URLS[4]!,
    alt: "Famille chrétienne africaine avec deux enfants",
    caption: "Un foyer qui grandit, dans la foi et dans l'amour.",
  },
];

const INTERVAL = 5200;

export function HeroStoryCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Image absente ou illisible : un fond aux couleurs de YONA la remplace proprement.
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // L'erreur de chargement peut survenir avant que React prenne la main (rendu serveur) :
  // on revérifie donc chaque image une fois la page affichée.
  useEffect(() => {
    for (const s of slides) {
      const probe = new Image();
      probe.onerror = () => setMissing((prev) => new Set(prev).add(s.url));
      probe.src = s.url;
    }
  }, []);

  const go = useCallback((next: number) => {
    setIndex(((next % slides.length) + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [paused]);

  return (
    <figure
      className="panel gold-thread relative mx-auto aspect-[4/5] w-full min-w-0 max-w-md overflow-hidden md:col-start-2 md:row-span-2 md:row-start-1 md:aspect-auto md:h-full md:min-h-[46rem] md:max-w-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrousel"
      aria-label="L'histoire d'un couple, étape par étape"
    >
      <div className="relative h-full w-full overflow-hidden">
        <div
          className="flex h-full w-full will-change-transform"
          style={{
            transform: `translate3d(-${index * 100}%, 0, 0)`,
            transition: "transform 1400ms cubic-bezier(0.76, 0, 0.24, 1)",
          }}
        >
          {slides.map((s, i) => (
            <div key={s.url} className="relative h-full w-full shrink-0 grow-0 basis-full">
              {missing.has(s.url) ? (
                <div
                  role="img"
                  aria-label={s.alt}
                  className="h-full w-full"
                  style={{
                    background:
                      "radial-gradient(120% 80% at 50% 20%, color-mix(in oklab, var(--primary) 30%, var(--surface)) 0%, color-mix(in oklab, var(--gold) 55%, var(--foreground)) 100%)",
                  }}
                />
              ) : (
                <img
                  src={s.url}
                  alt={s.alt}
                  width={1024}
                  height={1280}
                  loading="eager"
                  className="h-full w-full object-cover"
                  style={{
                    transform: i === index ? "scale(1.07)" : "scale(1.01)",
                    filter: i === index ? "saturate(1.03)" : "saturate(0.9)",
                    transition:
                      "transform 7000ms cubic-bezier(0.22, 1, 0.36, 1), filter 1400ms ease",
                  }}
                  onError={() => setMissing((prev) => new Set(prev).add(s.url))}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Vignette + liseré doré */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 25%, transparent 45%, color-mix(in oklab, var(--foreground) 45%, transparent) 100%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-3 rounded-[calc(var(--radius-2xl)-0.25rem)] border"
        style={{ borderColor: "color-mix(in oklab, var(--color-gold) 55%, transparent)" }}
        aria-hidden
      />

      <span className="pointer-events-none absolute right-5 top-5 z-10 font-mono text-[10px] tracking-[0.28em] text-primary-foreground/85">
        {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
      </span>

      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/45 to-transparent px-7 pb-16 pt-28 text-center text-primary-foreground">
        {slides.map((s, i) => (
          <span
            key={s.caption}
            className={i === index ? "block" : "hidden"}
            style={{
              animation: "yona-caption-in 1100ms cubic-bezier(0.22, 1, 0.36, 1) both",
            }}
          >
            <span
              className="mx-auto mb-4 block h-px w-12"
              style={{ background: "color-mix(in oklab, var(--color-gold) 80%, transparent)" }}
            />
            <span className="block text-balance font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
              {s.caption}
            </span>
          </span>
        ))}
      </figcaption>

      <div className="absolute inset-x-0 bottom-6 z-10 flex items-center justify-center gap-2.5">
        {slides.map((s, i) => (
          <button
            key={s.url}
            type="button"
            onClick={() => go(i)}
            aria-label={`Voir l'image ${i + 1} sur ${slides.length}`}
            aria-current={i === index}
            className="group h-[3px] overflow-hidden rounded-full bg-primary-foreground/30 transition-all duration-700"
            style={{ width: i === index ? "2.75rem" : "0.6rem" }}
          >
            <span
              className="block h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, var(--color-gold), white)",
                width: i === index ? "100%" : "0%",
                transition: i === index ? `width ${INTERVAL}ms linear` : "width 300ms ease",
              }}
            />
          </button>
        ))}
      </div>
    </figure>
  );
}
