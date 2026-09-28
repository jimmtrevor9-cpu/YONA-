import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { FavoriteMemberCard } from "@/components/FavoriteMemberCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { myFavoriteIdsQuery } from "@/features/favorites/queries";
import { useFavoriteToggle } from "@/features/favorites/useFavoriteToggle";
import { visitCountLabel, visitorsCountLabel } from "@/features/visits/labels";
import { profileVisitorsQuery } from "@/features/visits/queries";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/visiteurs")({
  head: () => ({
    meta: [
      { title: `Mes visiteurs — ${APP_NAME}` },
      { name: "description", content: "Découvrez qui a consulté votre profil." },
      { property: "og:title", content: `Mes visiteurs — ${APP_NAME}` },
      { property: "og:description", content: "Découvrez qui a consulté votre profil." },
    ],
  }),
  component: VisitorsPage,
});

const dayFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Page Visiteurs de la personne connectée. */
function VisitorsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { data, isLoading, isError } = useQuery({
    ...profileVisitorsQuery(userId),
    enabled: !!userId,
  });
  const { data: favoriteIds } = useQuery({ ...myFavoriteIdsQuery(userId), enabled: !!userId });
  const favorite = useFavoriteToggle(userId);

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Mes visiteurs" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6" data-testid="visitors-page">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Qui a visité votre profil</p>
          <Link to="/profile" className="text-xs text-muted-foreground hover:text-foreground">
            Retour au profil
          </Link>
        </div>
        <p className="text-xs text-muted-foreground" data-testid="visitors-explanation">
          Une visite est comptée quand un membre ouvre votre profil complet, au plus une fois par
          heure.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Vos visiteurs n'ont pas pu être chargés. Réessayez dans un instant.
          </p>
        ) : data?.premium ? (
          data.visitors.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground" data-testid="visitors-count">
                {visitorsCountLabel(data.visitors.length)}
              </p>
              <ul className="space-y-3" aria-label="Membres qui ont visité votre profil">
                {data.visitors.map((visitor) => (
                  <FavoriteMemberCard
                    key={visitor.userId}
                    testId="visitor-item"
                    firstName={visitor.firstName}
                    birthDate={visitor.birthDate}
                    city={visitor.city}
                    country={visitor.country}
                    photoUrl={visitor.photoUrl}
                    details={
                      <>
                        Dernière visite le {dayFormat.format(new Date(visitor.lastVisitedAt))}
                        {" · "}
                        {visitCountLabel(visitor.visitCount)}
                      </>
                    }
                    isFavorite={favoriteIds?.has(visitor.userId) ?? false}
                    isFavoritePending={favorite.pendingId === visitor.userId}
                    onToggleFavorite={() =>
                      favorite.toggle(visitor.userId, favoriteIds?.has(visitor.userId) ?? false)
                    }
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="panel p-5 text-sm text-muted-foreground" data-testid="visitors-empty">
              Personne n'a encore visité votre profil.
            </p>
          )
        ) : (
          <div className="panel-2 flex items-start gap-3 p-4" data-testid="visitors-locked">
            <Lock className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Réservé aux membres Premium</p>
              <p className="text-xs text-muted-foreground">
                Avec Premium, découvrez qui a visité votre profil. L'abonnement Premium sera bientôt
                disponible.
              </p>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
