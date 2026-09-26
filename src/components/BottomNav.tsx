import { Link } from "@tanstack/react-router";
import { Compass, Heart, Search, UserRound } from "lucide-react";

const items = [
  { to: "/discover", label: "Découvrir", icon: Compass },
  { to: "/search", label: "Recherche", icon: Search },
  { to: "/matches", label: "Matchs", icon: Heart },
  { to: "/profile", label: "Profil", icon: UserRound },
] as const;

/** Navigation mobile persistante de l'espace connecté. */
export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pt-2 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-1 text-[11px] text-muted-foreground transition-colors"
              activeProps={{ className: "text-gold" }}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
