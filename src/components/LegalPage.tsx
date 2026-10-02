import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { APP_NAME } from "@/lib/config";
import { BRAND_LOGO_URL } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";

/** Typographie française : espace insécable avant « : ; ? ! » (jamais seuls en début de ligne). */
function fr(text: string): string {
  return text.replace(/ ([:;?!])/g, "\u00a0$1");
}

export type LegalBlock = string | { list: ReactNode[] } | { node: ReactNode };

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

/** Mise en page commune des pages légales (même style que le reste du site). */
export function LegalPage({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-5 py-4">
          <Link to="/" className="flex items-center gap-3" aria-label={`Accueil ${APP_NAME}`}>
            <img
              src={BRAND_LOGO_URL}
              alt=""
              width={44}
              height={44}
              className="size-11 object-contain"
            />
            <span className="font-display text-lg font-semibold text-foreground">{APP_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="px-5 py-12">
        <article className="mx-auto max-w-2xl">
          <div className="text-center">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-3 text-balance font-display text-3xl font-semibold text-foreground sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 text-xs text-muted-foreground">
              Dernière mise à jour : {LEGAL.updatedAt}
            </p>
            {intro ? (
              <p className="mx-auto mt-6 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {intro}
              </p>
            ) : null}
          </div>
          <div className="panel gold-thread mt-10 space-y-8 p-6 sm:p-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="font-display text-lg font-semibold text-foreground">
                  {section.title}
                </h2>
                {section.blocks.map((block, index) =>
                  typeof block === "string" ? (
                    <p key={index} className="text-sm leading-relaxed text-muted-foreground">
                      {fr(block)}
                    </p>
                  ) : "list" in block ? (
                    <ul
                      key={index}
                      className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground"
                    >
                      {block.list.map((item, i) => (
                        <li key={i}>{typeof item === "string" ? fr(item) : item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div key={index} className="text-sm leading-relaxed text-muted-foreground">
                      {block.node}
                    </div>
                  ),
                )}
              </section>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Une question ? Écrivez-nous à{" "}
            <a
              href={`mailto:${LEGAL.email}`}
              className="text-gold underline-offset-4 hover:underline"
            >
              {LEGAL.email}
            </a>{" "}
            ou appelez le{" "}
            <a href={LEGAL.phoneHref} className="text-gold underline-offset-4 hover:underline">
              {LEGAL.phoneDisplay}
            </a>
            .
          </p>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
