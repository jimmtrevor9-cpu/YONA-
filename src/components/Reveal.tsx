import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

export type RevealVariant = "up" | "left" | "right" | "fade" | "scale" | "depth" | "curtain";

/**
 * Révélation au scroll (IntersectionObserver, déclenchée une seule fois).
 * Plusieurs variantes pour éviter la monotonie d'une page entière.
 */
export function Reveal({
  as,
  variant = "up",
  delay = 0,
  className,
  children,
  ...rest
}: {
  as?: ElementType;
  variant?: RevealVariant;
  delay?: number;
  className?: string;
  children: ReactNode;
  [key: string]: unknown;
}) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-visible={visible ? "true" : "false"}
      className={className}
      style={{ animationDelay: `${delay}ms`, transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Groupe d'éléments révélés en cascade (stagger court et naturel). */
export function RevealGroup({
  children,
  variant = "up",
  step = 90,
  base = 0,
  className,
  as,
}: {
  children: ReactNode[];
  variant?: RevealVariant;
  step?: number;
  base?: number;
  className?: string;
  as?: ElementType;
}) {
  return (
    <>
      {children.map((child, i) => (
        <Reveal
          key={i}
          {...(as ? { as } : {})}
          variant={variant}
          delay={base + i * step}
          {...(className ? { className } : {})}
        >
          {child}
        </Reveal>
      ))}
    </>
  );
}
