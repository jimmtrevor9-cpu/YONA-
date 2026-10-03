/** Libellés de la localisation pour l'administration (tâche E). */
export const SOURCE_LABEL: Record<string, string> = {
  device: "Appareil (GPS)",
  declared: "Ville déclarée",
  ip: "Adresse IP",
};

const regions = (() => {
  try {
    return new Intl.DisplayNames(["fr"], { type: "region" });
  } catch {
    return null;
  }
})();

export function countryLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return /^[A-Z]{2}$/.test(code) ? (regions?.of(code) ?? code) : code;
}

/** « ip_country:FR » → « Adresse IP en France » (VPN possible). */
export function reasonLabel(reason: string): string {
  const [kind, ...rest] = reason.split(":");
  const value = rest.join(":");
  switch (kind) {
    case "ip_country":
      return `Adresse IP en ${countryLabel(value)}`;
    case "timezone":
      return `Fuseau horaire ${value}`;
    case "declared_country":
      return `Pays affiché sur le profil : ${value}`;
    default:
      return reason;
  }
}
