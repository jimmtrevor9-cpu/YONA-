import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crown, SearchX } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";

import { BottomNav } from "@/components/BottomNav";
import { ContactRequestDialog } from "@/components/ContactRequestButton";
import { DiscoverActions } from "@/components/discover/DiscoverActions";
import { DiscoverCard } from "@/components/discover/DiscoverCard";
import { ProfileDetailsSheet } from "@/components/discover/ProfileDetailsSheet";
import { MatchDialog } from "@/components/MatchDialog";
import { NotificationBell } from "@/components/NotificationBell";
import { WelcomeSequence } from "@/components/signup/WelcomeSequence";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCompatibilityScores } from "@/features/compatibility/queries";
import { contactRequestQuotaQuery } from "@/features/contacts/requests";
import { myFavoriteIdsQuery } from "@/features/favorites/queries";
import { useFavoriteToggle } from "@/features/favorites/useFavoriteToggle";
import { myPremiumQuery, usePremiumBadges } from "@/features/premium/queries";
import { DEMO_LABEL } from "@/features/profiles/demo";
import {
  discoverFeedQuery,
  discoveryCriteriaCountQuery,
  undoLastPass,
  type DiscoverProfile,
} from "@/features/profiles/discovery";
import { likeProfile, passProfile } from "@/features/profiles/likes.functions";
import {
  isProfileUnavailableError,
  likeErrorMessage,
  passErrorMessage,
  sentLikesQuery,
} from "@/features/profiles/likes";
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

/** Distance de glissement qui vaut un choix (px). */
const SWIPE_X = 110;
const SWIPE_UP = 90;

