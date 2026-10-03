import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, Globe2, Heart, MessageCircle, UserRound } from "lucide-react";

import { useAuth } from "@/features/auth/AuthProvider";
import { unreadBadge, unreadLabel, useUnreadTotal } from "@/features/messaging/unread";
import { cn } from "@/lib/utils";

// Même disposition que le modèle : boutons ronds, la page en cours en pastille large avec
// son nom ; mêmes destinations qu'avant (rien n'est retiré).
const items = [
  { to: "/profile", label: "Profil", icon: UserRound },
  { to: "/search", label: "Recherche", icon: Globe2 },
  { to: "/discover", label: "Découvrir", icon: Compass },
  { to: "/matches", label: "Matchs", icon: Heart },
  { to: "/messages", label: "Messages", icon: MessageCircle },
] as const;

/** Navigation mobile persistante de l'espace connecté. */
export function BottomNav() {
  const { user } = useAuth();
  const unread = useUnreadTotal(user?.id ?? "");
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pt-2"
      aria-label="Navigation principale"
    >
      <ul className="mx-auto flex max-w-md items-center justify-between gap-1.5 rounded-[1.75rem] border border-border bg-surface/95 p-2 shadow-[0_10px_30px_-12px_oklch(0.3_0.05_340/35%)] backdrop-blur">
        {items.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          const badge = to === "/messages" && unread > 0;
          return (
            <li key={to} className={cn("flex", active ? "flex-[2.4]" : "flex-1")}>
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-12 w-full items-center justify-center gap-2 rounded-full border transition-colors",
                  active
                    ? "border-transparent bg-gradient-to-r from-primary to-gold px-4 text-primary-foreground shadow-[0_8px_20px_-8px_oklch(0.62_0.16_355/70%)]"
                    : "border-border bg-surface text-muted-foreground hover:text-gold",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {active ? (
                  <span className="truncate font-display text-[15px] font-semibold">{label}</span>
                ) : null}
                {badge ? (
                  <span
                    className="absolute -right-0.5 -top-1 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-semibold leading-5 text-white ring-2 ring-surface"
                    data-testid="unread-total"
                    aria-hidden
                  >
                    {unreadBadge(unread)}
                  </span>
                ) : null}
                {badge ? <span className="sr-only">, {unreadLabel(unread)}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
