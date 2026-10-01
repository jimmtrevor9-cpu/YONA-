// YONA — Phase 6 / Étape 6.1 — Vérification de la détection des numéros classiques.
// Usage : node docs/verification/phase-6/etape-6.1-numeros-classiques.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

// Numéros nationaux écrits d'un seul bloc (France, Cameroun, Côte d'Ivoire, Sénégal,
// Gabon, RDC, Congo, Bénin, Togo, Burkina Faso, Mali, Madagascar, Belgique, Suisse…).
const classiques = [
  "0612345678",
  "Appelle-moi au 0612345678",
  "mon numéro 0712345678 merci",
  "699887766",
  "Écris-moi sur WhatsApp 677123456 !",
  "0707070707",
  "771234567",
  "06123456",
  "97123456",
  "812345678",
  "0470123456",
  "0791234567",
  "0341234567",
  "0612345678, c'est mon numéro",
  "numéro:0612345678.",
  "123456789012345",
];
const sansNumero = [
  "Bonjour Grace, comment vas-tu ?",
  "J'ai 34 ans et 2 enfants.",
  "Je suis né en 1990.",
  "Rendez-vous à 14h30 le 12 octobre.",
  "Le culte commence à 10h.",
  "Psaume 23, verset 1",
  "Jean 3:16",
  "Mon code postal est 75001",
  "La dot coûte 1500000 FCFA",
  "1234567",
  "Il y a 2026 ans…",
  "",
  "   ",
  "Je mesure 1m75 et je pèse 70 kg",
];
runVectors(check, "Numéros classiques", classiques, sansNumero);

check(
  "Valeur absente (NULL) : aucun numéro",
  sql("select public.contains_phone_number(null)") === "f",
);
check(
  "Détection identique à chaque appel (fonction déterministe)",
  sql("select provolatile from pg_proc where proname='contains_phone_number'") === "i",
);
const r = await notCallableByApi();
check(
  "Fonction non appelable par les membres ou visiteurs (détecteur interne au serveur)",
  [401, 403, 404].includes(r.status),
  String(r.status),
);
check(
  "Réservée au serveur : aucun droit d'exécution pour les membres",
  sql(
    "select has_function_privilege('authenticated','public.contains_phone_number(text)','execute')",
  ) === "f",
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
