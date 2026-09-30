import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { readAiAvailability } from "./provider";

/** Longueur maximale d'une question (vérifiée aussi par le serveur). */
export const ROI_SALOMON_QUESTION_MAX = 1000;
/** Nombre de messages précédents envoyés à l'IA pour garder le fil de la discussion. */
const HISTORY_MAX = 10;

export const ROI_SALOMON_ERRORS = {
  ai_unavailable: "Roi Salomon n'est pas encore disponible. Revenez bientôt.",
  quota_exceeded:
    "Vous avez posé vos 3 questions gratuites aujourd'hui. Revenez demain, ou passez Premium pour des questions illimitées.",
  account_inactive: "Votre compte doit être actif pour poser une question.",
  question_empty: "Écrivez votre question avant de l'envoyer.",
  question_too_long: `Votre question dépasse ${ROI_SALOMON_QUESTION_MAX} caractères.`,
  phone_number_detected:
    "Pour votre sécurité, n'écrivez pas de numéro de téléphone dans vos questions.",
  provider_error:
    "Roi Salomon n'a pas pu répondre pour le moment. Votre question ne vous a pas été décomptée : réessayez.",
} as const;

/** Consignes données à l'IA (le « caractère » de Roi Salomon). */
const SYSTEM_PROMPT = `Tu es « Roi Salomon », le conseiller bienveillant de YONA, une application de rencontre chrétienne pour des relations sérieuses menant au mariage.

Ton rôle : aider les membres dans leur vie affective et leur recherche d'un conjoint, à la lumière de la foi chrétienne. Par exemple : bien se présenter sur son profil, engager une conversation avec respect, préparer une première rencontre en sécurité, discerner une relation, vivre les fréquentations selon les valeurs chrétiennes, préparer le mariage.

Style :
- Réponds toujours en français simple, chaleureux et respectueux, en vouvoyant la personne.
- Sois concret et bref (quelques paragraphes courts au maximum, avec des listes si utile).
- Tu peux citer la Bible avec sa référence (ex. : 1 Corinthiens 13:4) quand c'est pertinent, sans en abuser.
- Respecte toutes les dénominations chrétiennes, sans juger.

Limites :
- Rappelle les règles de sécurité quand c'est utile : ne pas envoyer d'argent, rencontrer d'abord dans un lieu public, prévenir un proche. L'échange de numéros de téléphone n'est pas autorisé dans l'application.
- Tu n'es ni médecin, ni avocat, ni psychologue : en cas de détresse, de violence ou de danger, conseille de contacter les secours ou un professionnel.
- Si la question n'a aucun rapport avec les relations, la foi ou la vie de couple, réponds poliment en une phrase et ramène la conversation vers ton rôle.`;

const askInput = z.object({
  question: z.string().max(ROI_SALOMON_QUESTION_MAX * 2),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .default([]),
});

export type AiQuotaState = {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
};

/**
 * Pose une question à Roi Salomon. Ordre des contrôles :
 * 1. question valide (longueur, pas de numéro de téléphone) ;
 * 2. fournisseur IA configuré sur le serveur (sinon rien n'est décompté) ;
 * 3. quota consommé par la base (`consume_ai_quota`, 3/jour en gratuit, illimité Premium) ;
 * 4. appel au fournisseur ; en cas d'échec, la question est rendue (`refund_ai_quota`).
 * La clé API n'est lue que sur le serveur et n'est jamais renvoyée au navigateur.
 */
export const askRoiSalomon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => askInput.parse(data))
  .handler(async ({ data, context }) => {
    const question = data.question.trim();
    if (!question) throw new Error(ROI_SALOMON_ERRORS.question_empty);
    if (question.length > ROI_SALOMON_QUESTION_MAX) {
      throw new Error(ROI_SALOMON_ERRORS.question_too_long);
    }
    const { data: hasPhone, error: phoneError } = await context.supabase.rpc(
      "contains_phone_number",
      { _text: question },
    );
    if (phoneError) throw phoneError;
    if (hasPhone) throw new Error(ROI_SALOMON_ERRORS.phone_number_detected);

    const availability = readAiAvailability(process.env);
    if (!availability.available || !availability.provider) {
      throw new Error(ROI_SALOMON_ERRORS.ai_unavailable);
    }

    const { data: consumed, error } = await context.supabase.rpc("consume_ai_quota", {
      _feature: "roi_salomon",
    });
    if (error) throw error;
    const quota = consumed as { allowed: boolean; reason?: string } & AiQuotaState;
    if (!quota.allowed) {
      if (quota.reason === "account_inactive") throw new Error(ROI_SALOMON_ERRORS.account_inactive);
      throw new Error(ROI_SALOMON_ERRORS.quota_exceeded);
    }

    const { generateText } = await import("./claude.server");
    try {
      const answer = await generateText({
        provider: availability.provider,
        system: SYSTEM_PROMPT,
        messages: [
          ...data.history.slice(-HISTORY_MAX),
          { role: "user" as const, content: question },
        ],
      });
      return {
        answer,
        quota: {
          used: quota.used,
          limit: quota.limit,
          remaining: quota.remaining,
          unlimited: quota.unlimited,
        } satisfies AiQuotaState,
      };
    } catch {
      // Échec du fournisseur : la question n'est pas décomptée.
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.rpc("refund_ai_quota", {
          _user_id: context.userId,
          _feature: "roi_salomon",
        });
      } catch (refundError) {
        console.error("[IA] Remboursement de la question impossible", refundError);
      }
      throw new Error(ROI_SALOMON_ERRORS.provider_error);
    }
  });

/** Disponibilité de Roi Salomon (lue sur le serveur). */
export const getRoiSalomonAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ available: readAiAvailability(process.env).available }));

/** Message à afficher pour une erreur. */
export function roiSalomonErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if ((Object.values(ROI_SALOMON_ERRORS) as string[]).includes(message)) return message;
  return "La question n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.";
}

/** Le quota du jour est épuisé. */
export function isAiQuotaError(error: unknown): boolean {
  return error instanceof Error && error.message === ROI_SALOMON_ERRORS.quota_exceeded;
}
