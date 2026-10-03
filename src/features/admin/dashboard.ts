import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { adminErrorMessage } from "@/features/admin/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/**
 * Tâche D2 — Données du tableau de bord de l'administration. Tout est calculé en base
 * (`admin_dashboard`, `admin_members`, `admin_user_history`) par des fonctions qui
 * revérifient le rôle administrateur ; les profils de démonstration ne sont jamais comptés.
 */

export type PeriodKind = "day" | "week" | "month" | "year" | "custom";
export type Bucket = "hour" | "day" | "week" | "month" | "year";

export const PERIODS: { value: PeriodKind; label: string; hint: string }[] = [
  { value: "day", label: "Jour", hint: "24 dernières heures" },
  { value: "week", label: "Semaine", hint: "7 derniers jours" },
  { value: "month", label: "Mois", hint: "30 derniers jours" },
  { value: "year", label: "Année", hint: "12 derniers mois" },
  { value: "custom", label: "Personnalisée", hint: "Dates au choix" },
];

export interface PeriodRange {
  from: string;
  to: string;
  bucket: Bucket;
}

const DAY = 24 * 3600 * 1000;

/** Début du jour local d'une date « AAAA-MM-JJ ». */
function localDay(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * Période glissante (jour = 24 h, semaine = 7 j, mois = 30 j, année = 12 mois) ou dates
 * choisies (du premier jour 0 h au dernier jour 24 h). La période précédente, de même durée,
 * est calculée en base pour la comparaison.
 */
export function periodRange(
  kind: PeriodKind,
  custom: { from: string; to: string } | null,
  now: Date = new Date(),
): PeriodRange | null {
  // Arrondi à la minute : la même période garde la même clé de cache.
  const end = new Date(Math.ceil(now.getTime() / 60000) * 60000);
  switch (kind) {
    case "day":
      return {
        from: new Date(end.getTime() - DAY).toISOString(),
        to: end.toISOString(),
        bucket: "hour",
      };
    case "week":
      return {
        from: new Date(end.getTime() - 7 * DAY).toISOString(),
        to: end.toISOString(),
        bucket: "day",
      };
    case "month":
      return {
        from: new Date(end.getTime() - 30 * DAY).toISOString(),
        to: end.toISOString(),
        bucket: "day",
      };
    case "year": {
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      return { from: start.toISOString(), to: end.toISOString(), bucket: "month" };
    }
    case "custom": {
      if (!custom?.from || !custom.to) return null;
      const from = localDay(custom.from);
      const to = localDay(custom.to);
      to.setDate(to.getDate() + 1);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) return null;
      const days = (to.getTime() - from.getTime()) / DAY;
      const bucket: Bucket =
        days <= 2 ? "hour" : days <= 92 ? "day" : days <= 731 ? "week" : "month";
      return { from: from.toISOString(), to: to.toISOString(), bucket };
    }
  }
}

export interface Kpis {
  logins: number;
  failed_logins: number;
  signups: number;
  active_users: number;
  profiles_completed: number;
  verifications_requested: number;
  verifications_approved: number;
  verifications_rejected: number;
  payment_attempts: number;
  payments_succeeded: number;
  payments_failed: number;
  payments_cancelled: number;
  revenue_cents: number;
  likes: number;
  matches: number;
  messages: number;
  contact_requests: number;
  reports: number;
  blocks: number;
  accounts_deleted: number;
}

export interface SeriesPoint {
  /** Début de la tranche, à l'heure locale de l'administrateur (« 2026-10-03T00:00:00 »). */
  start: string;
  logins: number;
  signups: number;
  active_users: number;
  revenue_cents: number;
  payment_attempts: number;
  payments_succeeded: number;
  matches: number;
  messages: number;
  reports: number;
}

export interface NamedCount {
  name: string;
  n: number;
}

