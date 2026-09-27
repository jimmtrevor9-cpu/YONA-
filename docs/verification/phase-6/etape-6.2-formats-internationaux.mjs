// YONA — Phase 6 / Étape 6.2 — Vérification de la détection des formats internationaux.
// Usage : node docs/verification/phase-6/etape-6.2-formats-internationaux.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const internationaux = [
  "+33612345678",
  "Mon numéro : +237699887766",
  "+225070707070",
  "+221771234567",
  "+2411234567",
  "+2438123456",
  "+32470123456",
  "+41791234567",
  "+15551234567",
  "+447911123456",
  "0033612345678",
  "00237699887766",
  "Appelle +33612345678 ce soir",
  "＋33612345678",
  "⁺237699887766",
  "+1234567",
];
const sansNumero = [
  "On est +3 à venir au culte",
  "+10 pour cette idée !",
  "Score : +123456",
  "Il fait +25 degrés",
  "Luc 15:11-32",
  "2 + 2 = 4",
  "J'ai +300 abonnés",
  "Bonjour, je suis à Douala +237 pour le moment",
];
runVectors(check, "Formats internationaux", internationaux, sansNumero);

// Non-régression de 6.1 (mêmes exemples).
runVectors(
  check,
  "Numéros classiques (6.1)",
  ["0612345678", "699887766", "0707070707", "06123456"],
  ["J'ai 34 ans et 2 enfants.", "Je suis né en 1990.", "1234567", "Jean 3:16"],
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
