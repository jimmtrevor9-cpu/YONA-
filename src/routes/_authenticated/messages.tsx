import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { myConversationsQuery } from "@/features/messaging/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: `Messages — ${APP_NAME}` },
      { name: "description", content: "Échangez avec les personnes avec qui vous avez un Match." },
      { property: "og:title", content: `Messages — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Échangez avec les personnes avec qui vous avez un Match.",
      },
    ],
  }),
  component: MessagesPage,
});

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** Heure si aujourd'hui, sinon date courte (ex. « 12 sept. »). */
function formatActivity(iso: string): string {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? timeFormat.format(date)
    : dayFormat.format(date);
}

/** Liste des conversations de la personne connectée. */
function MessagesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    ...myConversationsQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Messages" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="messages-page">
        <p className="eyebrow">Vos conversations</p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Vos conversations n'ont pas pu être chargées. Réessayez dans un instant.
          </p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-3" aria-label="Liste de vos conversations">
            {data.map((conversation) => {
              const name = conversation.firstName ?? "Membre";
              const last = conversation.lastMessage;
              return (
                <li
                  key={conversation.conversationId}
                  className="panel gold-thread flex items-center gap-4 p-4"
                >
                  <Avatar className="size-12 ring-1 ring-gold/20">
                    {conversation.photoUrl ? (
                      <AvatarImage
                        src={conversation.photoUrl}
                        alt={`Photo de ${name}`}
                        className="object-cover"
                      />
                    ) : null}
                    <AvatarFallback className="bg-accent font-display text-lg text-gold-soft">
                      {name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="truncate font-display text-base font-semibold text-foreground">
                        {name}
                      </h2>
                      <time
                        dateTime={conversation.activityAt}
                        className="shrink-0 text-[11px] text-muted-foreground"
                      >
                        {formatActivity(conversation.activityAt)}
                      </time>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {last
                        ? `${last.fromMe ? "Vous : " : ""}${last.content}`
                        : `Nouveau Match : dites bonjour à ${name} !`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas encore de conversation. Chaque Match ouvre une conversation.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/discover">Découvrir des profils</Link>
            </Button>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
