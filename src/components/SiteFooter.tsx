import { Link } from "@tanstack/react-router";

import { LOGO_URL } from "@/lib/brand-assets";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";

/** Liens vers les pages légales, affichés dans le pied de page. */
export const LEGAL_LINKS = [
  { to: "/confidentialite", label: "Politique de confidentialité" },
  { to: "/conditions-utilisation", label: "Conditions d'utilisation" },
  { to: "/mentions-legales", label: "Mentions légales" },
  { to: "/cookies", label: "Politique de cookies" },
] as const;

/** Pied de page commun : logo + nom, slogan et liens légaux. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 py-8 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <span className="inline-flex items-center gap-2">
            <img
              src={LOGO_URL}
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 object-contain"
            />
            <span className="font-display text-lg leading-none text-foreground">{APP_NAME}</span>
          </span>
          <span>{APP_TAGLINE}</span>
        </div>
        <nav aria-label="Informations légales">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            {LEGAL_LINKS.map((link) => (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
