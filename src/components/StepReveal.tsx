import { useEffect, useRef, useState, type ReactNode } from "react";

/** Bloc d'étape révélé au scroll (animation inspirée du parcours d'inscription). */
export function StepReveal({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
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
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible ? "true" : "false"}
      className={`yona-step ${className ?? ""}`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {children}
    </div>
  );
}
