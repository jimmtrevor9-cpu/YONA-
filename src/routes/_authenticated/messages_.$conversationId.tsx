import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { conversationQuery } from "@/features/messaging/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/messages_/$conversationId")({
  head: () => ({
    meta: [
      { title: `Conversation — ${APP_NAME}` },
      {
        name: "description",
        content: "Conversation avec une personne avec qui vous avez un Match.",
      },
    ],
  }),
  component: ConversationPage,
});

/** Page d'une conversation (les messages s'y affichent à partir de l'étape 4.5). */
function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    ...conversationQuery(user?.id ?? "", conversationId),
    enabled: !!user?.id,
  });
  const name = data?.firstName ?? "Membre";

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title={data ? name : "Conversation"} />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="conversation-page">
        <Link
          to="/messages"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Messages
        </Link>

        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : isError ? (
          <p className="text-sm text-destructive">
            Cette conversation n'a pas pu être chargée. Réessayez dans un instant.
          </p>
        ) : !data ? (
          <div className="panel space-y-4 p-6 text-center" data-testid="conversation-unavailable">
            <p className="text-sm text-muted-foreground">
              Cette conversation n'est pas disponible.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/messages">Retour à mes messages</Link>
            </Button>
          </div>
        ) : (
          <>
            <section className="panel gold-thread flex items-center gap-4 p-4">
              <Avatar className="size-12 ring-1 ring-gold/20">
                {data.photoUrl ? (
                  <AvatarImage
                    src={data.photoUrl}
                    alt={`Photo de ${name}`}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="bg-accent font-display text-lg text-gold-soft">
                  {name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-lg font-semibold text-foreground">
                  {name}
                </h2>
                <Link
                  to="/matches/$matchId"
                  params={{ matchId: data.matchId }}
                  className="text-xs text-gold-soft underline-offset-4 hover:underline"
                >
                  Voir son profil
                </Link>
              </div>
            </section>

            <section
              className="panel min-h-60 p-5"
              aria-label={`Conversation avec ${name}`}
              data-testid="conversation-thread"
            >
              <p className="text-center text-xs text-muted-foreground">
                Début de votre conversation avec {name}.
              </p>
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
