// Appels au fournisseur d'IA — SERVEUR UNIQUEMENT (importé dynamiquement dans les
// gestionnaires des fonctions serveur, jamais par le navigateur).
import Anthropic from "@anthropic-ai/sdk";

import { readAiModel, type AiProviderId } from "./provider";

export interface AiTurn {
  role: "user" | "assistant";
  content: string;
}

export class AiProviderError extends Error {}

/**
 * Envoie une conversation au fournisseur et renvoie le texte de la réponse.
 * `test` renvoie une réponse fixe (aucun appel réseau).
 */
export async function generateText(options: {
  provider: AiProviderId;
  system: string;
  messages: AiTurn[];
  maxTokens?: number;
}): Promise<string> {
  const { provider, system, messages } = options;
  if (provider === "test") {
    const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
    return `Réponse de test de Roi Salomon. Vous avez demandé : « ${last.slice(0, 120)} ». Que la paix soit avec vous.`;
  }

  const client = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  try {
    const response = await client.beta.messages.create({
      model: readAiModel(process.env),
      max_tokens: options.maxTokens ?? 2000,
      // Conversation courte, réponse simple : effort bas (moins cher, plus rapide).
      output_config: { effort: "low" },
      // Si la demande est refusée par les garde-fous du modèle, l'API la relance
      // automatiquement sur un modèle de secours adapté.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
    });
    if (response.stop_reason === "refusal") {
      throw new AiProviderError("refusal");
    }
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    if (!text) throw new AiProviderError("empty_response");
    return text;
  } catch (error) {
    if (error instanceof AiProviderError) throw error;
    if (error instanceof Anthropic.APIError) {
      console.error(`[IA] Erreur du fournisseur (${error.status}) : ${error.message}`);
    } else {
      console.error("[IA] Erreur réseau du fournisseur", error);
    }
    throw new AiProviderError("provider_error");
  }
}
