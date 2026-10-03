/**
 * Contexte d'une requête du navigateur (adresse IP, pays et ville d'après Vercel, appareil),
 * transmis à la base dans des en-têtes x-yona-* quand le serveur agit au nom d'un membre :
 * le journal (connexions, actions, paiements) garde ainsi l'appareil et le pays réels, et
 * non ceux du serveur. Informations indicatives (un VPN change l'IP et le pays).
 */
export function clientContextHeaders(request: Request | undefined): Record<string, string> {
  if (!request?.headers) return {};
  const h = request.headers;
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0]?.trim() ?? "";
  let city = h.get("x-vercel-ip-city") ?? "";
  try {
    city = decodeURIComponent(city);
  } catch {
    // Ville mal encodée : ignorée.
    city = "";
  }
  const headers: Record<string, string> = {};
  if (ip) headers["x-yona-ip"] = ip.slice(0, 64);
  const ua = h.get("user-agent");
  if (ua) headers["x-yona-ua"] = ua.slice(0, 400);
  const country = h.get("x-vercel-ip-country");
  if (country) headers["x-yona-country"] = country.slice(0, 8);
  if (city) headers["x-yona-city"] = encodeURIComponent(city.slice(0, 100));
  return headers;
}
