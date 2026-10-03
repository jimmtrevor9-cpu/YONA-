import { queryOptions } from "@tanstack/react-query";

import { primaryPhotoUrls } from "@/features/profiles/primary-photos";
import { supabase } from "@/integrations/supabase/client";

/** Message facultatif d'une demande de contact (limite vérifiée aussi par le serveur). */
export const CONTACT_MESSAGE_MAX_LENGTH = 300;

/** Demandes de contact par jour pour un membre gratuit (vérifié par le serveur). */
export const FREE_CONTACT_REQUESTS_PER_DAY = 5;

export const CONTACT_REQUEST_ERRORS = {
  profile_unavailable: "Ce profil n'est plus disponible.",
  self_request: "Vous ne pouvez pas vous envoyer une demande de contact.",
  already_matched: "Vous avez déjà un Match avec ce membre : écrivez-lui dans vos messages.",
  message_too_long: `Le message est limité à ${CONTACT_MESSAGE_MAX_LENGTH} caractères.`,
  phone_number_detected:
    "Pour votre sécurité, les numéros de téléphone ne sont pas autorisés dans les demandes de contact.",
  daily_limit_reached: `Vous avez utilisé vos ${FREE_CONTACT_REQUESTS_PER_DAY} demandes de contact gratuites aujourd'hui. Revenez demain, ou passez Premium pour des demandes illimitées.`,
  recently_declined:
    "Ce membre a refusé votre demande récemment. Vous pourrez lui écrire à nouveau dans 30 jours.",
  request_not_found: "Cette demande n'existe plus.",
  request_not_pending: "Cette demande a déjà reçu une réponse.",
  flash_premium_required: "Le Message Flash est réservé aux membres Premium.",
  flash_message_required: "Écrivez un message pour envoyer un Flash.",
  identity_not_verified:
    "Vérifiez votre identité (selfie ou pièce d'identité) pour envoyer une demande de contact.",
} as const;

export type SendContactRequestResult = { id: string; status: "sent" | "already_pending" };

/** Envoie une demande de contact (contrôles complets côté serveur). */
export async function sendContactRequest(
  receiverId: string,
  message: string,
  flash = false,
): Promise<SendContactRequestResult> {
  const text = message.trim();
  const { data, error } = await supabase.rpc("send_contact_request", {
    _receiver_id: receiverId,
    ...(text ? { _message: text } : {}),
    // 17.2 : Message Flash (Premium, message obligatoire — vérifié par le serveur).
    ...(flash ? { _flash: true } : {}),
  });
  if (error) throw error;
  return data as SendContactRequestResult;
}

/** Code d'erreur connu contenu dans une erreur du serveur. */
function errorCode(error: unknown): keyof typeof CONTACT_REQUEST_ERRORS | null {
  const message = error instanceof Object && "message" in error ? String(error.message) : "";
  const code = (Object.keys(CONTACT_REQUEST_ERRORS) as (keyof typeof CONTACT_REQUEST_ERRORS)[])
    // Les codes les plus longs d'abord (« flash_premium_required » avant « premium »…).
    .sort((a, b) => b.length - a.length)
    .find((key) => message.includes(key));
  return code ?? null;
}

/** Message à afficher pour un refus du serveur. */
export function contactRequestErrorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code) return CONTACT_REQUEST_ERRORS[code];
  return "La demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.";
}

/** Refus pour numéro de téléphone (le message reste affiché sous le champ). */
export function isContactPhoneError(error: unknown): boolean {
  return errorCode(error) === "phone_number_detected";
}

/** Refus parce que le quota du jour est atteint. */
export function isDailyLimitError(error: unknown): boolean {
  return errorCode(error) === "daily_limit_reached";
}

// ---------------------------------------------------------------------------
// Quota journalier (étapes 12.3 à 12.5)
// ---------------------------------------------------------------------------

