import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Eye, Heart, MessageCircle, Send, Sparkles, Star } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  type AppNotification,
  markAllNotificationsRead,
  markNotificationRead,
  notificationTarget,
  notificationText,
  notificationsQuery,
} from "@/features/notifications/queries";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: `Notifications — ${APP_NAME}` },
      { name: "description", content: "Vos Likes, Matchs, messages et demandes." },
    ],
  }),
  component: NotificationsPage,
});

const ICONS = {
  like: Heart,
  match: Sparkles,
  message: MessageCircle,
  favorite: Star,
  visit: Eye,
  contact_request: Send,
} as const;

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Page des notifications (19.1 à 19.9). */
function NotificationsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    ...notificationsQuery(userId),
    enabled: !!userId,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const unread = (data ?? []).filter((n) => !n.readAt).length;

  const open = async (n: AppNotification) => {
    if (!n.readAt) {
      await markNotificationRead(n.id).catch(() => undefined);
      void refresh();
    }
    void navigate(notificationTarget(n));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Notifications" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="notifications-page">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" data-testid="notifications-summary">
            {unread > 0 ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu"}
          </p>
          {unread > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              Tout marquer comme lu
            </Button>
          ) : null}
        </div>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">Les notifications n'ont pas pu être chargées.</p>
        ) : data?.length ? (
          <ul className="space-y-2" data-testid="notifications-list">
            {data.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void open(n)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-4 text-left transition-colors",
                      n.readAt ? "panel-2" : "panel ring-1 ring-gold/40",
                    )}
                    data-testid="notification-item"
                    data-read={n.readAt ? "true" : "false"}
                    data-type={n.type}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        n.readAt ? "text-muted-foreground" : "text-gold",
                      )}
                      aria-hidden
                    />
                    <span className="flex-1">
                      <span className="block text-sm text-foreground">{notificationText(n)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {timeFormat.format(new Date(n.createdAt))}
                        {n.readAt ? "" : " · non lue"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p
            className="panel p-6 text-center text-sm text-muted-foreground"
            data-testid="notifications-empty"
          >
            Aucune notification pour le moment.
          </p>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
