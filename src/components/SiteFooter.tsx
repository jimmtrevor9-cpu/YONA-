import { Link } from "@tanstack/react-router";

import { InstallAppButton } from "@/components/signup/InstallAppButton";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { BRAND_LOGO_URL } from "@/lib/brand";
import { LEGAL, LEGAL_LINKS } from "@/lib/legal";

/** Pied de page public : logo + nom, pages légales, contact, installation de l'application. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 py-10 text-center text-sm text-muted-foreground">
        <Link to="/" className="flex items-center gap-3" aria-label={`Accueil ${APP_NAME}`}>
          <img
            src={BRAND_LOGO_URL}
            alt=""
            width={48}
            height={48}
            className="size-12 object-contain"
          />
          <span className="font-display text-xl font-semibold tracking-wide text-foreground">
            {APP_NAME}
          </span>
        </Link>
        <span>{APP_TAGLINE}</span>
        <InstallAppButton />
        <nav
          aria-label="Informations légales"
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs">
          © {new Date().getFullYear()} {LEGAL.brand} · {LEGAL.headOffice} ·{" "}
          <a href={LEGAL.phoneHref} className="hover:text-foreground">
            {LEGAL.phoneDisplay}
          </a>
        </p>
      </div>
    </footer>
  );
}
