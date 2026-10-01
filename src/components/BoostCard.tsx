import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { activateBoost, myBoostQuery } from "@/features/premium/boost";

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Carte « Boost de profil » (profil) : activer le boost hebdomadaire inclus dans Premium. */
export function BoostCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { data } = useQuery(myBoostQuery(userId));
  const boost = useMutation({
    mutationFn: activateBoost,
    onSuccess: () => {
      toast.success("Profil boosté : vous apparaissez en tête pendant 1 heure.");
      void queryClient.invalidateQueries({ queryKey: ["premium", "boost"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });
  if (!data) return null;
  const active = !!data.activeUntil && new Date(data.activeUntil).getTime() > Date.now();

  return (
    <section className="panel-2 flex items-start gap-3 p-4" data-testid="boost-card">
      <Rocket className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-foreground">Boost de profil</p>
        {!data.premium ? (
          <p className="text-xs text-muted-foreground">
            Apparaissez en tête pendant 1 heure, une fois par semaine.{" "}
            <Link to="/premium" className="text-gold underline-offset-2 hover:underline">
              Inclus avec Premium
            </Link>
          </p>
        ) : active ? (
          <p className="text-xs text-gold-soft" data-testid="boost-active" role="status">
            Boost actif jusqu'à {TIME.format(new Date(data.activeUntil ?? ""))} : votre profil est
            en tête.
          </p>
        ) : data.nextAvailableAt ? (
          <p className="text-xs text-muted-foreground" data-testid="boost-cooldown">
            Prochain boost disponible le {DAY.format(new Date(data.nextAvailableAt))} à{" "}
            {TIME.format(new Date(data.nextAvailableAt))}.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              1 heure en tête de Découvrir et de la Recherche. Un boost par semaine.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={boost.isPending}
              onClick={() => boost.mutate()}
              data-testid="boost-activate"
            >
              {boost.isPending ? "Activation…" : "Booster mon profil"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