export interface ContactRequestQuota {
  used: number;
  /** `null` pour Premium (illimité). */
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  /** Heure de remise à zéro du quota (minuit UTC). */
  resetsAt: string;
}

/** Quota de demandes de contact du jour, calculé par le serveur. */
export const contactRequestQuotaQuery = (userId: string) =>
  queryOptions({
    queryKey: ["contact-requests", "quota", userId],
    queryFn: async (): Promise<ContactRequestQuota> => {
      const { data, error } = await supabase.rpc("get_contact_request_quota");
      if (error) throw error;
      const q = data as {
        used: number;
        limit: number | null;
        remaining: number | null;
        unlimited: boolean;
        resets_at: string;
      };
      return {
        used: q.used,
        limit: q.limit,
        remaining: q.remaining,
        unlimited: q.unlimited,
        resetsAt: q.resets_at,
      };
    },
    staleTime: 15 * 1000,
  });

/** Texte du quota restant (« Il vous reste 3 demandes aujourd'hui »). */
export function contactQuotaLabel(quota: ContactRequestQuota): string {
  if (quota.unlimited) return "Premium : demandes de contact illimitées";
  const remaining = quota.remaining ?? 0;
  if (remaining === 0) return "Plus aucune demande gratuite aujourd'hui";
  return remaining === 1
    ? "Il vous reste 1 demande de contact aujourd'hui"
    : `Il vous reste ${remaining} demandes de contact aujourd'hui`;
}

// ---------------------------------------------------------------------------
// Demandes reçues / envoyées et réponses (étape 12.2)
// ---------------------------------------------------------------------------

export type ContactRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface ContactRequestItem {
  id: string;
  otherUserId: string;
  firstName: string | null;
  birthDate: string | null;
  city: string | null;
  country: string | null;
  message: string | null;
  status: ContactRequestStatus;
  /** Message Flash (Premium) mis en avant. */
  isFlash: boolean;
  createdAt: string;
  respondedAt: string | null;
  photoUrl: string | null;
}

export type ContactRequestDirection = "received" | "sent";

/** Demandes reçues ou envoyées (les demandes en attente d'abord). */
export const contactRequestsQuery = (userId: string, direction: ContactRequestDirection) =>
  queryOptions({
    queryKey: ["contact-requests", direction, userId],
    queryFn: async (): Promise<ContactRequestItem[]> => {
      const { data, error } = await supabase.rpc("list_contact_requests", {
        _direction: direction,
      });
      if (error) throw error;
      const rows = data ?? [];
      const urls = await primaryPhotoUrls(rows.map((r) => r.other_user_id));
      return rows.map((r) => ({
        id: r.id,
        otherUserId: r.other_user_id,
        firstName: r.first_name,
        birthDate: r.birth_date,
        city: r.city,
        country: r.country,
        message: r.message,
        status: r.status as ContactRequestStatus,
        isFlash: r.is_flash === true,
        createdAt: r.created_at,
        respondedAt: r.responded_at,
        photoUrl: urls.get(r.other_user_id) ?? null,
      }));
    },
    staleTime: 15 * 1000,
  });

export type RespondResult =
  { status: "declined" } | { status: "accepted"; match_id: string; conversation_id: string | null };

/** Accepte (Match et conversation créés) ou refuse une demande reçue. */
export async function respondContactRequest(
  requestId: string,
  accept: boolean,
): Promise<RespondResult> {
  const { data, error } = await supabase.rpc("respond_contact_request", {
    _request_id: requestId,
    _accept: accept,
  });
  if (error) throw error;
  return data as RespondResult;
}

/** Annule une demande envoyée encore en attente. */
export async function cancelContactRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_contact_request", { _request_id: requestId });
  if (error) throw error;
}

/** Libellés des statuts d'une demande. */
export const CONTACT_STATUS_LABELS: Record<ContactRequestStatus, string> = {
  pending: "En attente",
  accepted: "Acceptée",
  declined: "Refusée",
  cancelled: "Annulée",
};
