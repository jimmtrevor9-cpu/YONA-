/** Longueur maximale d'un message (même limite que la base : 1 à 4 000 caractères). */
export const MESSAGE_MAX_LENGTH = 4000;

/** Le compteur de caractères s'affiche à partir de cette longueur. */
export const MESSAGE_COUNTER_FROM = 3500;

/** Texte réellement envoyable : espaces et retours à la ligne en début et fin retirés. */
export function normalizeMessage(text: string): string {
  return text.trim();
}

/** Un message est envoyable s'il contient au moins un caractère visible et respecte la limite. */
export function isMessageSendable(text: string): boolean {
  const value = normalizeMessage(text);
  return value.length > 0 && value.length <= MESSAGE_MAX_LENGTH;
}

// Brouillon conservé pour l'onglet en cours (sessionStorage : effacé à la fermeture de
// l'onglet, jamais partagé avec un autre appareil ni envoyé au serveur).
const draftKey = (userId: string, conversationId: string) =>
  `yona:brouillon:${userId}:${conversationId}`;

export function readDraft(userId: string, conversationId: string): string {
  try {
    return (sessionStorage.getItem(draftKey(userId, conversationId)) ?? "").slice(
      0,
      MESSAGE_MAX_LENGTH,
    );
  } catch {
    return "";
  }
}

export function saveDraft(userId: string, conversationId: string, text: string): void {
  try {
    if (text) sessionStorage.setItem(draftKey(userId, conversationId), text);
    else sessionStorage.removeItem(draftKey(userId, conversationId));
  } catch {
    // Stockage indisponible (navigation privée, stockage plein) : le brouillon n'est pas conservé.
  }
}
