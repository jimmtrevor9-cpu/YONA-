import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdEditor } from "@/components/admin/AdEditor";
import { bucketLabel, formatNumber } from "@/components/admin/chart-utils";
import { BarList, TrendChart } from "@/components/admin/charts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminRunStorageCleanup } from "@/features/admin/admin.functions";
import { PERIODS, periodRange, type PeriodKind } from "@/features/admin/dashboard";
import {
  AD_PLACEMENTS,
  adSettingsQuery,
  adState,
  adStatsQuery,
  adminAdsQuery,
  deleteAd,
  setAdStatus,
  updateAdSettings,
  type AdRow,
} from "@/features/ads/admin-ads";
import { adFileUrl } from "@/features/ads/ads";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const fmt = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "—");
const plural = (n: number, word: string) => `${formatNumber(n)} ${word}${n > 1 ? "s" : ""}`;
const pct = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
const placementLabel = (p: string) =>
  AD_PLACEMENTS.find((x) => x.value === p)?.label.replace(/ \(.*\)/, "") ?? p;

/** Tâche D3 — Publicités : liste, création / modification, pause, suppression, statistiques. */
export function AdsTab() {
  const [editing, setEditing] = useState<AdRow | "new" | null>(null);
  if (editing) {
    return <AdEditor ad={editing === "new" ? null : editing} onDone={() => setEditing(null)} />;
  }
  return <AdsList onEdit={setEditing} />;
}

