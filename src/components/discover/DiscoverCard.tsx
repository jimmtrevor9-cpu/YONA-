import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  HeartHandshake,
  ChevronUp,
  Crown,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { FavoriteButton } from "@/components/FavoriteButton";
import { DEMO_LABEL } from "@/features/profiles/demo";
import type { DiscoverProfile } from "@/features/profiles/discovery";
import { computeAge } from "@/features/profiles/queries";
import { cn } from "@/lib/utils";

interface DiscoverCardProps {
  profile: DiscoverProfile;
  isPremium: boolean;
  compatibility: number | null;
  isFavorite: boolean;
  isFavoritePending: boolean;
  onToggleFavorite: () => void;
  /** Nombre de critères de recherche actifs (pastille du bouton « filtres »). */
  filterCount: number;
  onOpenDetails: () => void;
  /** Glissement en cours (px) : affiche « J'aime » / « Passer ». */
  dragX?: number;
  /** Boutons d'action, posés en bas de la carte comme sur le modèle. */
  actions: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const chip =
  "inline-flex max-w-full items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-white shadow-sm backdrop-blur-md";

/** Carte plein écran d'un profil (structure du modèle fourni, couleurs YONA). */
export function DiscoverCard({
  profile,
  isPremium,
  compatibility,
  isFavorite,
  isFavoritePending,
  onToggleFavorite,
  filterCount,
  onOpenDetails,
  dragX = 0,
  actions,
  style,
  className,
}: DiscoverCardProps) {
  const age = computeAge(profile.birth_date);
  const name = profile.first_name ?? "Profil";
  const place = profile.city ?? profile.country;

  return (
    <article
      className={cn(
        "relative h-full w-full select-none overflow-hidden rounded-[2rem] border-2 border-primary/60 bg-surface-2 shadow-[0_24px_60px_-24px_oklch(0.3_0.05_340/55%)]",
        className,
      )}
      style={style}
      aria-label={`Profil de ${name}${age ? `, ${age} ans` : ""}`}
      data-testid="discover-card"
      data-virtual={profile.is_virtual ? "true" : "false"}
    >
      {profile.photoUrl ? (
        <img
          src={profile.photoUrl}
          alt={`Photo de ${name}`}
          className="pointer-events-none absolute inset-0 size-full object-cover"
          draggable={false}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/80 via-gold-soft to-gold font-display text-[7rem] font-semibold text-white/90"
          aria-hidden
        >
          {name.charAt(0)}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      {/* Étiquettes du haut : nom et âge, lieu, objectif, démonstration */}
      <div className="absolute left-3 right-20 top-3 flex flex-col items-start gap-2">
        <h2 className={cn(chip, "py-2 pl-2 pr-4")}>
          {profile.is_verified ? (
            <BadgeCheck
              className="size-7 shrink-0 fill-success text-white"
              aria-label="Identité vérifiée"
            />
          ) : null}
          <span className="truncate font-display text-2xl font-semibold leading-none">{name}</span>
          {age ? (
            <span className="text-2xl font-light leading-none text-white/85">{age}</span>
          ) : null}
          {isPremium ? (
            <Crown className="size-5 shrink-0 text-gold-soft" aria-label="Membre Premium" />
          ) : null}
        </h2>
        {place ? (
          <p className={cn(chip, "text-[15px]")} data-testid="discover-place">
            <MapPin className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{place}</span>
            {profile.distance_km !== null ? (
              <span className="shrink-0 text-white/75">· à {profile.distance_km} km</span>
            ) : null}
          </p>
        ) : null}
        {profile.relationship_goal ? (
          <p className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-gold px-3 py-1.5 text-[15px] font-semibold text-primary-foreground shadow-sm">
            <Users className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{profile.relationship_goal}</span>
          </p>
        ) : null}
        {profile.is_virtual ? (
          <p
            className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-gold shadow-sm"
            data-testid="demo-label"
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            {DEMO_LABEL}
          </p>
        ) : null}
        {compatibility !== null ? (
          <p className={cn(chip, "text-xs font-semibold")} data-testid="discover-compatibility">
            <HeartHandshake className="size-4 shrink-0" aria-hidden />
            {compatibility} % compatible
          </p>
        ) : null}
      </div>

      {/* En haut à droite : critères de recherche, favori */}
      <div className="absolute right-3 top-3 flex flex-col items-center gap-2">
        <Link
          to="/search"
          className="relative flex size-14 items-center justify-center rounded-full border border-white/60 bg-black/40 text-white backdrop-blur-md"
          aria-label={`Critères de recherche (${filterCount} actifs)`}
        >
          <SlidersHorizontal className="size-6" aria-hidden />
          {filterCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground ring-2 ring-white">
              {filterCount}
            </span>
          ) : null}
        </Link>
        <FavoriteButton
          name={name}
          isFavorite={isFavorite}
          isPending={isFavoritePending}
          onToggle={onToggleFavorite}
          className="size-11 bg-black/40 text-white backdrop-blur-md hover:bg-black/55 [&_svg]:size-5"
        />
      </div>

      {/* Tampons pendant le glissement */}
      {dragX > 40 ? (
        <span
          className="absolute left-6 top-1/3 -rotate-12 rounded-xl border-4 border-success px-3 py-1 font-display text-3xl font-bold text-success"
          style={{ opacity: Math.min(1, (dragX - 40) / 80) }}
          aria-hidden
        >
          J'AIME
        </span>
      ) : null}
      {dragX < -40 ? (
        <span
          className="absolute right-6 top-1/3 rotate-12 rounded-xl border-4 border-destructive px-3 py-1 font-display text-3xl font-bold text-destructive"
          style={{ opacity: Math.min(1, (-dragX - 40) / 80) }}
          aria-hidden
        >
          PASSER
        </span>
      ) : null}

      {/* Bas de carte : voir le profil, puis les actions */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-3 pb-4">
        <button
          type="button"
          onClick={onOpenDetails}
          className="flex flex-col items-center gap-1 text-white"
          data-testid="discover-open-details"
        >
          <ChevronUp className="size-7 animate-bounce" aria-hidden />
          <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold backdrop-blur-md">
            Glisse vers le haut pour voir le profil
          </span>
        </button>
        {actions}
      </div>
    </article>
  );
}
