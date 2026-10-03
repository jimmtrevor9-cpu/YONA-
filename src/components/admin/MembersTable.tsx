import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/admin/DataTable";
import { TEXT_SORT_KEYS, nextSort } from "@/components/admin/table-utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CSV_MAX_ROWS,
  adminMembersQuery,
  downloadCsv,
  fetchMembers,
  toCsv,
  type AdminMember,
  type MemberSort,
  type MembersFilter,
} from "@/features/admin/dashboard";

const STATUS_LABEL: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  disabled: "Banni",
  deleted: "Supprimé",
};
const GENDER_LABEL: Record<string, string> = { female: "Femme", male: "Homme" };

function age(birth: string | null): string {
  if (!birth) return "—";
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (
    now.getMonth() < b.getMonth() ||
    (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())
  )
    a--;
  return String(a);
}

const COLUMNS: Column<AdminMember & Record<string, unknown>>[] = [
  {
    key: "first_name",
    label: "Prénom",
    sortable: true,
    render: (m) => (
      <span className="font-medium">
        {m.first_name ?? "Sans prénom"}
        {m.premium ? (
          <Badge variant="gold" className="ml-1.5">
            Premium
          </Badge>
        ) : null}
        {m.is_virtual ? (
          <Badge variant="subtle" className="ml-1.5">
            Démo
          </Badge>
        ) : null}
      </span>
    ),
  },
  { key: "email", label: "E-mail", sortable: true },
  {
    key: "gender",
    label: "Sexe",
    render: (m) => (m.gender ? (GENDER_LABEL[m.gender] ?? m.gender) : "—"),
  },
  { key: "birth_date", label: "Âge", sortable: true, render: (m) => age(m.birth_date) },
  { key: "country", label: "Pays", sortable: true },
  { key: "city", label: "Ville", sortable: true },
  {
    key: "status",
    label: "Statut",
    render: (m) => (
      <Badge variant={m.status === "active" ? "subtle" : "gold"}>
        {STATUS_LABEL[m.status] ?? m.status}
      </Badge>
    ),
  },
  { key: "verified", label: "Vérifié", render: (m) => (m.verified ? "oui" : "non") },
  { key: "created_at", label: "Inscrit le", sortable: true },
  { key: "last_login_at", label: "Dernière connexion", sortable: true },
  { key: "login_count", label: "Connexions", sortable: true, className: "text-right" },
  { key: "reports_received", label: "Signalé", sortable: true, className: "text-right" },
];

const CSV_COLUMNS = [
  { key: "user_id", label: "Identifiant" },
  { key: "first_name", label: "Prénom" },
  { key: "email", label: "E-mail" },
  { key: "gender", label: "Sexe" },
  { key: "birth_date", label: "Naissance" },
  { key: "country", label: "Pays" },
  { key: "city", label: "Ville" },
  { key: "status", label: "Statut" },
  { key: "verified", label: "Vérifié" },
  { key: "premium", label: "Premium" },
  { key: "is_virtual", label: "Profil de démo" },
  { key: "created_at", label: "Inscrit le" },
  { key: "last_login_at", label: "Dernière connexion" },
  { key: "login_count", label: "Connexions" },
  { key: "reports_received", label: "Signalements reçus" },
];

/** Tâche D2 — Tableau des membres : recherche, filtres, tri, pages et export CSV. */
export function MembersTable({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<Omit<MembersFilter, "search">>({
    status: "",
    kind: "real",
    sort: "created_at",
    desc: true,
    page: 0,
    pageSize: 25,
  });
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const f: MembersFilter = { ...filter, search: debounced };
  const { data, isFetching, error } = useQuery(adminMembersQuery(f));
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const rows = await fetchMembers(f, CSV_MAX_ROWS, 0);
      downloadCsv(
        `yona-membres-${new Date().toISOString().slice(0, 10)}.csv`,
        toCsv(CSV_COLUMNS, rows as never),
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
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Rechercher un e-mail, un prénom, une ville ou un pays"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilter((x) => ({ ...x, page: 0 }));
          }}
          data-testid="admin-user-search"
        />
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={filter.status}
          onChange={(e) => setFilter((x) => ({ ...x, status: e.target.value, page: 0 }))}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="suspended">Suspendus</option>
          <option value="disabled">Bannis</option>
        </select>
        <select
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
          value={filter.kind}
          onChange={(e) =>
            setFilter((x) => ({ ...x, kind: e.target.value as MembersFilter["kind"], page: 0 }))
          }
          aria-label="Type de compte"
          data-testid="admin-user-kind"
        >
          <option value="real">Vrais membres</option>
          <option value="demo">Profils de démonstration</option>
          <option value="all">Tous les comptes</option>
        </select>
      </div>
      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
      <DataTable
        testId="admin-members-table"
        columns={COLUMNS}
        rows={(data?.rows ?? []) as (AdminMember & Record<string, unknown>)[]}
        rowKey={(m) => m.user_id}
        sort={filter.sort}
        desc={filter.desc}
        onSort={(key) =>
          setFilter((x) => ({
            ...x,
            ...nextSort(x, key, !TEXT_SORT_KEYS.includes(key)),
            sort: key as MemberSort,
            page: 0,
          }))
        }
        page={filter.page}
        pageSize={filter.pageSize}
        total={data?.total ?? 0}
        onPage={(page) => setFilter((x) => ({ ...x, page }))}
        onRowClick={(m) => onSelect(m.user_id)}
        onExport={() => void exportCsv()}
        exporting={exporting}
        loading={isFetching}
        empty="Aucun membre trouvé."
        rowTestId="admin-user-row"
      />
      <p className="text-[11px] text-muted-foreground">
        Les dates sont à l'heure de cet appareil. « — » : non renseigné. Cliquez sur une ligne pour
        ouvrir la fiche du membre.
      </p>
    </div>
  );
}
