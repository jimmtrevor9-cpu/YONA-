import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { BarList, Funnel, SplitBar, TrendChart } from "@/components/admin/charts";
import {
  CHART_ROSE,
  CHART_VIOLET,
  bucketLabel,
  formatNumber,
} from "@/components/admin/chart-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PERIODS,
  adminDashboardQuery,
  periodRange,
  type DashboardData,
  type Kpis,
  type PeriodKind,
  type SeriesPoint,
  productLabel,
} from "@/features/admin/dashboard";
import { adminStatsQuery, formatMoney } from "@/features/admin/queries";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const fmtDate = (iso: string) => dateFormat.format(new Date(iso));
const money = (cents: number) => formatMoney(cents);

const METRICS: { key: keyof SeriesPoint & keyof Kpis; label: string; money?: boolean }[] = [
  { key: "signups", label: "Inscriptions" },
  { key: "logins", label: "Connexions" },
  { key: "active_users", label: "Membres actifs" },
  { key: "revenue_cents", label: "Revenus", money: true },
  { key: "payments_succeeded", label: "Paiements réussis" },
  { key: "matches", label: "Matchs" },
  { key: "messages", label: "Messages" },
  { key: "reports", label: "Signalements" },
];

const FUNNEL_LABELS: Record<string, string> = {
  account_created: "Compte créé",
  step_1: "Étape 1 : crée ton profil",
  step_2: "Étape 2 : ta bio",
  step_3: "Étape 3 : où es-tu ?",
  step_4: "Étape 4 : reste au courant",
  profile_completed: "Profil terminé",
  verification_requested: "Vérification demandée",
  verification_approved: "Identité vérifiée",
};

const GENDER_LABELS: Record<string, string> = {
  female: "Femmes",
  male: "Hommes",
  unknown: "Non précisé",
};

