// YONA — Phase 6 / Étape 6.3 — Vérification de la détection des numéros avec espaces.
// Usage : node docs/verification/phase-6/etape-6.3-espaces.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const avecEspaces = [
  "06 12 34 56 78",
  "Mon numéro : 06 12 34 56 78",
  "6 99 88 77 66",
  "699 887 766",
  "07 07 07 07 07",
  "77 123 45 67",
  "0 6 1 2 3 4 5 6 7 8",
  "06  12   34    56  78",
  "06\t12\t34\t56\t78",
  "06\n12\n34\n56\n78",
  "06 12 34 56 78",
  "06 12 34 56 78",
  "06 12 34 56 78",
  "+237 699 88 77 66",
  "+ 237 699 887 766",
  "+33 6 12 34 56 78",
  "00 33 6 12 34 56 78",
  "+241 1 23 45 67",
  "WhatsApp 6 7 7 1 2 3 4 5 6 stp",
];
const sansNumero = [
  "J'ai 34 ans et 2 enfants de 5 et 7 ans.",
  "La dot est de 1 500 000 FCFA",
  "Budget : 10 000 000 F pour le mariage",
  "Il gagne 2 500 000 francs CFA",
  "Le billet coûte 350 000 XAF",
  "Prix : € 25 000 000",
  "25 000 000 euros, c'est trop",
  "On se marie le 12 10 2026",
  "Rendez-vous samedi à 14 30",
  "Nous étions 120 personnes à l'église",
  "Chapitre 3 verset 16",
  "Je suis né en 1990 et j'ai 36 ans",
  "Taille 1 75 m, poids 70 kg",
];
runVectors(check, "Numéros avec espaces", avecEspaces, sansNumero);

// Non-régression 6.1 et 6.2.
runVectors(
  check,
  "Numéros classiques et internationaux (6.1, 6.2)",
  ["0612345678", "699887766", "+237699887766", "0033612345678", "＋33612345678"],
  ["J'ai 34 ans.", "1234567", "On est +3 à venir", "2 + 2 = 4", "Jean 3:16"],
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
