import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { MESSAGE_MAX_LENGTH, normalizeMessage } from "./composer";
import { SEND_MESSAGE_ERRORS, sendErrorCode } from "./send";

const sendMessageInput = z.object({
  // Forme canonique (minuscules) de l'identifiant de la conversation.
  conversationId: z
    .string()
    .uuid()
    .transform((value) => value.toLowerCase()),
  content: z.string().max(MESSAGE_MAX_LENGTH * 2),
});

/**
 * Enregistre un message de la personne connectée. Toutes les vérifications (participant,
 * conversation ouverte, Match actif, blocage, profils, longueur) sont refaites par la base
 * dans `send_message` ; l'auteur, le statut et la date sont fixés par le serveur.
 */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => sendMessageInput.parse(data))
  .handler(async ({ data, context }) => {
    const content = normalizeMessage(data.content);
    if (!content) throw new Error(SEND_MESSAGE_ERRORS.message_empty);
    if (content.length > MESSAGE_MAX_LENGTH) throw new Error(SEND_MESSAGE_ERRORS.message_too_long);

    const { data: rows, error } = await context.supabase.rpc("send_message", {
      _conversation_id: data.conversationId,
      _content: content,
    });

    if (error) {
      const code = sendErrorCode(error.message);
      if (code) throw new Error(SEND_MESSAGE_ERRORS[code]);
      throw error;
    }

    const message = rows?.[0];
    if (!message) throw new Error("Le message n'a pas pu être envoyé.");
    return {
      id: message.id,
      conversationId: message.conversation_id,
      content: message.content,
      createdAt: message.created_at,
    };
  });
