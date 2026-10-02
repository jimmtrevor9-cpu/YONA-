import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { adminErrorMessage } from "@/features/admin/admin.functions";

/** Toutes les lectures admin passent par des fonctions qui revérifient le rôle en base. */
async function run<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(adminErrorMessage(error.message));
  return data;
}

export interface AdminStats {
  users_total: number;
  users_active: number;
  users_suspended: number;
  users_banned: number;
  users_new_7d: number;
  profiles_complete: number;
  premium_active: number;
  matches_total: number;
  messages_7d: number;
  reports_open: number;
  photos_pending: number;
  tickets_open: number;
  revenue_cents: number;
  revenue_30d_cents: number;
  unlocks_active: number;
}

export const adminStatsQuery = () =>
  queryOptions({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await run(supabase.rpc("admin_stats"))) as unknown as AdminStats,
  });

export const adminUsersQuery = (search: string, status: string) =>
  queryOptions({
    queryKey: ["admin", "users", search, status],
    queryFn: async () =>
      (await run(
        supabase.rpc("admin_list_users", {
          ...(search.trim() ? { _search: search.trim() } : {}),
          ...(status ? { _status: status } : {}),
        }),
      )) ?? [],
  });

export interface AdminUserDetail {
  user: { id: string; email: string | null; status: string; created_at: string };
  profile: { first_name?: string | null; city?: string | null; country?: string | null } | null;
  is_admin: boolean;
  premium: boolean;
  last_seen_at: string | null;
  counts: Record<string, number>;
  photos: { id: string; storage_path: string; status: string; is_primary: boolean }[];
  payments: {
    id: string;
    type: string;
    amount: number;
    currency: string;
    status: string;
    created_at: string;
  }[];
  reports: {
    id: string;
    reason: string;
    description: string | null;
    status: string;
    created_at: string;
  }[];
  moderation: {
    action: string;
    reason: string | null;
    admin_email: string | null;
    created_at: string;
  }[];
}

export const adminUserDetailQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "user", userId],
    queryFn: async () =>
      (await run(
        supabase.rpc("admin_user_detail", { _user_id: userId }),
      )) as unknown as AdminUserDetail,
  });

export const adminReportsQuery = (status: string) =>
  queryOptions({
    queryKey: ["admin", "reports", status],
    queryFn: async () =>
      (await run(supabase.rpc("admin_list_reports", status ? { _status: status } : {}))) ?? [],
  });

export const adminPhotosQuery = () =>
  queryOptions({
    queryKey: ["admin", "photos"],
    queryFn: async () => {
      const rows = (await run(supabase.rpc("admin_list_pending_photos"))) ?? [];
      if (!rows.length) return [];
      const { data: signed } = await supabase.storage.from("photos").createSignedUrls(
        rows.map((r) => r.storage_path),
        60 * 10,
      );
      return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? null }));
    },
  });

/** Vérifications de profil en attente (photos privées : liens temporaires de 10 minutes). */
export const adminVerificationsQuery = () =>
  queryOptions({
    queryKey: ["admin", "verifications"],
    queryFn: async () => {
      const rows = (await run(supabase.rpc("admin_list_pending_verifications"))) ?? [];
      if (!rows.length) return [];
      const { data: signed } = await supabase.storage.from("verifications").createSignedUrls(
        rows.map((r) => r.storage_path),
        60 * 10,
      );
      return rows.map((r, i) => ({ ...r, url: signed?.[i]?.signedUrl ?? null }));
    },
  });

/** Décision sur une vérification, puis suppression de la photo (gardée le temps de l'examen). */
export async function reviewVerification(verificationId: string, approve: boolean) {
  const path = await run(
    supabase.rpc("admin_review_verification", {
      _verification_id: verificationId,
      _approve: approve,
    }),
  );
  if (path) await supabase.storage.from("verifications").remove([path]);
}

export const adminPaymentsQuery = () =>
  queryOptions({
    queryKey: ["admin", "payments"],
    queryFn: async () => (await run(supabase.rpc("admin_list_payments"))) ?? [],
  });

export const adminSubscriptionsQuery = () =>
  queryOptions({
    queryKey: ["admin", "subscriptions"],
    queryFn: async () => (await run(supabase.rpc("admin_list_subscriptions"))) ?? [],
  });

export const adminUnlocksQuery = () =>
  queryOptions({
    queryKey: ["admin", "unlocks"],
    queryFn: async () => (await run(supabase.rpc("admin_list_unlocks"))) ?? [],
  });

export const adminTicketsQuery = () =>
  queryOptions({
    queryKey: ["admin", "tickets"],
    queryFn: async () => (await run(supabase.rpc("admin_list_support_tickets"))) ?? [],
  });

export async function resolveReport(
  reportId: string,
  status: "resolved" | "dismissed" | "reviewing",
  note?: string,
) {
  await run(
    supabase.rpc("admin_resolve_report", {
      _report_id: reportId,
      _status: status,
      ...(note?.trim() ? { _note: note.trim() } : {}),
    }),
  );
}

export async function moderatePhoto(photoId: string, approve: boolean, reason?: string) {
  await run(
    supabase.rpc("admin_moderate_photo", {
      _photo_id: photoId,
      _approve: approve,
      ...(reason?.trim() ? { _reason: reason.trim() } : {}),
    }),
  );
}

export async function replyTicket(ticketId: string, reply: string, close: boolean) {
  await run(
    supabase.rpc("admin_reply_support_ticket", {
      _ticket_id: ticketId,
      _reply: reply,
      _close: close,
    }),
  );
}

/** Montant en centimes → « 12,99 € ». */
export function formatMoney(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
