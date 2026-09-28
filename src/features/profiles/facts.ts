/**
 * Informations de situation du profil, avec les seules valeurs acceptées par la base
 * (contraintes sur la table `profiles`).
 */
export const MARITAL_STATUSES = ["never_married", "divorced", "widowed"] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  never_married: "Célibataire, jamais marié·e",
  divorced: "Divorcé·e",
  widowed: "Veuf / veuve",
};

export function isMaritalStatus(value: string | null | undefined): value is MaritalStatus {
  return (MARITAL_STATUSES as readonly string[]).includes(value ?? "");
}

/** Nombre d'enfants accepté par la base (seulement si le membre a des enfants). */
export const CHILDREN_COUNT_MAX = 20;