function todayInput(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tâche D2 — Statistiques de l'application, sur la période choisie, comparées à la précédente. */
export function StatsTab() {
  const [kind, setKind] = useState<PeriodKind>("week");
  const [custom, setCustom] = useState({ from: todayInput(-30), to: todayInput() });
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const range = useMemo(
    () => periodRange(kind, custom, new Date(refreshedAt)),
    [kind, custom, refreshedAt],
  );
  const dashboard = useQuery(adminDashboardQuery(range));
  const todo = useQuery(adminStatsQuery());

  return (
    <div className="space-y-5" data-testid="admin-dashboard">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1"
            role="group"
            aria-label="Période"
          >
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={kind === p.value}
                title={p.hint}
                onClick={() => setKind(p.value)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                data-testid={`admin-period-${p.value}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setRefreshedAt(Date.now());
              void todo.refetch();
            }}
            disabled={dashboard.isFetching}
          >
            <RefreshCw className={dashboard.isFetching ? "animate-spin" : ""} aria-hidden />
            Actualiser
          </Button>
        </div>
        {kind === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Du
              <Input
                type="date"
                value={custom.from}
                max={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="h-9 w-40"
                data-testid="admin-period-from"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Au
              <Input
                type="date"
                value={custom.to}
                min={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="h-9 w-40"
                data-testid="admin-period-to"
              />
            </label>
          </div>
        ) : null}
        {!range ? (
          <p className="text-xs text-destructive">
            Choisissez une date de fin après la date de début.
          </p>
        ) : dashboard.data ? (
          <p className="text-xs text-muted-foreground">
            Du {fmtDate(dashboard.data.period.from)} au {fmtDate(dashboard.data.period.to)} ·
            comparé à la période précédente de même durée (du{" "}
            {fmtDate(dashboard.data.period.previous_from)} au{" "}
            {fmtDate(dashboard.data.period.previous_to)}). Les profils de démonstration ne sont
            jamais comptés.
          </p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow">À traiter</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-stats">
          {(
            [
              ["Signalements ouverts", todo.data?.reports_open],
              ["Photos à valider", todo.data?.photos_pending],
              ["Vérifications en attente", dashboard.data?.snapshot.verifications_pending],
              ["Tickets ouverts", todo.data?.tickets_open],
            ] as const
          ).map(([label, value]) => (
            <li key={label} className="panel p-3">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <p className="font-display text-2xl font-semibold text-foreground">
                {value === undefined ? "…" : formatNumber(value)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {dashboard.error ? (
        <p className="text-sm text-destructive">{dashboard.error.message}</p>
      ) : !dashboard.data ? (
        <Skeleton className="h-96 w-full rounded-2xl" />
      ) : (
        <DashboardBody data={dashboard.data} />
      )}
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (current === previous)
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
        <ArrowRight className="size-3" aria-hidden /> stable
      </span>
    );
  const up = current > previous;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const text =
    previous === 0
      ? "nouveau"
      : `${up ? "+" : "−"}${Math.abs(Math.round(((current - previous) / previous) * 100))} %`;
  return (
    <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
      <Icon className="size-3" aria-hidden />
      {text}
      <span className="sr-only"> par rapport à la période précédente</span>
    </span>
  );
}

function KpiTile({
  label,
  current,
  previous,
  format = formatNumber,
  testId,
}: {
  label: string;
  current: number;
  previous: number;
  format?: (n: number) => string;
  testId?: string;
}) {
  return (
    <li className="panel space-y-0.5 p-3" data-testid={testId}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold text-foreground sm:text-2xl">
        {format(current)}
      </p>
      <div className="flex flex-wrap items-center gap-x-2">
        <Delta current={current} previous={previous} />
        <span className="text-[11px] text-muted-foreground">avant : {format(previous)}</span>
      </div>
    </li>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <li className="panel space-y-0.5 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-semibold text-foreground sm:text-2xl">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </li>
  );
}

function Card({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section className="panel min-w-0 space-y-3 p-4" data-testid={testId}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function DashboardBody({ data }: { data: DashboardData }) {
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("signups");
  const m = METRICS.find((x) => x.key === metric) ?? METRICS[0]!;
  const format = m.money ? money : formatNumber;
  const bucket = data.period.bucket;
  const points = data.series.map((p) => ({
    label: bucketLabel(p.start, bucket),
    long: bucketLabel(p.start, bucket, true),
    value: p[metric],
  }));
  const c = data.current;
  const p = data.previous;
  const s = data.snapshot;
  const ages = s.by_age.map((a) => ({
    name: a.band === "?" ? "Non précisé" : `${a.band} ans`,
    n: a.n,
  }));

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="eyebrow">Sur la période</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-kpis">
          <KpiTile
            label="Inscriptions"
            current={c.signups}
            previous={p.signups}
            testId="kpi-signups"
          />
          <KpiTile label="Connexions" current={c.logins} previous={p.logins} />
          <KpiTile label="Membres actifs" current={c.active_users} previous={p.active_users} />
          <KpiTile
            label="Revenus"
            current={c.revenue_cents}
            previous={p.revenue_cents}
            format={money}
          />
          <KpiTile label="Matchs" current={c.matches} previous={p.matches} />
          <KpiTile label="Messages" current={c.messages} previous={p.messages} />
          <KpiTile
            label="Demandes de contact"
            current={c.contact_requests}
            previous={p.contact_requests}
          />
          <KpiTile label="Signalements" current={c.reports} previous={p.reports} />
        </ul>
      </section>

      <Card title={`${m.label} — évolution`} testId="admin-trend">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Mesure affichée">
          {METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              aria-pressed={metric === x.key}
              onClick={() => setMetric(x.key)}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground"
            >
              {x.label}
            </button>
          ))}
        </div>
        <TrendChart data={points} format={format} label={`${m.label} par période`} />
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Voir les chiffres</summary>
          <div className="mt-2 max-h-60 overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1 pr-2 font-medium">Période</th>
                  <th className="py-1 text-right font-medium">{m.label}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((x) => (
                  <tr key={x.long} className="border-t border-border">
                    <td className="py-1 pr-2">{x.long}</td>
                    <td className="py-1 text-right tabular-nums">{format(x.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <section className="space-y-2">
        <h2 className="eyebrow">Aujourd'hui</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-snapshot">
          <Tile
            label="Vrais membres"
            value={formatNumber(s.members)}
            hint={`${formatNumber(s.members_active)} actifs`}
          />
          <Tile label="Actifs (24 h)" value={formatNumber(s.dau)} hint="DAU" />
          <Tile label="Actifs (7 jours)" value={formatNumber(s.wau)} hint="WAU" />
          <Tile label="Actifs (30 jours)" value={formatNumber(s.mau)} hint="MAU" />
          <Tile
            label="Identité vérifiée"
            value={formatNumber(s.verified)}
            hint={`${formatNumber(s.verifications_pending)} en attente`}
          />
          <Tile label="Profils complets" value={formatNumber(s.profiles_complete)} />
          <Tile
            label="Suspendus / bannis"
            value={`${formatNumber(s.members_suspended)} / ${formatNumber(s.members_banned)}`}
          />
          <Tile
            label="Profils de démo restants"
            value={`${formatNumber(s.demo_visible)} / ${formatNumber(s.demo_initial)}`}
            hint={`${formatNumber(s.demo_total)} en base · visibles s'ils ont une image`}
          />
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Parcours d'inscription (comptes créés sur la période)">
          <Funnel
            steps={data.funnel.map((f) => ({ label: FUNNEL_LABELS[f.step] ?? f.step, n: f.n }))}
          />
          <p className="text-[11px] text-muted-foreground">
            Inscriptions abandonnées (profil non terminé après 24 h) :{" "}
            <strong className="text-foreground">{formatNumber(data.abandoned_signups)}</strong>
          </p>
        </Card>
        <Card title="Vérifications et paiements (période)">
          <ul className="grid gap-x-4 text-xs min-[420px]:grid-cols-2">
            {(
              [
                ["Vérifications demandées", c.verifications_requested],
                ["Acceptées", c.verifications_approved],
                ["Refusées", c.verifications_rejected],
                ["Connexions échouées", c.failed_logins],
                ["Paiements lancés", c.payment_attempts],
                ["Paiements réussis", c.payments_succeeded],
                ["Paiements échoués", c.payments_failed],
                ["Paiements annulés", c.payments_cancelled],
                ["Blocages", c.blocks],
                ["Comptes supprimés", c.accounts_deleted],
              ] as const
            ).map(([label, n]) => (
              <li
                key={label}
                className="flex items-baseline justify-between gap-2 border-b border-border py-1"
              >
                <span className="text-muted-foreground">{label}</span>
                <strong className="tabular-nums text-foreground">{formatNumber(n)}</strong>
              </li>
            ))}
          </ul>
          {data.revenue_by_product.length ? (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Revenus par produit</p>
              <BarList
                items={data.revenue_by_product.map((r) => ({
                  name: productLabel(r.product),
                  n: r.cents,
                }))}
                format={money}
              />
            </div>
          ) : null}
        </Card>
        <Card title="Gratuits et Premium">
          <SplitBar
            testId="admin-premium-split"
            parts={[
              { label: "Gratuits", n: s.free, color: CHART_ROSE },
              { label: "Premium", n: s.premium, color: CHART_VIOLET },
            ]}
          />
        </Card>
        <Card title="Femmes et hommes">
          <SplitBar
            testId="admin-gender-split"
            parts={[
              { label: GENDER_LABELS["female"]!, n: s.by_gender["female"] ?? 0, color: CHART_ROSE },
              { label: GENDER_LABELS["male"]!, n: s.by_gender["male"] ?? 0, color: CHART_VIOLET },
            ]}
          />
          {s.by_gender["unknown"] ? (
            <p className="text-[11px] text-muted-foreground">
              Sexe non encore précisé : {formatNumber(s.by_gender["unknown"])}
            </p>
          ) : null}
        </Card>
        <Card title="Âge des membres">
          <BarList items={ages} />
        </Card>
        <Card title="Pays des membres">
          <BarList items={s.by_country} testId="admin-by-country" />
        </Card>
        <Card title="Villes des membres">
          <BarList items={s.by_city} />
        </Card>
        <Card title="Connexions par pays (période)">
          <BarList
            items={data.logins_by_country.map((x) => ({
              name: countryName(x.name),
              n: x.n,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

/** Code pays envoyé par l'hébergeur (« GA ») → « Gabon ». */
function countryName(code: string): string {
  if (code === "?" || !code) return "Inconnu";
  if (/^[A-Z]{2}$/.test(code)) return regionNames?.of(code) ?? code;
  return code;
}
