import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { APP_NAME, APP_VERSE } from "@/lib/config";

/** Cadre commun aux écrans d'authentification (obsidienne + fil d'or). */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="gold-halo w-full max-w-md">
        <Link to="/" className="mb-8 block text-center">
          <span className="font-display text-2xl font-semibold text-foreground">{APP_NAME}</span>
        </Link>

        <section className="panel gold-thread animate-rise p-6 sm:p-8">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 font-display text-2xl font-semibold text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-6">{children}</div>
        </section>

        {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
        <p className="mt-8 text-center text-[11px] text-muted-foreground">{APP_VERSE}</p>
      </div>
    </main>
  );
}
