/**
 * Prestataire de paiement utilisé par le serveur.
 *
 * Le prestataire est choisi par la variable d'environnement serveur `PAYMENT_PROVIDER`
 * (jamais par le navigateur). Tant qu'aucun prestataire réel n'est configuré, le paiement
 * en ligne est indisponible et l'application l'indique honnêtement.
 *
 * `test` : prestataire de TEST, pour les environnements de développement et de
 * vérification uniquement — aucun argent n'est encaissé. Il n'est actif que si le
 * serveur le demande explicitement (`PAYMENT_PROVIDER=test`), jamais par défaut.
 */
export type PaymentProviderId = "test";

export interface PaymentAvailability {
  available: boolean;
  provider: PaymentProviderId | null;
  /** Vrai en mode test : aucun paiement réel. */
  testMode: boolean;
}

/** À appeler côté serveur uniquement (lit l'environnement du serveur). */
export function readPaymentAvailability(
  env: Record<string, string | undefined>,
): PaymentAvailability {
  const provider = (env["PAYMENT_PROVIDER"] ?? "").trim().toLowerCase();
  if (provider === "test") return { available: true, provider: "test", testMode: true };
  return { available: false, provider: null, testMode: false };
}
