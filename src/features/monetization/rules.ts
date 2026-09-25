/**
 * Règles métier de monétisation — source de vérité côté application.
 * Les montants réels sont TOUJOURS revalidés côté serveur avant tout enregistrement de paiement.
 *
 * Phase 2 : les nouveaux produits actifs sont facturés en USD.
 * Les montants sont exprimés en cents (plus petite unité) pour rester entiers en base.
 * L'historique en FCFA reste consultable et n'est pas modifié.
 */
export const CURRENCY = "USD" as const;
export const CURRENCY_LABEL = "USD";

/** Ancienne devise historique (Phase 1) — conservée pour l'affichage des données passées. */
export const LEGACY_CURRENCY = "XAF" as const;
export const LEGACY_CURRENCY_LABEL = "FCFA";

/** 3 messages gratuits PAR PARTICIPANT et PAR CONVERSATION. */
export const FREE_MESSAGES_PER_CONVERSATION = 3;

/** Roi Salomon : 3 questions par jour en gratuit, illimité en Premium. */
export const FREE_AI_QUESTIONS_PER_DAY = 3;

/** Limites de photos. */
export const FREE_MAX_PHOTOS = 3;
export const PREMIUM_MAX_PHOTOS = 10;

export const CONVERSATION_UNLOCK = {
  amount: 100, // 1 USD
  amountUsd: 1,
  currency: CURRENCY,
  durationDays: 3,
} as const;

export const PREMIUM_MONTHLY = {
  plan: "premium_monthly" as const,
  amount: 500, // 5 USD
  amountUsd: 5,
  currency: CURRENCY,
  durationDays: 30,
} as const;

export const PREMIUM_YEARLY = {
  plan: "premium_yearly" as const,
  amount: 3500, // 35 USD
  amountUsd: 35,
  currency: CURRENCY,
  durationDays: 365,
} as const;

/** Formate un montant exprimé en cents USD. */
export function formatUsd(amountInCents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD" }).format(
    amountInCents / 100,
  );
}

/** Conservé pour l'affichage des montants historiques en FCFA. */
export function formatFcfa(amount: number): string {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} ${LEGACY_CURRENCY_LABEL}`;
}