function AdsList({ onEdit }: { onEdit: (ad: AdRow | "new") => void }) {
  const queryClient = useQueryClient();
  const cleanup = useServerFn(adminRunStorageCleanup);
  const { data: ads, isLoading, error } = useQuery(adminAdsQuery());
  const [kind, setKind] = useState<Exclude<PeriodKind, "custom">>("week");
  const [selected, setSelected] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<AdRow | null>(null);
  const range = useMemo(() => periodRange(kind, null), [kind]);
  const stats = useQuery(adStatsQuery(selected, range));
  const allStats = useQuery(adStatsQuery(null, range));
  const byAd = new Map((allStats.data?.ads ?? []).map((a) => [a.id, a]));

  const status = useMutation({
    mutationFn: (v: { id: string; status: "active" | "paused" }) => setAdStatus(v.id, v.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "ads"] }),
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteAd(id);
      await cleanup().catch(() => undefined);
    },
    onSuccess: async () => {
      setToDelete(null);
      setSelected(null);
      toast.success("Publicité supprimée.");
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const s = stats.data;
  const totals = (s?.ads ?? []).reduce(
    (t, a) => ({ views: t.views + a.views, clicks: t.clicks + a.clicks, skips: t.skips + a.skips }),
    { views: 0, clicks: 0, skips: 0 },
  );
  const ctr = totals.views ? (100 * totals.clicks) / totals.views : 0;
  const selectedAd = ads?.find((a) => a.id === selected) ?? null;

  return (
    <div className="space-y-5" data-testid="admin-ads">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Publicités</h2>
          <p className="text-xs text-muted-foreground">
            Montrées uniquement aux membres gratuits, jamais aux membres Premium.
          </p>
        </div>
        <Button type="button" onClick={() => onEdit("new")} data-testid="ad-new">
          <Plus aria-hidden /> Nouvelle publicité
        </Button>
      </div>

      <AdSettings />

      <section className="panel space-y-4 p-4" data-testid="ad-stats">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Statistiques {selectedAd ? `— ${selectedAd.title}` : "— toutes les publicités"}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {selectedAd ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Toutes
              </Button>
            ) : null}
            <div
              className="flex gap-1 rounded-full border border-border bg-card p-1"
              role="group"
              aria-label="Période"
            >
              {PERIODS.filter((p) => p.value !== "custom").map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={kind === p.value}
                  title={p.hint}
                  onClick={() => setKind(p.value as typeof kind)}
                  className="rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {stats.error ? (
          <p className="text-sm text-destructive">{stats.error.message}</p>
        ) : !s ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["Vues", formatNumber(totals.views)],
                  ["Clics", formatNumber(totals.clicks)],
                  ["Taux de clic", pct(ctr)],
                  ["« Passer »", formatNumber(totals.skips)],
                ] as const
              ).map(([label, value]) => (
                <li key={label} className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p
                    className="font-display text-xl font-semibold text-foreground"
                    data-testid={`ad-kpi-${label}`}
                  >
                    {value}
                  </p>
                </li>
              ))}
            </ul>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-foreground">Vues</p>
                <TrendChart
                  label="Vues des publicités par période"
                  data={s.series.map((p) => ({
                    label: bucketLabel(p.start, s.period.bucket),
                    long: bucketLabel(p.start, s.period.bucket, true),
                    value: p.views,
                  }))}
                />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-foreground">Clics</p>
                <TrendChart
                  label="Clics sur les publicités par période"
                  data={s.series.map((p) => ({
                    label: bucketLabel(p.start, s.period.bucket),
                    long: bucketLabel(p.start, s.period.bucket, true),
                    value: p.clicks,
                  }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Vues par pays</p>
              <BarList
                items={s.by_country.map((c) => ({
                  name: `${c.name} · ${plural(c.clicks, "clic")}, ${pct(c.ctr)}`,
                  n: c.views,
                }))}
                empty="Pas encore de vue sur cette période."
              />
            </div>
          </>
        )}
      </section>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : !ads?.length ? (
        <p className="panel p-6 text-center text-sm text-muted-foreground">
          Aucune publicité pour le moment. Créez la première avec « Nouvelle publicité ».
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2" data-testid="ad-list">
          {ads.map((ad) => {
            const state = adState(ad);
            const st = byAd.get(ad.id);
            const thumb =
              ad.media_type === "image"
                ? adFileUrl(ad.media_path)
                : ad.poster_path
                  ? adFileUrl(ad.poster_path)
                  : null;
            return (
              <li key={ad.id} className="panel flex gap-3 p-3" data-testid="ad-row">
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-black">
                  {thumb ? (
                    <img src={thumb} alt="" className="size-full object-cover" />
                  ) : (
                    <video
                      src={adFileUrl(ad.media_path)}
                      muted
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  )}
                  {ad.media_type === "video" ? (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                      Vidéo
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={state.live ? "gold" : "subtle"}>{state.label}</Badge>
                    {ad.advertiser ? (
                      <span className="truncate text-[11px] uppercase text-muted-foreground">
                        {ad.advertiser}
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{ad.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ad.placements.map(placementLabel).join(", ")} · du {fmt(ad.starts_at)}
                    {ad.ends_at ? ` au ${fmt(ad.ends_at)}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Ciblage :{" "}
                    {ad.target_countries.length ? ad.target_countries.join(", ") : "tous pays"}
                    {ad.target_gender
                      ? ` · ${ad.target_gender === "female" ? "femmes" : "hommes"}`
                      : ""}
                    {ad.min_age || ad.max_age
                      ? ` · ${ad.min_age ?? 18}-${ad.max_age ?? 99} ans`
                      : ""}{" "}
                    · priorité {ad.priority} · {plural(ad.daily_cap, "vue")} par jour max.
                  </p>
                  <p className="text-xs text-foreground">
                    {plural(st?.views ?? 0, "vue")} · {plural(st?.clicks ?? 0, "clic")} ·{" "}
                    {pct(st?.ctr ?? 0)}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => onEdit(ad)}
                    >
                      <Pencil aria-hidden /> Modifier
                    </Button>
                    {ad.status === "active" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={status.isPending}
                        onClick={() => status.mutate({ id: ad.id, status: "paused" })}
                        data-testid="ad-pause"
                      >
                        <Pause aria-hidden /> Pause
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={status.isPending}
                        onClick={() => status.mutate({ id: ad.id, status: "active" })}
                        data-testid="ad-publish"
                      >
                        <Play aria-hidden /> Publier
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setSelected(ad.id)}
                    >
                      Statistiques
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive"
                      onClick={() => setToDelete(ad)}
                      aria-label={`Supprimer ${ad.title}`}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!toDelete}
        onOpenChange={(open) => (!open ? setToDelete(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette publicité ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toDelete?.title} » sera retirée tout de suite, avec son image ou sa vidéo et ses
              statistiques. Pour la retirer seulement un temps, utilisez « Pause ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (toDelete) remove.mutate(toDelete.id);
              }}
              disabled={remove.isPending}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Fréquence d'affichage : une publicité toutes les N cartes / lignes. */
function AdSettings() {
  const queryClient = useQueryClient();
  const { data } = useQuery(adSettingsQuery());
  const [draft, setDraft] = useState<{ discover: string; list: string } | null>(null);
  const values = draft ?? {
    discover: String(data?.discover_every ?? 5),
    list: String(data?.list_every ?? 6),
  };
  const save = useMutation({
    mutationFn: () =>
      updateAdSettings({
        discover_every: Math.min(50, Math.max(2, Number(values.discover) || 5)),
        list_every: Math.min(50, Math.max(2, Number(values.list) || 6)),
      }),
    onSuccess: async () => {
      setDraft(null);
      toast.success("Fréquence enregistrée.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "ad-settings"] });
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <form
      className="panel flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="space-y-1 text-xs text-muted-foreground">
        Découvrir : 1 publicité toutes les
        <span className="flex items-center gap-2">
          <Input
            type="number"
            min={2}
            max={50}
            className="h-9 w-20"
            value={values.discover}
            onChange={(e) => setDraft({ ...values, discover: e.target.value })}
          />
          cartes
        </span>
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        Listes : 1 publicité toutes les
        <span className="flex items-center gap-2">
          <Input
            type="number"
            min={2}
            max={50}
            className="h-9 w-20"
            value={values.list}
            onChange={(e) => setDraft({ ...values, list: e.target.value })}
          />
          lignes
        </span>
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={!draft || save.isPending}>
        Enregistrer
      </Button>
    </form>
  );
}
