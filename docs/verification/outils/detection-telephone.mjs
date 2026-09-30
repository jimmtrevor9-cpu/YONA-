// YONA — Outil commun des tests de la phase 6 : fait évaluer une liste de messages par la
// fonction serveur `contains_phone_number` et compare au résultat attendu.
import { execFileSync } from "node:child_process";

const DB = process.env.DB_CONTAINER ?? "supabase_db_yona-local";
const API = process.env.API ?? "http://127.0.0.1:54321";
const KEY = process.env.ANON_KEY ?? "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const sql = (q) =>
  execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-qAt"], { input: q })
    .toString()
    .trim();

const quote = (s) => `'${s.replace(/'/g, "''")}'`;

/** Résultat de la détection pour chaque texte (true = numéro détecté), dans l'ordre. */
export function detect(texts) {
  if (!texts.length) return [];
  const rows = texts.map((t, i) => `(${i}, ${quote(t)})`).join(",");
  const out = sql(
    `select string_agg(public.contains_phone_number(t)::text, ',' order by i) from (values ${rows}) v(i, t);`,
  );
  return out.split(",").map((x) => x === "true");
}

/**
 * Vérifie des listes de textes : `positives` doivent être détectés, `negatives` non.
 * Affiche chaque cas en échec ; renvoie { ok, total, failures }.
 */
export function runVectors(check, label, positives, negatives) {
  const pos = detect(positives);
  const neg = detect(negatives);
  const missed = positives.filter((_, i) => !pos[i]);
  const wrong = negatives.filter((_, i) => neg[i]);
  check(
    `${label} : ${positives.length} numéros détectés`,
    missed.length === 0,
    missed.length ? `non détectés : ${missed.map((m) => JSON.stringify(m)).join(" ; ")}` : "",
  );
  check(
    `${label} : ${negatives.length} messages sans numéro acceptés`,
    wrong.length === 0,
    wrong.length ? `détectés à tort : ${wrong.map((m) => JSON.stringify(m)).join(" ; ")}` : "",
  );
}

/** La fonction n'est pas appelable directement par un visiteur (API). */
export async function notCallableByApi() {
  const res = await fetch(`${API}/rest/v1/rpc/contains_phone_number`, {
    method: "POST",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ _text: "0612345678" }),
  });
  return { status: res.status, text: await res.text() };
}
