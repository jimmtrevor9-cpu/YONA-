import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { TEXT_SORT_KEYS, nextSort } from "@/components/admin/table-utils";
import { Input } from "@/components/ui/input";
import {
  CSV_MAX_ROWS,
  EVENT_LABELS,
  LOGS,
  adminLogsQuery,
  downloadCsv,
  fetchLogs,
  toCsv,
  type LogFilter,
  type LogRow,
  type LogTable,
} from "@/features/admin/dashboard";
import { formatMoney } from "@/features/admin/queries";
import { reasonLabel } from "@/features/location/labels";

/**
 * Tâche D1 / D2 — Journaux : connexions (réussies et échouées), étapes d'inscription,
 * paiements et notifications Stripe, actions des membres, audit des administrateurs,
 * erreurs du serveur. Lecture seule ; la base n'autorise que les administrateurs.
 */
export function LogsTab() {
  const [table, setTable] = useState<LogTable>("auth_events");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState({
    kind: "",
    from: "",
    to: "",
    sort: "created_at",
    desc: true,
    page: 0,
  });
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const def = LOGS.find((l) => l.table === table) ?? LOGS[0]!;
  const f: LogFilter = { table, search: debounced, pageSize: 25, ...filter };
  const { data, isFetching, error } = useQuery(adminLogsQuery(f));
  const [exporting, setExporting] = useState(false);

  const columns: Column<LogRow>[] = def.columns.map((c) => ({
    ...c,
    ...(c.key === "event" || c.key === "step" || c.key === "source" || c.key === "retained_source"
      ? { render: (r: LogRow) => EVENT_LABELS[String(r[c.key])] ?? String(r[c.key]) }
      : c.key === "inconsistency"
        ? {
            render: (r: LogRow) =>
              Array.isArray(r["inconsistency"]) && r["inconsistency"].length
                ? (r["inconsistency"] as string[]).map(reasonLabel).join(" · ")
                : "—",
          }
        : c.key === "amount"
          ? {
              render: (r: LogRow) =>
                typeof r["amount"] === "number"
                  ? formatMoney(r["amount"], String(r["currency"] ?? "EUR"))
                  : "—",
              className: "text-right",
            }
          : {}),
  }));

  async function exportCsv() {
    setExporting(true);
    try {
      const { rows } = await fetchLogs(f, CSV_MAX_ROWS, 0);
      downloadCsv(
        `yona-${def.table}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv([{ key: "id", label: "N°" }, ...def.columns], rows),
      );
      if (rows.length >= CSV_MAX_ROWS)
        toast.message(`Export limité aux ${CSV_MAX_ROWS} premières lignes : affinez les filtres.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="admin-logs">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Journal affiché">
        {LOGS.map((l) => (
          <button
            key={l.table}
            type="button"
            aria-pressed={table === l.table}
            onClick={() => {
              setTable(l.table);
              setSearch("");
              setFilter({
                kind: "",
                from: filter.from,
                to: filter.to,
                sort: "created_at",
                desc: true,
                page: 0,
              });
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
            data-testid={`admin-log-${l.table}`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <Input
          placeholder="Rechercher"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilter((x) => ({ ...x, page: 0 }));
          }}
          aria-label="Rechercher dans le journal"
          data-testid="admin-log-search"
        />
        {def.kinds.length ? (
          <select
            className="h-10 rounded-md border border-border bg-background px-3 text-sm"
            value={filter.kind}
            onChange={(e) => setFilter((x) => ({ ...x, kind: e.target.value, page: 0 }))}
            aria-label="Type d'événement"
            data-testid="admin-log-kind"
          >
            <option value="">Tous les types</option>
            {def.kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="hidden sm:block" />
        )}
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <label className="space-y-0.5 text-[11px] text-muted-foreground">
            <span className="sm:sr-only">Du</span>
            <Input
              type="date"
              value={filter.from}
              onChange={(e) => setFilter((x) => ({ ...x, from: e.target.value, page: 0 }))}
              aria-label="Depuis le"
              className="sm:w-40"
            />
          </label>
          <label className="space-y-0.5 text-[11px] text-muted-foreground">
            <span className="sm:sr-only">Au</span>
            <Input
              type="date"
              value={filter.to}
              onChange={(e) => setFilter((x) => ({ ...x, to: e.target.value, page: 0 }))}
              aria-label="Jusqu'au"
              className="sm:w-40"
            />
          </label>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      <DataTable
        testId="admin-log-table"
        columns={columns}
        rows={data?.rows ?? []}
        rowKey={(r) => String(r.id)}
        sort={filter.sort}
        desc={filter.desc}
        onSort={(key) =>
          setFilter((x) => ({ ...x, ...nextSort(x, key, !TEXT_SORT_KEYS.includes(key)), page: 0 }))
        }
        page={filter.page}
        pageSize={25}
        total={data?.total ?? 0}
        onPage={(page) => setFilter((x) => ({ ...x, page }))}
        onExport={() => void exportCsv()}
        exporting={exporting}
        loading={isFetching}
        empty="Rien dans ce journal pour ces filtres."
        rowTestId="admin-log-row"
      />
      <p className="text-[11px] text-muted-foreground">
        Les adresses IP et appareils sont effacés automatiquement après 12 mois (RGPD). Le contenu
        des messages n'est jamais copié dans le journal.
      </p>
    </div>
  );
}
