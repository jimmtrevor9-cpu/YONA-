import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { discoverFeedQuery } from "@/features/profiles/discovery";
import { likeProfile } from "@/features/profiles/likes.functions";
import { sentLikesQuery } from "@/features/profiles/likes";
import { myProfileQuery } from "@/features/profiles/queries";
import { profileVisibilityState } from "@/features/profiles/visibility";
import { APP_NAME } from "@/lib/config";

export const Route = createFileRoute("/_authenticated/discover")({
  head: () => ({
    meta: [
      { title: `Découvrir — ${APP_NAME}` },
      { name: "description", content: "Découvrez des profils chrétiens sincères près de vous." },
      { property: "og:title", content: `Découvrir — ${APP_NAME}` },
      {
        property: "og:description",
        content: "Découvrez des profils chrétiens sincères près de vous.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sendLike = useServerFn(likeProfile);
  // Seul un membre au profil finalisé et non suspendu peut parcourir les profils
  // (règle appliquée par le serveur ; ici, uniquement pour afficher le bon message).
  const { data: me, isLoading: isMeLoading } = useQuery({
    ...myProfileQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const myState = me ? profileVisibilityState(me) : null;
  const canBrowse = myState !== null && myState !== "incomplete" && myState !== "suspended";
  const { data, isLoading, isError } = useQuery({
    ...discoverFeedQuery(user?.id ?? ""),
    enabled: !!user?.id && canBrowse,
  });
  const {
    data: sentLikes = [],
    isLoading: isLikeStateLoading,
    isError: isLikeStateError,
  } = useQuery({
    ...sentLikesQuery(user?.id ?? ""),
    enabled: !!user?.id,
  });
  const likeMutation = useMutation({
    mutationFn: (receiverId: string) => sendLike({ data: { receiverId } }),
    onSuccess: (result) => {
      if (!user?.id) return;
      queryClient.setQueryData<string[]>(["likes", "sent", user.id], (current = []) =>
        current.includes(result.receiverId) ? current : [...current, result.receiverId],
      );
      toast.success("Like envoyé.");
    },
    onError: () => {
      toast.error("Le Like n'a pas pu être envoyé. Réessayez dans un instant.");
    },
  });

  const handleLike = (profileId: string) => {
    if (!user?.id || likeMutation.isPending || sentLikes.includes(profileId)) return;
    likeMutation.mutate(profileId);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <AppHeader title="Découvrir" />
      <main className="mx-auto max-w-md space-y-4 px-5 py-6">
        <p className="eyebrow">Sélection du jour</p>

        {isMeLoading || (canBrowse && isLoading) ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : myState === "suspended" ? (
          <div className="panel p-6 text-center" data-testid="discover-ineligible">
            <p className="text-sm text-muted-foreground">
              Votre profil est suspendu par la modération : la découverte n'est pas disponible.
            </p>
          </div>
        ) : !canBrowse ? (
          <div className="panel space-y-4 p-6 text-center" data-testid="discover-ineligible">
            <p className="text-sm text-muted-foreground">
              Finalisez votre profil pour découvrir les autres membres.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/onboarding">Continuer</Link>
            </Button>
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Les profils n'ont pas pu être chargés. Réessayez dans un instant.
          </p>
        ) : data && data.length > 0 ? (
          data.map((profile) => (
            <ProfileCard
              key={profile.user_id}
              profile={profile}
              isLiked={sentLikes.includes(profile.user_id)}
              isLikePending={likeMutation.isPending && likeMutation.variables === profile.user_id}
              isLikeStateLoading={isLikeStateLoading || isLikeStateError}
              onLike={handleLike}
            />
          ))
        ) : (
          <div className="panel p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun profil ne correspond à vos préférences pour le moment. Les nouveaux profils
              apparaîtront ici automatiquement.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
