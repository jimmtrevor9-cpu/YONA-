import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { FavoriteMemberCard } from "@/components/FavoriteMemberCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  favoritedByCountLabel,
  favoritesCountLabel,
  unavailableFavoritesLabel,
} from "@/features/favorites/labels";
import {
  favoritedByQuery,
  myFavoriteIdsQuery,
  myFavoritesQuery,
} from "@/features/favorites/queries";
import { useFavoriteToggle } from "@/features/favorites/useFavoriteToggle";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/favoris")({
  head: () => ({
    meta: [
      { title: `Mes favoris — ${APP_NAME}` },
      { name: "description", content: "Retrouvez les profils que vous avez mis en favori." },
      { property: "og:title", content: `Mes favoris — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Retrouvez les profils que vous avez mis en favori.",
      },
    ],
  }),
  component: FavoritesPage,
});

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Page Favoris de la personne connectée. */
function FavoritesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data, isLoading, isError } = useQuery({
    ...myFavoritesQuery(userId),
    enabled: !!userId,
  });
  const { data: favoriteIds } = useQuery({ ...myFavoriteIdsQuery(userId), enabled: !!userId });
  const favorite = useFavoriteToggle(userId);
  const favorites = data?.favorites ?? [];
  const unavailable = data?.unavailableCount ?? 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mes favoris" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="favorites-page">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Vos favoris</p>
          <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">
            Retour au profil
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Vos favoris n'ont pas pu être chargés. Réessayez dans un instant.
          </p>
        ) : favorites.length > 0 || unavailable > 0 ? (
          <>
            {favorites.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground" data-testid="favorites-count">
                  {favoritesCountLabel(favorites.length)}
                </p>
                <ul className="space-y-3" aria-label="Liste de vos favoris">
                  {favorites.map((item) => (
                    <FavoriteMemberCard
                      key={item.userId}
                      testId="favorite-item"
                      firstName={item.firstName}
                      birthDate={item.birthDate}
                      city={item.city}
                      country={item.country}
                      photoUrl={item.photoUrl}
                      details={
                        <>
                          Ajouté le {dayFormat.format(new Date(item.favoritedAt))}
                          {item.matchId ? (
                            <>
                              {" · "}
                              <Link
                                to="/matches/$matchId"
                                params={{ matchId: item.matchId }}
                                className="text-gold-soft underline-offset-2 hover:underline"
                              >
                                Voir le profil
                              </Link>
                            </>
                          ) : null}
                        </>
                      }
                      isFavorite={favoriteIds?.has(item.userId) ?? true}
                      isFavoritePending={favorite.pendingId === item.userId}
                      onToggleFavorite={() =>
                        favorite.toggle(item.userId, favoriteIds?.has(item.userId) ?? true)
                      }
                    />
                  ))}
                </ul>
              </>
            ) : null}
            {unavailable > 0 ? (
              <p className="text-xs text-muted-foreground" data-testid="favorites-unavailable">
                {unavailableFavoritesLabel(unavailable)}
              </p>
            ) : null}
          </>
        ) : (
          <div className="panel space-y-4 p-6 text-center" data-testid="favorites-empty">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas encore de favori. Touchez l'étoile d'un profil pour le retrouver ici.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/discover">Découvrir des profils</Link>
            </Button>
          </div>
        )}

        <FavoritedBySection userId={userId} favoriteIds={favoriteIds} favorite={favorite} />
      </main>
      <BottomNav />
    </div>
  );
}

/** « Ils vous ont mis en favori » : réservé aux membres Premium. */
function FavoritedBySection({
  userId,
  favoriteIds,
  favorite,
}: {
  userId: string;
  favoriteIds: Set<string> | undefined;
  favorite: ReturnType<typeof useFavoriteToggle>;
}) {
  const { data, isLoading, isError } = useQuery({
    ...favoritedByQuery(userId),
    enabled: !!userId,
  });
  if (isLoading || !data) return null;

  if (!data.premium) {
    return (
      <section
        className="space-y-3 pt-4"
        aria-labelledby="favorited-by-title"
        data-testid="favorited-by-locked"
      >
        <p id="favorited-by-title" className="eyebrow">
          Ils vous ont mis en favori
        </p>
        <div className="panel-2 flex items-start gap-3 p-4">
          <Lock className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Réservé aux membres Premium</p>
            <p className="text-xs text-muted-foreground">
              Avec Premium, découvrez qui vous a mis en favori.{" "}
              <Link
                to="/premium"
                className="font-medium text-gold underline-offset-2 hover:underline"
              >
                Découvrir Premium
              </Link>
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="space-y-3 pt-4"
      aria-labelledby="favorited-by-title"
      data-testid="favorited-by"
    >
      <p id="favorited-by-title" className="eyebrow">
        Ils vous ont mis en favori
      </p>
      {isError ? (
        <p className="text-sm text-destructive">
          Cette liste n'a pas pu être chargée. Réessayez dans un instant.
        </p>
      ) : data.members.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="favorited-by-count">
            {favoritedByCountLabel(data.members.length)}
          </p>
          <ul className="space-y-3" aria-label="Membres qui vous ont mis en favori">
            {data.members.map((member) => (
              <FavoriteMemberCard
                key={member.userId}
                testId="favorited-by-item"
                firstName={member.firstName}
                birthDate={member.birthDate}
                city={member.city}
                country={member.country}
                photoUrl={member.photoUrl}
                details={<>Vous a ajouté le {dayFormat.format(new Date(member.favoritedAt))}</>}
                isFavorite={favoriteIds?.has(member.userId) ?? false}
                isFavoritePending={favorite.pendingId === member.userId}
                onToggleFavorite={() =>
                  favorite.toggle(member.userId, favoriteIds?.has(member.userId) ?? false)
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="panel p-5 text-sm text-muted-foreground" data-testid="favorited-by-empty">
          Personne ne vous a encore mis en favori.
        </p>
      )}
    </section>
  );
}