function DiscoverPage() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sendLike = useServerFn(likeProfile);
  const sendPass = useServerFn(passProfile);
  const { data: favoriteIds } = useQuery({ ...myFavoriteIdsQuery(userId), enabled: !!userId });
  const favorite = useFavoriteToggle(userId);

  // Seul un membre au profil finalisé et non suspendu peut parcourir les profils
  // (règle appliquée par le serveur ; ici, uniquement pour afficher le bon message).
  const { data: me, isLoading: isMeLoading } = useQuery({
    ...myProfileQuery(userId),
    enabled: !!userId,
  });
  const myState = me ? profileVisibilityState(me) : null;
  const canBrowse = myState !== null && myState !== "incomplete" && myState !== "suspended";
  const { data, isLoading, isError } = useQuery({
    ...discoverFeedQuery(userId),
    enabled: !!userId && canBrowse,
  });
  const { data: sentLikes = [] } = useQuery({ ...sentLikesQuery(userId), enabled: !!userId });
  const { data: premium } = useQuery({ ...myPremiumQuery(userId), enabled: !!userId });
  const viewerPremium = premium?.premium === true;
  const { data: criteriaCount = 0 } = useQuery({
    ...discoveryCriteriaCountQuery(userId),
    enabled: !!userId,
  });
  const { data: contactQuota } = useQuery({
    ...contactRequestQuotaQuery(userId),
    enabled: !!userId && canBrowse,
  });
  const messageLocked =
    !!contactQuota && !contactQuota.unlimited && (contactQuota.remaining ?? 0) <= 0;

  // Profils déjà traités pendant cette visite (aimés ou passés) : retirés de la pile tout
  // de suite, puis enregistrés côté serveur (remis en place si l'enregistrement échoue).
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const [newMatchName, setNewMatchName] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [contact, setContact] = useState<{ profile: DiscoverProfile; flash: boolean } | null>(null);

  const profiles = (data ?? [])
    .filter((p) => !doneIds.includes(p.user_id))
    .sort((a, b) => Number(b.user_id === restoredId) - Number(a.user_id === restoredId));
  const top = profiles[0] ?? null;
  const next = profiles[1] ?? null;
  const { data: premiumIds } = usePremiumBadges(profiles.slice(0, 5).map((p) => p.user_id));
  const { data: scores } = useCompatibilityScores(profiles.slice(0, 5).map((p) => p.user_id));

  const restore = (profileId: string) =>
    setDoneIds((current) => current.filter((id) => id !== profileId));

  const likeMutation = useMutation({
    mutationFn: (receiverId: string) => sendLike({ data: { receiverId } }),
    onSuccess: (result) => {
      queryClient.setQueryData<string[]>(["likes", "sent", userId], (current = []) =>
        current.includes(result.receiverId) ? current : [...current, result.receiverId],
      );
      const profile = data?.find((p) => p.user_id === result.receiverId);
      // Like réciproque tout juste enregistré : le Match est annoncé à la place du message.
      if (result.mutual && result.matchId && !result.alreadyLiked) {
        setNewMatchName(profile?.first_name ?? "cette personne");
        void queryClient.invalidateQueries({ queryKey: ["matches"] });
        void queryClient.invalidateQueries({ queryKey: ["conversations"] });
        return;
      }
      toast.success(
        profile?.is_virtual
          ? `Like enregistré. ${DEMO_LABEL} : il ne répondra pas.`
          : result.alreadyLiked
            ? "Vous aimez déjà ce profil."
            : "Like envoyé.",
      );
    },
    onError: (error, receiverId) => {
      toast.error(likeErrorMessage(error));
      if (isProfileUnavailableError(error)) {
        void queryClient.invalidateQueries({ queryKey: ["profiles", "discover-feed"] });
      } else {
        restore(receiverId);
      }
    },
  });
  const passMutation = useMutation({
    mutationFn: (receiverId: string) => sendPass({ data: { receiverId } }),
    onError: (error, receiverId) => {
      toast.error(passErrorMessage(error));
      if (isProfileUnavailableError(error)) {
        void queryClient.invalidateQueries({ queryKey: ["profiles", "discover-feed"] });
      } else {
        restore(receiverId);
        void queryClient.invalidateQueries({ queryKey: ["likes", "sent"] });
      }
    },
  });
  const undoMutation = useMutation({
    mutationFn: undoLastPass,
    onSuccess: async (profileId) => {
      setRestoredId(profileId);
      restore(profileId);
      await queryClient.invalidateQueries({ queryKey: ["profiles", "discover-feed"] });
      toast.success("Profil précédent retrouvé.");
    },
    onError: (error) => {
      if (error.message === "premium_required") {
        premiumOnly("Revenir au profil précédent");
        return;
      }
      toast.error(error.message);
    },
  });

  const premiumOnly = (feature: string) =>
    toast(`${feature} : réservé aux membres Premium.`, {
      action: { label: "Voir Premium", onClick: () => void navigate({ to: "/premium" }) },
    });

  const handleLike = (profile: DiscoverProfile) => {
    if (likeMutation.isPending) return;
    setDoneIds((current) => [...current, profile.user_id]);
    if (sentLikes.includes(profile.user_id)) return;
    likeMutation.mutate(profile.user_id);
  };
  const handlePass = (profile: DiscoverProfile) => {
    if (likeMutation.isPending && likeMutation.variables === profile.user_id) return;
    setDoneIds((current) => [...current, profile.user_id]);
    passMutation.mutate(profile.user_id);
  };
  const handleUndo = () => {
    if (!viewerPremium) {
      premiumOnly("Revenir au profil précédent");
      return;
    }
    undoMutation.mutate();
  };
  const handleContact = (profile: DiscoverProfile, flash: boolean) => {
    if (profile.is_virtual) {
      toast.info(`${DEMO_LABEL} : il ne peut pas recevoir de message.`);
      return;
    }
    if (flash && !viewerPremium) {
      premiumOnly("Message Flash");
      return;
    }
    setContact({ profile, flash });
  };

  // Glissement de la carte du dessus : droite = J'aime, gauche = Passer, haut = profil.
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    origin.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!origin.current) return;
    setDrag({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y, active: true });
  };
  const onPointerUp = () => {
    if (!origin.current || !top) return;
    origin.current = null;
    const { x, y } = drag;
    setDrag({ x: 0, y: 0, active: false });
    if (x > SWIPE_X) handleLike(top);
    else if (x < -SWIPE_X) handlePass(top);
    else if (y < -SWIPE_UP && Math.abs(x) < 60) setDetailsOpen(true);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-24">
      <header className="mx-auto flex w-full max-w-[440px] items-center justify-between px-4 pb-1 pt-3">
        <p className="font-display text-xl font-semibold tracking-wide text-gold">{APP_NAME}</p>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <Button asChild variant="ghost" size="icon" className="size-9">
            <Link to="/roi-salomon" aria-label="Roi Salomon, votre conseiller" title="Roi Salomon">
              <Crown className="size-5 text-gold" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>
      {me?.onboarding_completed_at ? (
        <WelcomeSequence userId={userId} firstName={me.first_name ?? ""} />
      ) : null}

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-3">
        <h1 className="sr-only">Découvrir</h1>
        <div className="relative h-[calc(100dvh-9.75rem)] max-h-[880px] min-h-[500px] w-full">
          {isMeLoading || (canBrowse && isLoading) ? (
            <Skeleton className="size-full rounded-[2rem]" />
          ) : myState === "suspended" ? (
            <Notice testId="discover-ineligible">
              Votre profil est suspendu par la modération : la découverte n'est pas disponible.
            </Notice>
          ) : !canBrowse ? (
            <Notice testId="discover-ineligible">
              Finalisez votre profil pour découvrir les autres membres.
              <Button asChild size="sm" variant="secondary" className="mt-4">
                <Link to="/onboarding">Continuer</Link>
              </Button>
            </Notice>
          ) : isError ? (
            <Notice>Les profils n'ont pas pu être chargés. Réessayez dans un instant.</Notice>
          ) : top ? (
            <>
              {next ? (
                <div className="absolute inset-0 scale-[0.95] opacity-70" aria-hidden inert>
                  <DiscoverCard
                    profile={next}
                    isPremium={false}
                    compatibility={null}
                    isFavorite={false}
                    isFavoritePending={false}
                    onToggleFavorite={() => undefined}
                    filterCount={criteriaCount}
                    onOpenDetails={() => undefined}
                    actions={null}
                  />
                </div>
              ) : null}
              <div
                key={top.user_id}
                className="absolute inset-0 animate-rise touch-none"
                style={{
                  transform: `translate(${drag.x}px, ${Math.min(drag.y, 0) / 3}px) rotate(${drag.x / 22}deg)`,
                  transition: drag.active ? "none" : "transform 250ms var(--ease-obsidian)",
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                <DiscoverCard
                  profile={top}
                  isPremium={premiumIds?.has(top.user_id) ?? false}
                  compatibility={scores?.get(top.user_id) ?? null}
                  isFavorite={favoriteIds?.has(top.user_id) ?? false}
                  isFavoritePending={favorite.pendingId === top.user_id}
                  onToggleFavorite={() =>
                    favorite.toggle(top.user_id, favoriteIds?.has(top.user_id) ?? false)
                  }
                  filterCount={criteriaCount}
                  onOpenDetails={() => setDetailsOpen(true)}
                  dragX={drag.x}
                  actions={
                    <DiscoverActions
                      name={top.first_name ?? "ce profil"}
                      viewerPremium={viewerPremium}
                      isLiked={sentLikes.includes(top.user_id)}
                      isLikePending={
                        likeMutation.isPending && likeMutation.variables === top.user_id
                      }
                      disabled={undoMutation.isPending}
                      isDemo={top.is_virtual}
                      messageLocked={messageLocked}
                      onUndo={handleUndo}
                      onPass={() => handlePass(top)}
                      onLike={() => handleLike(top)}
                      onFlash={() => handleContact(top, true)}
                      onMessage={() => handleContact(top, false)}
                    />
                  }
                />
              </div>
            </>
          ) : (
            <Notice>
              <SearchX className="mx-auto mb-3 size-10 text-gold" aria-hidden />
              Vous avez vu tous les profils qui correspondent à vos critères pour le moment. Les
              nouveaux profils apparaîtront ici automatiquement.
              <span className="mt-4 flex flex-wrap justify-center gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to="/search">Modifier mes critères</Link>
                </Button>
                {viewerPremium ? (
                  <Button size="sm" variant="ghost" onClick={handleUndo}>
                    Revenir au profil précédent
                  </Button>
                ) : null}
              </span>
            </Notice>
          )}
        </div>
      </main>

      <ProfileDetailsSheet
        profile={top}
        viewerId={userId}
        isPremium={top ? (premiumIds?.has(top.user_id) ?? false) : false}
        open={detailsOpen && !!top}
        onOpenChange={setDetailsOpen}
      />
      {contact ? (
        <ContactRequestDialog
          receiverId={contact.profile.user_id}
          receiverName={contact.profile.first_name ?? "ce membre"}
          open
          initialFlash={contact.flash}
          onOpenChange={(open) => (!open ? setContact(null) : undefined)}
        />
      ) : null}
      <MatchDialog firstName={newMatchName} onClose={() => setNewMatchName(null)} />
      <BottomNav />
    </div>
  );
}

function Notice({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div
      className="panel gold-thread flex size-full flex-col items-center justify-center rounded-[2rem] p-8 text-center text-sm text-muted-foreground"
      data-testid={testId}
    >
      {children}
    </div>
  );
}