export interface DashboardData {
  period: {
    from: string;
    to: string;
    previous_from: string;
    previous_to: string;
    bucket: Bucket;
    timezone: string;
  };
  current: Kpis;
  previous: Kpis;
  snapshot: {
    members: number;
    members_active: number;
    members_suspended: number;
    members_banned: number;
    profiles_complete: number;
    verified: number;
    verifications_pending: number;
    premium: number;
    free: number;
    dau: number;
    wau: number;
    mau: number;
    demo_visible: number;
    demo_total: number;
    demo_initial: number;
    reports_open: number;
    by_gender: Record<string, number>;
    by_age: { band: string; n: number }[];
    by_country: NamedCount[];
    by_city: NamedCount[];
  };
  series: SeriesPoint[];
  funnel: { step: string; n: number }[];
  abandoned_signups: number;
  revenue_by_product: { product: string; cents: number; n: number }[];
  logins_by_country: NamedCount[];
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const adminDashboardQuery = (range: PeriodRange | null) =>
  queryOptions({
    queryKey: ["admin", "dashboard", range?.from, range?.to, range?.bucket],
    enabled: !!range,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!range) return null;
      const { data, error } = await supabase.rpc("admin_dashboard", {
        _from: range.from,
        _to: range.to,
        _bucket: range.bucket,
        _tz: browserTimeZone(),
      });
      if (error) throw new Error(dashboardError(error.message));
      return data as unknown as DashboardData;
    },
  });

function dashboardError(message: string): string {
  if (message.includes("invalid_period")) return "La date de fin doit être après la date de début.";
  if (message.includes("period_too_long")) return "Choisissez une période de 5 ans au plus.";
  return adminErrorMessage(message);
}

/** Nom lisible d'un produit payant. */
export function productLabel(product: string): string {
  switch (product) {
    case "premium_monthly":
      return "Premium mensuel";
    case "premium":
      return "Premium";
    case "premium_yearly":
      return "Premium annuel";
    case "conversation_unlock":
      return "Déblocage de conversation";
    default:
      return product;
  }
}

// ------------------------------------------------------------
// Membres
// ------------------------------------------------------------
export type AdminMember = Database["public"]["Functions"]["admin_members"]["Returns"][number];
export type MemberSort =
  | "created_at"
  | "last_login_at"
  | "first_name"
  | "email"
  | "country"
  | "city"
  | "birth_date"
  | "login_count"
  | "reports_received";

export interface MembersFilter {
  search: string;
  status: string;
  kind: "real" | "demo" | "all";
  sort: MemberSort;
  desc: boolean;
  page: number;
  pageSize: number;
}

export async function fetchMembers(
  f: MembersFilter,
  limit = f.pageSize,
  offset = f.page * f.pageSize,
) {
  const { data, error } = await supabase.rpc("admin_members", {
    ...(f.search.trim() ? { _search: f.search.trim() } : {}),
    ...(f.status ? { _status: f.status } : {}),
    _kind: f.kind,
    _sort: f.sort,
    _desc: f.desc,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw new Error(adminErrorMessage(error.message));
  return data ?? [];
}

export const adminMembersQuery = (f: MembersFilter) =>
  queryOptions({
    queryKey: ["admin", "members", f],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await fetchMembers(f);
      return { rows, total: Number(rows[0]?.total_count ?? 0) };
    },
  });

// ------------------------------------------------------------
// Historique d'un membre
// ------------------------------------------------------------
export interface UserHistory {
  connections: {
    id: number;
    event: string;
    method: string | null;
    ip: string | null;
    country: string | null;
    city: string | null;
    user_agent: string | null;
    timezone: string | null;
    created_at: string;
  }[];
  signup: { step: string; at: string }[];
  payments: {
    id: number;
    event: string;
    product: string | null;
    amount: number | null;
    currency: string | null;
    reason: string | null;
    created_at: string;
  }[];
  activity_counts: Record<string, number>;
  activity: { id: number; event: string; country: string | null; created_at: string }[];
  verifications: {
    id: string;
    method: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
    storage_path: string | null;
  }[];
  audit: {
    action: string;
    table: string;
    changes: Record<string, unknown> | null;
    at: string;
    admin: string | null;
  }[];
}

export const adminUserHistoryQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "history", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_history", { _user_id: userId });
      if (error) throw new Error(adminErrorMessage(error.message));
      return data as unknown as UserHistory;
    },
  });

/** Lien temporaire (10 minutes) vers une photo de vérification encore conservée. */
export async function verificationUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("verifications").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

// ------------------------------------------------------------
// Journaux (lecture réservée à l'administration par les règles d'accès de la base)
// ------------------------------------------------------------
export type LogTable =
  | "auth_events"
  | "signup_events"
  | "payment_events"
  | "activity_events"
  | "admin_audit_log"
  | "server_errors"
  | "ad_events";

