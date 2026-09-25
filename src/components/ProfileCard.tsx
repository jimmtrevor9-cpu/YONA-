import { Heart, LoaderCircle, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { computeAge } from "@/features/profiles/queries";

export interface ProfileCardData {
  user_id: string;
  first_name: string | null;
  birth_date: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  interests: string[];
}

interface ProfileCardProps {
  profile: ProfileCardData;
  isLiked?: boolean;
  isLikePending?: boolean;
  isLikeStateLoading?: boolean;
  onLike?: (profileId: string) => void;
}

/** Carte éditoriale d'un profil avec son action Like. */
export function ProfileCard({
  profile,
  isLiked,
  isLikePending,
  isLikeStateLoading,
  onLike,
}: ProfileCardProps) {
  const age = computeAge(profile.birth_date);
  const place = [profile.city, profile.country].filter(Boolean).join(", ");

  return (
    <article className="panel gold-thread animate-rise p-5">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {profile.first_name ?? "Profil"}
          {age ? <span className="text-muted-foreground"> · {age} ans</span> : null}
        </h3>
      </header>

      {place ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden />
          {place}
        </p>
      ) : null}

      {profile.bio ? (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{profile.bio}</p>
      ) : null}

      {profile.interests?.length ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {profile.interests.slice(0, 4).map((interest) => (
            <li key={interest} className="panel-2 px-2.5 py-1 text-[11px] text-muted-foreground">
              {interest}
            </li>
          ))}
        </ul>
      ) : null}

      {onLike ? (
        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <Button
            type="button"
            variant={isLiked ? "gold-outline" : "gold"}
            size="sm"
            disabled={isLiked || isLikePending || isLikeStateLoading}
            aria-label={
              isLiked
                ? `Profil de ${profile.first_name ?? "cette personne"} aimé`
                : `Liker le profil de ${profile.first_name ?? "cette personne"}`
            }
            aria-pressed={isLiked}
            onClick={() => onLike(profile.user_id)}
          >
            {isLikePending ? (
              <LoaderCircle className="animate-spin" aria-hidden />
            ) : (
              <Heart className={isLiked ? "fill-current" : undefined} aria-hidden />
            )}
            {isLikePending ? "Envoi…" : isLiked ? "Aimé" : "Like"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
