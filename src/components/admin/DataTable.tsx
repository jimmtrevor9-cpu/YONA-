import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { ReactNode } from "react";

import { cellText } from "@/components/admin/table-utils";
import { Button } from "@/components/ui/button";

/**
 * Tableau de l'administration : en-têtes cliquables pour trier, pages, export CSV.
 * Sur téléphone, le tableau défile dans son cadre (la page ne déborde jamais).
 */
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  sort,
  desc,
  onSort,
  page,
  pageSize,
  total,
  onPage,
  onRowClick,
  onExport,
  exporting,
  loading,
  empty = "Aucune ligne.",
  rowTestId,
  testId,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort: string;
  desc: boolean;
  onSort: (key: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onRowClick?: (row: T) => void;
  onExport?: () => void;
  exporting?: boolean;
  loading?: boolean;
  empty?: string;
  rowTestId?: string;
  testId?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total ? page * pageSize + 1 : 0;
  const last = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border bg-card">
        <table className={`w-full min-w-[640px] text-left text-xs ${loading ? "opacity-60" : ""}`}>
          <thead className="bg-foreground/[0.03] text-muted-foreground">
            <tr>
              {columns.map((c) => {
                const active = sort === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={`whitespace-nowrap px-3 py-2 font-medium ${c.className ?? ""}`}
                    aria-sort={active ? (desc ? "descending" : "ascending") : undefined}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {c.label}
                        {active ? (
                          desc ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ArrowUp className="size-3" aria-hidden />
                          )
                        ) : null}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-t border-border ${onRowClick ? "cursor-pointer hover:bg-foreground/5" : ""}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                data-testid={rowTestId}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`max-w-[260px] truncate px-3 py-2 text-foreground ${c.className ?? ""}`}
                  >
                    {c.render ? c.render(row) : cellText(row[c.key])}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && !loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {first}–{last} sur {total.toLocaleString("fr-FR")}
        </span>
        <div className="flex items-center gap-1">
          {onExport ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onExport}
              disabled={exporting || !total}
            >
              <Download aria-hidden /> CSV
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onPage(page - 1)}
            disabled={page <= 0}
            aria-label="Page précédente"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <span className="tabular-nums">
            {page + 1} / {pages}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onPage(page + 1)}
            disabled={page + 1 >= pages}
            aria-label="Page suivante"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
