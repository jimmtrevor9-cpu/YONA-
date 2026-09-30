// YONA — Phase 6 / Étape 6.4 — Vérification de la détection des numéros avec tirets.
// Usage : node docs/verification/phase-6/etape-6.4-tirets.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const avecTirets = [
  "06-12-34-56-78",
  "Mon numéro : 06-12-34-56-78",
  "699-887-766",
  "6-99-88-77-66",
  "+237-699-88-77-66",
  "+33-6-12-34-56-78",
  "0033-6-12-34-56-78",
  "06 - 12 - 34 - 56 - 78",
  "06 -12- 34 -56- 78",
  "06--12--34--56--78",
  "0-6-1-2-3-4-5-6-7-8",
  "06–12–34–56–78",
  "06—12—34—56—78",
  "06‐12‐34‐56‐78",
  "06‑12‑34‑56‑78",
  "06−12−34−56−78",
  "06－12－34－56－78",
  "+ 237 - 699 887 766",
];
const sansNumero = [
  "Luc 15:11-32",
  "1 Corinthiens 13:4-7",
  "On se marie le 12-10-2026",
  "Date : 2026-10-12",
  "L'année 2025-2026 a été bénie",
  "De 1990 - 2026, que de grâces !",
  "Un jeune homme de 25-30 ans",
  "Le culte est de 10h-12h",
  "Ma fille a entre 3-4 ans",
  "Réunion le 5–6 juin",
  "Prix : 15-20 euros",
  "Chambre 12-B au 3e étage",
];
runVectors(check, "Numéros avec tirets", avecTirets, sansNumero);

// Non-régression 6.1 à 6.3.
runVectors(
  check,
  "Exemples des étapes 6.1 à 6.3",
  ["0612345678", "+237699887766", "06 12 34 56 78", "699 887 766", "+237 699 88 77 66"],
  [
    "J'ai 34 ans.",
    "On est +3 à venir",
    "La dot est de 1 500 000 FCFA",
    "On se marie le 12 10 2026",
  ],
);
const r = await notCallableByApi();
check(
  "Toujours réservée au serveur",
  [401, 403, 404].includes(r.status) &&
    sql(
      "select has_function_privilege('authenticated','public.contains_phone_number(text)','execute')",
    ) === "f",
  String(r.status),
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