export interface LogColumn {
  key: string;
  label: string;
  sortable?: boolean;
}

export interface LogDefinition {
  table: LogTable;
  label: string;
  /** Colonne filtrée par la liste « type ». */
  kindColumn: string;
  kinds: { value: string; label: string }[];
  /** Colonnes cherchées par la zone de recherche. */
  searchColumns: string[];
  columns: LogColumn[];
}

export const EVENT_LABELS: Record<string, string> = {
  signup: "Inscription",
  login: "Connexion",
  login_failed: "Connexion échouée",
  logout: "Déconnexion",
  password_reset_requested: "Mot de passe oublié",
  password_changed: "Mot de passe changé",
  account_created: "Compte créé",
  step_1: "Étape 1",
  step_2: "Étape 2",
  step_3: "Étape 3",
  step_4: "Étape 4",
  profile_completed: "Profil terminé",
  verification_requested: "Vérification demandée",
  verification_approved: "Vérification acceptée",
  verification_rejected: "Vérification refusée",
  created: "Paiement lancé",
  pending: "En attente",
  succeeded: "Réussi",
  failed: "Échoué",
  cancelled: "Annulé",
  refunded: "Remboursé",
  abandoned: "Abandonné",
  webhook: "Notification Stripe",
  like: "J'aime",
  pass: "Passer",
  match: "Match",
  message: "Message",
  voice_message: "Message vocal",
  block: "Blocage",
  report: "Signalement",
  contact_request: "Demande de contact",
  flash_message: "Message Flash",
  favorite: "Favori",
  visit: "Visite de profil",
  account_suspended: "Compte suspendu",
  account_banned: "Compte banni",
  account_reactivated: "Compte réactivé",
  account_deleted: "Compte supprimé",
  delete_account: "Suppression par l'admin",
  view: "Vue",
  click: "Clic",
  skip: "Passer",
};

const kinds = (...values: string[]) =>
  values.map((v) => ({ value: v, label: EVENT_LABELS[v] ?? v }));

export const LOGS: LogDefinition[] = [
  {
    table: "auth_events",
    label: "Connexions",
    kindColumn: "event",
    kinds: kinds(
      "login",
      "login_failed",
      "signup",
      "logout",
      "password_reset_requested",
      "password_changed",
    ),
    searchColumns: ["email", "ip", "country", "city"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "event", label: "Événement", sortable: true },
      { key: "email", label: "E-mail", sortable: true },
      { key: "method", label: "Méthode" },
      { key: "ip", label: "IP" },
      { key: "country", label: "Pays", sortable: true },
      { key: "city", label: "Ville" },
      { key: "user_agent", label: "Appareil" },
      { key: "timezone", label: "Fuseau" },
    ],
  },
  {
    table: "signup_events",
    label: "Inscriptions",
    kindColumn: "step",
    kinds: kinds(
      "account_created",
      "step_1",
      "step_2",
      "step_3",
      "step_4",
      "profile_completed",
      "verification_requested",
      "verification_approved",
      "verification_rejected",
    ),
    searchColumns: ["country"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "step", label: "Étape", sortable: true },
      { key: "method", label: "Méthode" },
      { key: "country", label: "Pays", sortable: true },
      { key: "user_id", label: "Membre" },
    ],
  },
  {
    table: "payment_events",
    label: "Paiements",
    kindColumn: "event",
    kinds: kinds("created", "succeeded", "failed", "cancelled", "refunded", "abandoned", "webhook"),
    searchColumns: ["product", "provider_ref", "reason", "country"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "event", label: "Événement", sortable: true },
      { key: "product", label: "Produit", sortable: true },
      { key: "amount", label: "Montant", sortable: true },
      { key: "currency", label: "Devise" },
      { key: "provider", label: "Prestataire" },
      { key: "provider_ref", label: "Référence" },
      { key: "reason", label: "Raison" },
      { key: "country", label: "Pays" },
      { key: "user_id", label: "Membre" },
    ],
  },
  {
    table: "activity_events",
    label: "Actions",
    kindColumn: "event",
    kinds: kinds(
      "like",
      "pass",
      "match",
      "message",
      "voice_message",
      "contact_request",
      "flash_message",
      "favorite",
      "visit",
      "block",
      "report",
      "account_suspended",
      "account_banned",
      "account_reactivated",
      "account_deleted",
    ),
    searchColumns: ["country", "ip"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "event", label: "Action", sortable: true },
      { key: "user_id", label: "Membre" },
      { key: "target_user_id", label: "Cible" },
      { key: "country", label: "Pays", sortable: true },
      { key: "ip", label: "IP" },
    ],
  },
  {
    table: "ad_events",
    label: "Publicités",
    kindColumn: "event",
    kinds: [
      { value: "view", label: "Vue" },
      { value: "click", label: "Clic" },
      { value: "skip", label: "Passer" },
    ],
    searchColumns: ["country", "placement"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "event", label: "Événement", sortable: true },
      { key: "ad_id", label: "Publicité" },
      { key: "placement", label: "Emplacement", sortable: true },
      { key: "country", label: "Pays", sortable: true },
      { key: "user_id", label: "Membre" },
    ],
  },
  {
    table: "admin_audit_log",
    label: "Audit admin",
    kindColumn: "action",
    kinds: [],
    searchColumns: ["action", "target_table", "target_id"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "action", label: "Action", sortable: true },
      { key: "target_table", label: "Table", sortable: true },
      { key: "target_id", label: "Cible" },
      { key: "admin_id", label: "Administrateur" },
      { key: "changes", label: "Détail" },
      { key: "ip", label: "IP" },
    ],
  },
  {
    table: "server_errors",
    label: "Erreurs serveur",
    kindColumn: "source",
    kinds: [],
    searchColumns: ["source", "message", "path"],
    columns: [
      { key: "created_at", label: "Date", sortable: true },
      { key: "source", label: "Source", sortable: true },
      { key: "message", label: "Message" },
      { key: "path", label: "Adresse" },
      { key: "user_id", label: "Membre" },
      { key: "details", label: "Détail" },
    ],
  },
];

