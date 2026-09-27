import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { favoritesCountLabel, unavailableFavoritesLabel } from "@/features/favorites/labels";
import { myFavoriteIdsQuery, myFavoritesQuery } from "@/features/favorites/queries";
import { useFavoriteToggle } from "@/features/favorites/useFavoriteToggle";
import { computeAge } from "@/features/profiles/queries";
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

const addedOn = new Intl.DateTimeFormat("fr-FR", {
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
                  {favorites.map((item) => {
                    const age = computeAge(item.birthDate);
                    const place = [item.city, item.country].filter(Boolean).join(", ");
                    const name = item.firstName ?? "Membre";
                    return (
                      <li
                        key={item.userId}
                        className="panel gold-thread flex items-center gap-4 p-4"
                        data-testid="favorite-item"
                      >
                        <Avatar className="size-14 ring-1 ring-gold/20">
                          {item.photoUrl ? (
                            <AvatarImage
                              src={item.photoUrl}
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
                            {age ? (
                              <span className="text-muted-foreground"> · {age} ans</span>
                            ) : null}
                          </h2>
                          {place ? (
                            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              {place}
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Ajouté le {addedOn.format(new Date(item.favoritedAt))}
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
                          </p>
                        </div>
                        <FavoriteButton
                          name={name}
                          isFavorite={favoriteIds?.has(item.userId) ?? true}
                          isPending={favorite.pendingId === item.userId}
                          onToggle={() =>
                            favorite.toggle(item.userId, favoriteIds?.has(item.userId) ?? true)
                          }
                        />
                      </li>
                    );
                  })}
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
      </main>
      <BottomNav />
    </div>
  );
}
