import type { Bucket } from "@/features/admin/dashboard";

/**
 * Couleurs et formats des graphiques du tableau de bord. Rose YONA pour une mesure ;
 * rose + violet pour deux catégories (paire vérifiée pour les daltoniens).
 */
export const CHART_ROSE = "#cd568b";
export const CHART_VIOLET = "#4a3aa7";

const MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** « 2026-10-03T14:00:00 » (heure locale renvoyée par la base) → date locale. */
function parseLocal(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}))?/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0));
}

export function bucketLabel(start: string, bucket: Bucket, long = false): string {
  const d = parseLocal(start);
  const day = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  switch (bucket) {
    case "hour":
      return long ? `${day}, ${d.getHours()} h` : `${d.getHours()} h`;
    case "day":
      return long ? `${day} ${d.getFullYear()}` : day;
    case "week":
      return long ? `Semaine du ${day} ${d.getFullYear()}` : day;
    case "month":
      return `${MONTHS[d.getMonth()]} ${long ? d.getFullYear() : String(d.getFullYear()).slice(2)}`;
    case "year":
      return String(d.getFullYear());
  }
}

const numberFormat = new Intl.NumberFormat("fr-FR");
export const formatNumber = (n: number) => numberFormat.format(n);
