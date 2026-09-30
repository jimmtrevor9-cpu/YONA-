import { supabase } from "@/integrations/supabase/client";

/** Message facultatif d'une demande de contact (limite vérifiée aussi par le serveur). */
export const CONTACT_MESSAGE_MAX_LENGTH = 300;

export const CONTACT_REQUEST_ERRORS = {
  profile_unavailable: "Ce profil n'est plus disponible.",
  self_request: "Vous ne pouvez pas vous envoyer une demande de contact.",
  already_matched: "Vous avez déjà un Match avec ce membre : écrivez-lui dans vos messages.",
  message_too_long: `Le message est limité à ${CONTACT_MESSAGE_MAX_LENGTH} caractères.`,
  phone_number_detected:
    "Pour votre sécurité, les numéros de téléphone ne sont pas autorisés dans les demandes de contact.",
} as const;

export type SendContactRequestResult = { id: string; status: "sent" | "already_pending" };

/** Envoie une demande de contact (contrôles complets côté serveur). */
export async function sendContactRequest(
  receiverId: string,
  message: string,
): Promise<SendContactRequestResult> {
  const text = message.trim();
  const { data, error } = await supabase.rpc("send_contact_request", {
    _receiver_id: receiverId,
    ...(text ? { _message: text } : {}),
  });
  if (error) throw error;
  return data as SendContactRequestResult;
}

/** Message à afficher pour un refus du serveur. */
export function contactRequestErrorMessage(error: unknown): string {
  const message = error instanceof Object && "message" in error ? String(error.message) : "";
  for (const [code, text] of Object.entries(CONTACT_REQUEST_ERRORS)) {
    if (message.includes(code)) return text;
  }
  return "La demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.";
}

/** Refus pour numéro de téléphone (le message reste affiché sous le champ). */
export function isContactPhoneError(error: unknown): boolean {
  return (
    error instanceof Object &&
    "message" in error &&
    String(error.message).includes("phone_number_detected")
  );
}
