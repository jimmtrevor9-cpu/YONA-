import { MessageCircle } from "lucide-react";
import { useState } from "react";

export interface Testimonial {
  quote: string;
  initial: string;
  name: string;
  city: string;
}

/**
 * Témoignages en défilement horizontal continu (de la gauche vers la droite, en boucle).
 * - Pause au survol (ordinateur) et tant que le doigt est posé (mobile).
 * - Cartes de même largeur et de même hauteur.
 * - Mouvement réduit demandé par le système : pas d'animation, défilement manuel.
 */
export function TestimonialMarquee({ items }: { items: Testimonial[] }) {
  const [held, setHeld] = useState(false);
  // Une « série » assez longue pour couvrir les grands écrans, répétée deux fois pour
  // que la boucle soit invisible (l'animation glisse d'exactement une série).
  const series = [...items, ...items];
  const track = [...series, ...series];

  return (
    <div
      className="yona-marquee"
      data-held={held ? "true" : "false"}
      onTouchStart={() => setHeld(true)}
      onTouchEnd={() => setHeld(false)}
      onTouchCancel={() => setHeld(false)}
      aria-label="Témoignages de membres"
      role="region"
    >
      <ul className="yona-marquee-track">
        {track.map((t, index) => (
          <li
            key={`${t.name}-${index}`}
            aria-hidden={index >= items.length ? true : undefined}
            className="yona-marquee-item"
          >
            <figure className="panel-2 flex h-full flex-col items-center p-6 text-center">
              <MessageCircle className="size-5 text-primary" aria-hidden />
              <blockquote className="mt-4 flex-1 text-sm text-muted-foreground">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 flex flex-col items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-accent font-display text-sm text-accent-foreground">
                  {t.initial}
                </span>
                <span>
                  <span className="block text-sm font-medium text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">{t.city}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