export interface LogFilter {
  table: LogTable;
  search: string;
  kind: string;
  from: string;
  to: string;
  sort: string;
  desc: boolean;
  page: number;
  pageSize: number;
}

export type LogRow = Record<string, unknown> & { id: number };

/** Caractères acceptés dans une recherche (évite de casser le filtre « or » de l'API). */
function cleanSearch(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}@._:\- ]/gu, "")
    .trim()
    .slice(0, 80);
}

export async function fetchLogs(f: LogFilter, limit = f.pageSize, offset = f.page * f.pageSize) {
  const def = LOGS.find((l) => l.table === f.table) ?? LOGS[0]!;
  let q = supabase.from(def.table).select("*", { count: "exact" });
  if (f.kind) q = q.eq(def.kindColumn, f.kind);
  const search = cleanSearch(f.search);
  if (search) q = q.or(def.searchColumns.map((c) => `${c}.ilike.*${search}*`).join(","));
  if (f.from) q = q.gte("created_at", localDay(f.from).toISOString());
  if (f.to) {
    const end = localDay(f.to);
    end.setDate(end.getDate() + 1);
    q = q.lt("created_at", end.toISOString());
  }
  const sort = def.columns.some((c) => c.key === f.sort && c.sortable) ? f.sort : "created_at";
  q = q.order(sort, { ascending: !f.desc, nullsFirst: false }).order("id", { ascending: !f.desc });
  const { data, error, count } = await q.range(offset, offset + limit - 1);
  if (error) throw new Error(adminErrorMessage(error.message));
  return { rows: (data ?? []) as unknown as LogRow[], total: count ?? 0 };
}

export const adminLogsQuery = (f: LogFilter) =>
  queryOptions({
    queryKey: ["admin", "logs", f],
    placeholderData: keepPreviousData,
    queryFn: () => fetchLogs(f),
  });

// ------------------------------------------------------------
// Export CSV (ouvert directement par Excel / LibreOffice en français)
// ------------------------------------------------------------
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  // Une cellule qui commence par = + - @ serait exécutée comme une formule par le tableur.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  columns: { key: string; label: string }[],
  rows: Record<string, unknown>[],
): string {
  const lines = [columns.map((c) => csvCell(c.label)).join(";")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c.key])).join(";"));
  // Marque UTF-8 en tête : Excel affiche correctement les accents.
  return `${String.fromCharCode(0xfeff)}${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nombre maximal de lignes dans un export (au-delà, affiner les filtres). */
export const CSV_MAX_ROWS = 5000;
