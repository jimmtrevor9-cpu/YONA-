import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, HeartHandshake, Lock, X } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { COMPATIBILITY_LEVEL_LABELS, compatibilityQuery } from "@/features/compatibility/queries";
import { cn } from "@/lib/utils";

/** Pastille « 87 % compatible » (cartes de profils). */
export function CompatibilityPill({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-gold-soft"
      data-testid="compatibility-pill"
    >
      <HeartHandshake className="size-3" aria-hidden />
      {score} % compatible
    </span>
  );
}

/** Score, explication courte, et détail réservé au Premium (profil d'un membre). */
export function CompatibilityPanel({ userId, otherId }: { userId: string; otherId: string }) {
  const { data, isLoading, isError } = useQuery({
    ...compatibilityQuery(userId, otherId),
    enabled: !!userId && !!otherId,
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (isError || !data) return null;

  return (
    <section className="panel space-y-3 p-5" data-testid="compatibility-panel">
      <div className="flex items-center gap-3">
        <HeartHandshake className="size-5 shrink-0 text-gold" aria-hidden />
        <div className="flex-1">
          <p className="eyebrow">Compatibilité</p>
          {data.score !== null ? (
            <p className="font-display text-2xl font-semibold text-foreground">
              <span data-testid="compatibility-score">{data.score} %</span>
              {data.level ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {COMPATIBILITY_LEVEL_LABELS[data.level]}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-muted-foreground" data-testid="compatibility-summary">
        {data.summary}
      </p>
      {data.details ? (
        <ul className="space-y-2" data-testid="compatibility-details">
          {data.details.map((d) => (
            <li key={d.key} className="flex items-start gap-2 text-xs">
              {d.matched ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden />
              ) : (
                <X className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="flex-1">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="text-muted-foreground"> · {d.note}</span>
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  d.matched ? "text-gold-soft" : "text-muted-foreground",
                )}
              >
                {d.points}/{d.max}
              </span>
            </li>
          ))}
        </ul>
      ) : data.score !== null ? (
        <p
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          data-testid="compatibility-locked"
        >
          <Lock className="size-3 shrink-0 text-gold-soft" aria-hidden />
          Détail critère par critère :{" "}
          <Link to="/premium" className="text-gold underline-offset-2 hover:underline">
            avec Premium
          </Link>
        </p>
      ) : null}
    </section>
  );
}
