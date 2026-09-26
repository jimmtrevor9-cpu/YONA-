import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { myMatchesQuery } from "@/features/matches/queries";
import { computeAge } from "@/features/profiles/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/matches")({
  head: () => ({
    meta: [
      { title: `Mes Matchs — ${APP_NAME}` },
      { name: "description", content: "Retrouvez les personnes avec qui vous avez un Match." },
      { property: "og:title", content: `Mes Matchs — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Retrouvez les personnes avec qui vous avez un Match.",
      },
    ],
  }),
  component: MatchesPage,
});

const matchedOn = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Liste des Matchs de la personne connectée. */
function MatchesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    ...myMatchesQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mes Matchs" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="matches-page">
        <p className="eyebrow">Vos Matchs</p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Vos Matchs n'ont pas pu être chargés. Réessayez dans un instant.
          </p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-3" aria-label="Liste de vos Matchs">
            {data.map((match) => {
              const age = computeAge(match.birthDate);
              const place = [match.city, match.country].filter(Boolean).join(", ");
              const name = match.firstName ?? "Membre";
              return (
                <li key={match.matchId} className="panel gold-thread flex items-center gap-4 p-4">
                  <Avatar className="size-14 ring-1 ring-gold/20">
                    {match.photoUrl ? (
                      <AvatarImage
                        src={match.photoUrl}
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
                      {age ? <span className="text-muted-foreground"> · {age} ans</span> : null}
                    </h2>
                    {place ? (
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden />
                        {place}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Match le {matchedOn.format(new Date(match.matchedAt))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas encore de Match. Quand une personne que vous aimez vous aime aussi,
              elle apparaît ici.
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
