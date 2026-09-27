import { LoaderCircle, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  name: string;
  isFavorite: boolean;
  isPending?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  className?: string;
}

/** Bouton étoile « Ajouter aux favoris » / « Retirer des favoris ». */
export function FavoriteButton({
  name,
  isFavorite,
  isPending = false,
  disabled = false,
  onToggle,
  className,
}: FavoriteButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9 shrink-0 rounded-full", className)}
      disabled={disabled || isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Retirer ${name} des favoris` : `Ajouter ${name} aux favoris`}
      title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      data-testid="favorite-button"
      onClick={onToggle}
    >
      {isPending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        <Star
          className={cn("size-4", isFavorite ? "fill-gold text-gold" : "text-muted-foreground")}
          aria-hidden
        />
      )}
    </Button>
  );
}
