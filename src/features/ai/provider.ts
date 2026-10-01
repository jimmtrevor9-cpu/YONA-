/**
 * Fournisseur d'IA utilisé par le serveur (Roi Salomon, Ice Breaker personnalisé).
 *
 * Choisi uniquement par les variables d'environnement du serveur, jamais par le navigateur :
 * - `ANTHROPIC_API_KEY` renseignée → Claude (Anthropic). La clé reste sur le serveur.
 * - `AI_PROVIDER=test` → fournisseur de TEST (réponses fixes, sans appel externe), pour les
 *   environnements de vérification uniquement.
 * - sinon → IA indisponible : l'application l'indique et aucune question n'est décomptée.
 */
export type AiProviderId = "anthropic" | "test";

export interface AiAvailability {
  available: boolean;
  provider: AiProviderId | null;
}

/** À appeler côté serveur uniquement (lit l'environnement du serveur). */
export function readAiAvailability(env: Record<string, string | undefined>): AiAvailability {
  const forced = (env["AI_PROVIDER"] ?? "").trim().toLowerCase();
  if (forced === "test") return { available: true, provider: "test" };
  if ((env["ANTHROPIC_API_KEY"] ?? "").trim()) return { available: true, provider: "anthropic" };
  return { available: false, provider: null };
}

/** Modèle Claude utilisé (modifiable par `AI_MODEL` sur le serveur). */
export function readAiModel(env: Record<string, string | undefined>): string {
  return (env["AI_MODEL"] ?? "").trim() || "claude-opus-5-5";
}
