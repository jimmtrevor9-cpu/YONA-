import { FREE_MESSAGES_PER_CONVERSATION } from "@/features/monetization/rules";

/**
 * Moteur de droits de messagerie — contrat central (Phase 1 : squelette pur, sans I/O).
 * L'implémentation serveur (Phase 2+) alimentera `MessagingContext` depuis la base
 * et appliquera cette décision AVANT tout enregistrement de message.
 */
export type SendDecision =
  | "ALLOW"
  | "DENY_NO_MATCH"
  | "DENY_BLOCKED"
  | "DENY_FREE_LIMIT"
  | "DENY_UNLOCK_EXPIRED"
  | "DENY_CONVERSATION_CLOSED";

export interface MessagingContext {
  matchActive: boolean;
  blockedBetween: boolean;
  conversationStatus: "open" | "locked" | "closed";
  senderIsPremium: boolean;
  receiverIsPremium: boolean;
  activeUnlockExpiresAt: Date | null;
  freeMessagesUsed: number;
  now: Date;
}

export function canSendMessage(ctx: MessagingContext): SendDecision {
  if (!ctx.matchActive) return "DENY_NO_MATCH";
  if (ctx.blockedBetween) return "DENY_BLOCKED";
  if (ctx.conversationStatus === "closed") return "DENY_CONVERSATION_CLOSED";

  // Phase 2 : Premium = messagerie 100 % illimitée pour l'expéditeur.
  if (ctx.senderIsPremium) return "ALLOW";

  if (ctx.activeUnlockExpiresAt) {
    if (ctx.activeUnlockExpiresAt.getTime() > ctx.now.getTime()) return "ALLOW";
    return ctx.freeMessagesUsed >= FREE_MESSAGES_PER_CONVERSATION
      ? "DENY_UNLOCK_EXPIRED"
      : "ALLOW";
  }

  if (ctx.freeMessagesUsed >= FREE_MESSAGES_PER_CONVERSATION) return "DENY_FREE_LIMIT";
  return "ALLOW";
}

export const SEND_DECISION_LABELS: Record<SendDecision, string> = {
  ALLOW: "Message autorisé",
  DENY_NO_MATCH: "Vous devez avoir un Match pour écrire à cette personne.",
  DENY_BLOCKED: "Cette conversation n'est plus disponible.",
  DENY_FREE_LIMIT: "Vos 3 messages gratuits sont utilisés. Débloquez la conversation pour continuer.",
  DENY_UNLOCK_EXPIRED: "Votre déblocage a expiré. Débloquez à nouveau pour continuer.",
  DENY_CONVERSATION_CLOSED: "Cette conversation est fermée.",
};
