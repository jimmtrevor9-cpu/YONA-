import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearMyLocation,
  locationErrorMessage,
  myLocationQuery,
  LOCATION_SOURCE_LABEL,
} from "@/features/profiles/location";
import { useShareDeviceLocation } from "@/features/location/useDeviceLocation";

const savedOn = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Position utilisée par la recherche par distance (profil de la personne connectée). */
export function MyLocationPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { queryKey } = myLocationQuery(userId);
  const { data: location, isLoading } = useQuery({ ...myLocationQuery(userId), enabled: !!userId });

  const shareLocation = useShareDeviceLocation();
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const save = useMutation({
    // « Mettre à jour » : nouvelle mesure, jamais une position gardée par le navigateur.
    mutationFn: () => shareLocation(true),
    onSuccess: () => {
      toast.success("Position enregistrée.");
      void refresh();
    },
    onError: (error) => toast.error(locationErrorMessage(error)),
  });
  const clear = useMutation({
    mutationFn: clearMyLocation,
    onSuccess: () => {
      toast.success("Position retirée.");
      void refresh();
    },
    onError: () => toast.error("La position n'a pas pu être retirée. Réessayez."),
  });
  const pending = save.isPending || clear.isPending;

  return (
    <section className="panel-2 space-y-3 p-4" data-testid="my-location">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 size-4 shrink-0 text-gold-soft" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Ma position</p>
          <p className="text-xs text-muted-foreground" data-testid="my-location-status">
            {isLoading
              ? "…"
              : location
                ? `${location.city ? `${location.city}${location.country ? `, ${location.country}` : ""} — ` : ""}${LOCATION_SOURCE_LABEL[location.source]}, enregistrée le ${savedOn.format(new Date(location.updatedAt))}.`
                : "Aucune position enregistrée."}{" "}
            Pour vous montrer des personnes près de chez vous : la position de votre appareil est la
            plus fiable (un VPN ne la change pas). Elle est arrondie à environ 1 km et n'est jamais
            montrée aux autres membres.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => save.mutate()}
        >
          {save.isPending
            ? "Localisation…"
            : location
              ? "Mettre à jour ma position"
              : "Utiliser ma position actuelle"}
        </Button>
        {location ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => clear.mutate()}
          >
            Retirer ma position
          </Button>
        ) : null}
      </div>
    </section>
  );
}
