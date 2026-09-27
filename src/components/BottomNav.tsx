import { Link } from "@tanstack/react-router";
import { Compass, Heart, MessageCircle, Search, UserRound } from "lucide-react";

import { useAuth } from "@/features/auth/AuthProvider";
import { unreadBadge, unreadLabel, useUnreadTotal } from "@/features/messaging/unread";

const items = [
  { to: "/discover", label: "Découvrir", icon: Compass },
  { to: "/search", label: "Recherche", icon: Search },
  { to: "/matches", label: "Matchs", icon: Heart },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/profile", label: "Profil", icon: UserRound },
] as const;

/** Navigation mobile persistante de l'espace connecté. */
export function BottomNav() {
  const { user } = useAuth();
  const unread = useUnreadTotal(user?.id ?? "");

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
              <span className="relative">
                <Icon className="size-5" aria-hidden />
                {to === "/messages" && unread > 0 ? (
                  <span
                    className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-gold px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground"
                    data-testid="unread-total"
                    aria-hidden
                  >
                    {unreadBadge(unread)}
                  </span>
                ) : null}
              </span>
              {label}
              {to === "/messages" && unread > 0 ? (
                <span className="sr-only">, {unreadLabel(unread)}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
