import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { unreadNotificationsQuery } from "@/features/notifications/queries";

/** Cloche de l'en-tête avec le nombre de notifications non lues (19.8). */
export function NotificationBell() {
  const { user } = useAuth();
  const { data: unread = 0 } = useQuery({
    ...unreadNotificationsQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const label =
    unread > 0 ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications";
  return (
    <Button asChild variant="ghost" size="icon" className="relative size-9">
      <Link to="/notifications" aria-label={label} title="Notifications">
        <Bell className="size-5" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-gold px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground"
            data-testid="notifications-unread"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
