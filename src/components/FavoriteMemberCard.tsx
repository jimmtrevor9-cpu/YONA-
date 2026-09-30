import { MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { FavoriteButton } from "@/components/FavoriteButton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { computeAge } from "@/features/profiles/queries";

interface FavoriteMemberCardProps {
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  photoUrl: string | null;
  /** Ligne d'information sous le lieu (date d'ajout, lien…). */
  details: ReactNode;
  isFavorite: boolean;
  isFavoritePending: boolean;
  onToggleFavorite: () => void;
  testId: string;
}

/** Carte d'un membre dans la page Favoris (style des cartes de la page Matchs). */
export function FavoriteMemberCard({
  firstName,
  birthDate,
  city,
  country,
  photoUrl,
  details,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
  testId,
}: FavoriteMemberCardProps) {
  const age = computeAge(birthDate);
  const place = [city, country].filter(Boolean).join(", ");
  const name = firstName ?? "Membre";
  return (
    <li className="panel gold-thread flex items-center gap-4 p-4" data-testid={testId}>
      <Avatar className="size-14 ring-1 ring-gold/20">
        {photoUrl ? (
          <AvatarImage src={photoUrl} alt={`Photo de ${name}`} className="object-cover" />
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
        <p className="mt-1 text-[11px] text-muted-foreground">{details}</p>
      </div>
      <FavoriteButton
        name={name}
        isFavorite={isFavorite}
        isPending={isFavoritePending}
        onToggle={onToggleFavorite}
      />
    </li>
  );
}
