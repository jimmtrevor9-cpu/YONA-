import { Link } from "@tanstack/react-router";

import { SiteFooter } from "@/components/SiteFooter";
import { LOGO_URL } from "@/lib/brand-assets";
import { APP_NAME } from "@/lib/config";

export type LegalSection = { title: string; text: string[] };

/** Date affichée en haut de chaque page légale. */
export const LEGAL_LAST_UPDATE = "2 octobre 2026";

/** Mise en page commune aux pages légales (même style que le reste du site). */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-5 py-10">
        <article className="mx-auto max-w-2xl space-y-6">
          <div className="flex justify-center">
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-display text-xl font-semibold text-foreground"
            >
              <img
                src={LOGO_URL}
                alt=""
                aria-hidden="true"
                width={36}
                height={36}
                className="size-9 object-contain"
              />
              {APP_NAME}
            </Link>
          </div>
          <header className="space-y-2 text-center">
            <h1 className="font-display text-3xl font-semibold text-balance text-foreground">
              {title}
            </h1>
            <p className="text-xs text-muted-foreground">
              Dernière mise à jour : {LEGAL_LAST_UPDATE}
            </p>
          </header>
          <p className="text-center text-sm leading-relaxed text-muted-foreground">{intro}</p>
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              {section.text.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
