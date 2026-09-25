/**
 * Pipeline de modération des messages — contrat (Phase 1).
 *
 * Ordre imposé côté serveur (Phase 2+) :
 *   authentification → droit de messagerie (canSendMessage) → analyse de sécurité
 *   → détection téléphone → détection spam → enregistrement → livraison.
 *
 * Le frontend peut pré-vérifier pour l'UX, mais le serveur reste l'autorité finale.
 */
export type ModerationVerdict =
  | { ok: true; normalized: string }
  | { ok: false; reason: "PHONE_NUMBER_DETECTED" | "EMPTY" | "TOO_LONG"; confidence: number };

export const MESSAGE_MAX_LENGTH = 4000;

/** Normalisation minimale : espaces, séparateurs homoglyphes courants. */
export function normalizeMessage(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Détecteur de numéros — version fondation.
 * La détection complète (obfuscations, formats internationaux étendus) sera construite en Phase 2.
 */
export function detectPhoneNumber(text: string): { detected: boolean; confidence: number } {
  const digitsOnly = text.replace(/[^\d+]/g, "");
  const longestRun = (digitsOnly.match(/\d+/g) ?? []).reduce((m, r) => Math.max(m, r.length), 0);
  if (longestRun >= 8) return { detected: true, confidence: 0.9 };
  return { detected: false, confidence: 0 };
}

export function moderateMessage(raw: string): ModerationVerdict {
  const normalized = normalizeMessage(raw);
  if (!normalized) return { ok: false, reason: "EMPTY", confidence: 1 };
  if (normalized.length > MESSAGE_MAX_LENGTH) return { ok: false, reason: "TOO_LONG", confidence: 1 };
  const phone = detectPhoneNumber(normalized);
  if (phone.detected) return { ok: false, reason: "PHONE_NUMBER_DETECTED", confidence: phone.confidence };
  return { ok: true, normalized };
}
