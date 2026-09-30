// YONA — Phase 6 / Étape 6.6 — Vérification de la détection des formes obfusquées.
// Usage : node docs/verification/phase-6/etape-6.6-formes-obfusquees.mjs
import { notCallableByApi, runVectors, sql } from "../outils/detection-telephone.mjs";

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

runVectors(
  check,
  "Séparateurs variés",
  [
    "06.12.34.56.78",
    "06/12/34/56/78",
    "06_12_34_56_78",
    "06,12,34,56,78",
    "06:12:34:56:78",
    "06*12*34*56*78",
    "06#12#34#56#78",
    "06|12|34|56|78",
    "06 . 12 . 34 . 56 . 78",
    "0.6.1.2.3.4.5.6.7.8",
    "06📞12📞34📞56📞78",
    "06 ☎️ 12 34 56 78",
    "06 point 12 point 34 point 56 point 78",
    "06 tiret 12 tiret 34 tiret 56 tiret 78",
    "+237.699.88.77.66",
    "6•99•88•77•66",
  ],
  [
    "On se marie le 12/10/2026",
    "Né le 03.05.1990",
    "Rendez-vous à 14:30",
    "Culte de 9h30-12h00",
    "De 14:30 à 16:30",
    "La dot : 1.500.000 FCFA",
    "Prix : 2,500,000 $",
    "Genèse 1:1-3",
    "Jean 3:16, verset clé",
    "Score 3-1, 2-0, 4-2",
    "Rue 12, porte 45, 3e étage",
    "Je te réponds à 20h15, promis !",
  ],
);

runVectors(
  check,
  "Chiffres spéciaux",
  [
    "０６１２３４５６７８",
    "⁰⁶¹²³⁴⁵⁶⁷⁸",
    "₀₆₁₂₃₄₅₆₇₈",
    "⓪⑥①②③④⑤⑥⑦⑧",
    "❻❾❾❽❽❼❼❻❻",
    "𝟎𝟔𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖",
    "𝟘𝟞𝟙𝟚𝟛𝟜𝟝𝟞𝟟𝟠",
    "𝟶𝟼𝟷𝟸𝟹𝟺𝟻𝟼𝟽𝟾",
    "٠٦١٢٣٤٥٦٧٨",
    "0️⃣6️⃣1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣8️⃣",
    "06​12​34​56​78",
  ],
  ["J'ai ⑤ enfants", "Numéro ① de ma liste", "Chambre ０３"],
);

runVectors(
  check,
  "Chiffres en lettres",
  [
    "zéro six douze trente-quatre cinquante-six soixante-dix-huit",
    "zero six, douze, trente quatre, cinquante six, soixante dix huit",
    "ZÉRO SIX DOUZE TRENTE-QUATRE CINQUANTE-SIX SOIXANTE-DIX-HUIT",
    "six quatre-vingt-dix-neuf quatre-vingt-huit soixante-dix-sept soixante-six",
    "zéro sept zéro sept zéro sept zéro sept zéro sept",
    "zero six one two three four five six seven eight",
    "six nine nine eight eight seven seven six six",
    "zéro 6 12 trente-quatre 56 78",
    "0 six 1 deux 3 quatre 5 six 7 huit",
    "zéro six point douze point trente-quatre point cinquante-six point soixante-dix-huit",
    "six quatre-vingt-dix-neuf quatre-vingt-huit soixante-dix-sept soixante et onze",
  ],
  [
    "J'ai trente-quatre ans et deux enfants.",
    "Nous serons vingt et un au mariage.",
    "Rendez-vous à six heures, le douze.",
    "Un, deux, trois, nous irons au bois.",
    "Soixante-dix fois sept fois (Matthieu 18:22)",
    "Il est six heures et quart",
    "One day, I will be there for you",
    "Je suis né en mille neuf cent quatre-vingt-dix",
  ],
);

runVectors(
  check,
  "Lettres à la place des chiffres",
  [
    "O6 12 34 56 78",
    "06 l2 34 56 78",
    "o6.I2.34.56.78",
    "0 6 1 2 3 4 5 6 7 8o",
    "06 12 3o 56 78",
    "O6|2 34 56 78",
  ],
  ["Hello 2 you", "Il a 10 ans, lol", "Oui 12 fois"],
);

// Non-régression 6.1 à 6.5.
runVectors(
  check,
  "Exemples des étapes 6.1 à 6.5",
  [
    "0612345678",
    "+237699887766",
    "06 12 34 56 78",
    "06-12-34-56-78",
    "(06) 12 34 56 78",
    "+33 (0)6 12 34 56 78",
  ],
  [
    "J'ai 34 ans.",
    "On est +3 à venir",
    "La dot est de 1 500 000 FCFA",
    "On se marie le 12-10-2026",
    "Luc 15:11-32",
    "Je suis Grace (34 ans)",
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
const long = "Bonjour ".repeat(500);
const t0 = Date.now();
sql(`select public.contains_phone_number('${long}')`);
check(
  "Message long (4 000 caractères) analysé rapidement",
  Date.now() - t0 < 2000,
  `${Date.now() - t0} ms`,
);

const t1 = Date.now();
const worst = sql(
  "select public.contains_phone_number(repeat('1 o 2 . ', 500))::text || public.contains_phone_number(repeat('a1 ', 1300))::text",
);
check(
  "Pire cas (4 000 caractères de chiffres et séparateurs) : analysé rapidement",
  worst === "truefalse" && Date.now() - t1 < 3000,
  `${Date.now() - t1} ms`,
);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} vérifications réussies`);
process.exit(ok === results.length ? 0 : 1);
