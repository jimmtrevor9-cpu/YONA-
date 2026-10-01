import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TicketStatus = "open" | "answered" | "closed";
export type TicketPriority = "normal" | "priority";

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: TicketPriority;
  status: TicketStatus;
  adminReply: string | null;
  createdAt: string;
}

export const SUPPORT_SUBJECT_MAX = 120;
export const SUPPORT_MESSAGE_MAX = 4000;

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "En attente de réponse",
  answered: "Répondu",
  closed: "Fermé",
};

export const SUPPORT_ERRORS = {
  support_invalid_subject: "Le sujet doit contenir entre 3 et 120 caractères.",
  support_invalid_message: "Le message doit contenir entre 10 et 4 000 caractères.",
  support_daily_limit: "Vous avez déjà envoyé 5 demandes aujourd'hui. Réessayez demain.",
} as const;

/** Mes demandes au support (les plus récentes d'abord). */
export const mySupportTicketsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["support", "mine", userId],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id, subject, message, priority, status, admin_reply, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((t) => ({
        id: t.id,
        subject: t.subject,
        message: t.message,
        priority: t.priority as TicketPriority,
        status: t.status as TicketStatus,
        adminReply: t.admin_reply,
        createdAt: t.created_at,
      }));
    },
  });

/** Envoie une demande au support (priorité donnée par le serveur selon Premium). */
export async function createSupportTicket(subject: string, message: string): Promise<string> {
  const { data, error } = await supabase.rpc("create_support_ticket", {
    _subject: subject,
    _message: message,
  });
  if (error) {
    const code = (Object.keys(SUPPORT_ERRORS) as (keyof typeof SUPPORT_ERRORS)[]).find((k) =>
      error.message.includes(k),
    );
    throw new Error(code ? SUPPORT_ERRORS[code] : "La demande n'a pas pu être envoyée. Réessayez.");
  }
  return data as string;
}
