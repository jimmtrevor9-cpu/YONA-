import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_ROSE, formatNumber } from "@/components/admin/chart-utils";

/**
 * Graphiques du tableau de bord (tâche D2). Une seule couleur par graphique (rose YONA) ;
 * deux catégories côte à côte (femmes / hommes, gratuits / Premium) : rose et violet, une
 * paire vérifiée pour les daltoniens. Les textes restent dans les couleurs du texte.
 */
interface TrendPoint {
  label: string;
  long: string;
  value: number;
}

/** Courbe d'une seule mesure dans le temps, avec repère et info-bulle au survol. */
export function TrendChart({
  data,
  format = formatNumber,
  label,
}: {
  data: TrendPoint[];
  format?: (n: number) => string;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="h-56 w-full sm:h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_ROSE} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART_ROSE} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={18}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => format(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as TrendPoint | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="text-muted-foreground">{p.long}</p>
                  <p className="font-semibold text-foreground">{format(p.value)}</p>
                </div>
              );
            }}
          />
          <Area
            type="linear"
            dataKey="value"
            stroke={CHART_ROSE}
            strokeWidth={2}
            fill={`url(#fill-${id})`}
            dot={false}
            activeDot={{ r: 5, fill: CHART_ROSE, stroke: "var(--card)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Barres horizontales étiquetées (pays, villes, âges…) : lisibles aussi sur téléphone. */
export function BarList({
  items,
  format = formatNumber,
  empty = "Pas encore de données.",
  testId,
}: {
  items: { name: string; n: number }[];
  format?: (n: number) => string;
  empty?: string;
  testId?: string;
}) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = Math.max(...items.map((i) => i.n), 1);
  return (
    <ul className="space-y-2" data-testid={testId}>
      {items.map((item) => (
        <li key={item.name} className="space-y-1" title={`${item.name} : ${format(item.n)}`}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-foreground">{item.name}</span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {format(item.n)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-foreground/5">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max((item.n / max) * 100, item.n ? 2 : 0)}%`,
                background: CHART_ROSE,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Répartition en deux parts (ex. femmes / hommes) : barre unique, légende avec les nombres. */
export function SplitBar({
  parts,
  testId,
}: {
  parts: { label: string; n: number; color: string }[];
  testId?: string;
}) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  const shown = parts.filter((p) => p.n > 0);
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-foreground/5">
        {total
          ? shown.map((p) => (
              <div
                key={p.label}
                className="h-3 first:rounded-l-full last:rounded-r-full"
                style={{ width: `${(p.n / total) * 100}%`, background: p.color }}
                title={`${p.label} : ${formatNumber(p.n)}`}
              />
            ))
          : null}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 text-foreground">
            <span className="size-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
            {p.label} : <strong className="tabular-nums">{formatNumber(p.n)}</strong>
            {total ? (
              <span className="text-muted-foreground">({Math.round((p.n / total) * 100)} %)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Entonnoir : chaque étape en barre, avec le taux par rapport à la première. */
export function Funnel({ steps }: { steps: { label: string; n: number }[] }) {
  const first = steps[0]?.n ?? 0;
  return (
    <ol className="space-y-2" data-testid="admin-funnel">
      {steps.map((s, i) => {
        const pct = first ? Math.round((s.n / first) * 100) : 0;
        return (
          <li key={s.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-foreground">
                {i + 1}. {s.label}
              </span>
              <span className="shrink-0 tabular-nums text-foreground">
                <strong>{formatNumber(s.n)}</strong>
                {i > 0 && first ? <span className="text-muted-foreground"> · {pct} %</span> : null}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-foreground/5">
              <div
                className="h-2.5 rounded-full"
                style={{
                  width: `${first ? Math.max(pct, s.n ? 2 : 0) : 0}%`,
                  background: CHART_ROSE,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
