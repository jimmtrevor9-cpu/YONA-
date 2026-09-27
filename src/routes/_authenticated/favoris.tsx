import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { favoritesCountLabel } from "@/features/favorites/labels";
import { myFavoriteIdsQuery } from "@/features/favorites/queries";
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

/** Page Favoris de la personne connectée. */
function FavoritesPage() {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    ...myFavoriteIdsQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const count = data?.size ?? 0;

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
        ) : count > 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="favorites-count">
            {favoritesCountLabel(count)}
          </p>
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
