// YONA — Phase 6 / Étape 6.5 — Vérification de la détection des numéros avec parenthèses.
// Usage : node docs/verification/phase-6/etape-6.5-parentheses.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const avecParentheses = [
  "(06) 12 34 56 78",
  "(06)12345678",
  "(+237) 699 88 77 66",
  "(+237)699887766",
  "( +237 ) 699-88-77-66",
  "+33 (0)6 12 34 56 78",
  "+33(0)612345678",
  "(0033) 6 12 34 56 78",
  "(237) 699 887 766",
  "[237] 699887766",
  "{06}12345678",
  "（06）12 34 56 78",
  "［+237］699 88 77 66",
  "(06)-12-34-56-78",
  "Mon numéro (WhatsApp) : (06) 12 34 56 78",
  "(6) (99) (88) (77) (66)",
];
const sansNumero = [
  "Je suis Grace (34 ans) et j'aime chanter.",
  "Lisez Jean 3:16 (c'est mon verset préféré)",
  "J'ai deux enfants (5 et 7 ans)",
  "Rendez-vous (samedi) à 14h30",
  "Le prix (1 500 000 FCFA) est discuté",
  "Mariage prévu (12-10-2026)",
  "(+3) pour moi",
  "Taille (1m75)",
  "Chapitre (3) verset (16)",
];
runVectors(check, "Numéros avec parenthèses", avecParentheses, sansNumero);

// Non-régression 6.1 à 6.4.
runVectors(
  check,
  "Exemples des étapes 6.1 à 6.4",
  ["0612345678", "+237699887766", "06 12 34 56 78", "06-12-34-56-78", "06–12–34–56–78"],
  ["J'ai 34 ans.", "La dot est de 1 500 000 FCFA", "On se marie le 12-10-2026", "Luc 15:11-32"],
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
