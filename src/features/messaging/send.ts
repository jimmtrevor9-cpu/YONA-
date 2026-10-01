/**
 * Messages affichés quand un envoi est refusé. Les codes viennent de la fonction serveur
 * `send_message` (base de données) ; tout autre problème (réseau, serveur) reçoit un
 * message générique.
 */
export const SEND_MESSAGE_ERRORS = {
  not_authenticated: "Votre session a expiré. Reconnectez-vous pour envoyer un message.",
  message_empty: "Écrivez un message avant de l'envoyer.",
  message_too_long: "Votre message dépasse 4 000 caractères.",
  conversation_unavailable: "Cette conversation n'est plus disponible.",
  free_limit_reached:
    "Vous avez utilisé vos 3 messages gratuits dans cette conversation. Votre message n'a pas été envoyé.",
  phone_number_detected:
    "Votre message n'a pas été envoyé : il semble contenir un numéro de téléphone. Pour la sécurité de tous, l'échange de numéros n'est pas autorisé sur YONA. Retirez le numéro puis renvoyez votre message (il n'a pas été décompté de vos messages gratuits).",
  sender_not_allowed: "Votre profil doit être finalisé et actif pour envoyer des messages.",
} as const;

export type SendMessageErrorCode = keyof typeof SEND_MESSAGE_ERRORS;

const GENERIC = "Le message n'a pas pu être envoyé. Vérifiez votre connexion et réessayez.";

const KNOWN_MESSAGES = new Set<string>(Object.values(SEND_MESSAGE_ERRORS));

/** Code d'erreur `send_message` contenu dans un message d'erreur de la base, s'il y en a un. */
export function sendErrorCode(message: string | undefined): SendMessageErrorCode | null {
  if (!message) return null;
  const code = (Object.keys(SEND_MESSAGE_ERRORS) as SendMessageErrorCode[]).find((key) =>
    message.includes(key),
  );
  return code ?? null;
}

/** Message à afficher pour une erreur d'envoi. */
export function sendMessageErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : undefined;
  if (message && KNOWN_MESSAGES.has(message)) return message;
  if (message && /unauthorized/i.test(message)) return SEND_MESSAGE_ERRORS.not_authenticated;
  const code = sendErrorCode(message);
  return code ? SEND_MESSAGE_ERRORS[code] : GENERIC;
}

/** La conversation n'est plus utilisable : la page doit se rafraîchir. */
export function isConversationGoneError(error: unknown): boolean {
  return error instanceof Error && error.message === SEND_MESSAGE_ERRORS.conversation_unavailable;
}

/** L'envoi a été refusé parce que le message contient un numéro de téléphone. */
export function isPhoneNumberError(error: unknown): boolean {
  return error instanceof Error && error.message === SEND_MESSAGE_ERRORS.phone_number_detected;
}
