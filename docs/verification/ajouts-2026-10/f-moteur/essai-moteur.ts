// Tâche F — Essai du VRAI moteur de visages (code serveur empaqueté comme en ligne), sur des
// portraits générés par IA (profils de démonstration) et une fausse carte « spécimen ».
// Usage : voir f-moteur/LISEZ-MOI.md
import { readFileSync } from "node:fs";
import { createLocalProvider } from "@/features/verification/engine/local.server";
import { decideVerification } from "@/features/verification/decide";
const p = createLocalProvider();
const F = "/var/tmp/yona-e2e/faces/";
const t0 = Date.now();
const a = async (n: string) => p.analyze(new Uint8Array(readFileSync(F + n)), { minSharpness: 15 });
const front = await a("demo-ga-01.jpg");
console.log(
  "chargement + 1re analyse",
  Date.now() - t0,
  "ms",
  front.faces.map((f) => ({
    yaw: f.yaw.toFixed(3),
    sharp: f.sharpness.toFixed(1),
    score: f.score.toFixed(2),
  })),
);
const variant = await a("demo-ga-01-b.jpg");
const left = await a("demo-ga-01-turn-left.jpg");
const right = await a("demo-ga-01-turn-right.jpg");
const other = await a("demo-fr-01.jpg");
const two = await a("demo-cm-01.jpg");
console.log(
  "même personne",
  await p.similarity(front, variant),
  "autre",
  await p.similarity(front, other),
  "deux visages",
  two.faces.length,
);
const t = { accept: 0.55, reject: 0.4, livenessMinShift: 0.03 };
for (const [label, ch, turned, prof] of [
  ["ok gauche", "turn_left", left, [variant]],
  ["mauvais côté", "turn_right", left, [variant]],
  ["autre personne", "turn_left", left, [other]],
  ["pas tourné", "turn_left", variant, [variant]],
] as const) {
  const d = await decideVerification(
    p,
    {
      challenge: ch,
      selfie: front,
      challengeImage: turned,
      document: null,
      profilePhotos: [...prof],
    },
    t,
  );
  console.log(
    label,
    d.status,
    d.reason,
    d.profileSimilarity?.toFixed(3),
    d.livenessShift?.toFixed(3),
  );
}
const card = await a("carte-ga-01.jpg");
const otherCard = await a("carte-fr-01.jpg");
console.log(
  "carte : visages",
  card.faces.length,
  "ressemblance selfie↔carte",
  (await p.similarity(front, card))?.toFixed(3),
  "autre carte",
  (await p.similarity(front, otherCard))?.toFixed(3),
);
for (const [label, doc] of [
  ["selfie + bonne pièce", card],
  ["selfie + pièce d'une autre personne", otherCard],
] as const) {
  const d = await decideVerification(
    p,
    {
      challenge: "turn_left",
      selfie: front,
      challengeImage: left,
      document: doc,
      profilePhotos: [variant],
    },
    t,
  );
  console.log(label, d.status, d.reason, d.documentSimilarity?.toFixed(3));
}
const docOnly = await decideVerification(
  p,
  { challenge: null, selfie: null, challengeImage: null, document: card, profilePhotos: [variant] },
  t,
);
console.log("pièce seule", docOnly.status, docOnly.reason, docOnly.profileSimilarity?.toFixed(3));
const noFace = await a("../img/pub-test.jpg");
const d0 = await decideVerification(
  p,
  {
    challenge: "turn_left",
    selfie: noFace,
    challengeImage: left,
    document: null,
    profilePhotos: [variant],
  },
  t,
);
console.log("selfie sans visage", d0.status, d0.reason);
const twoFaces = await a("demo-cm-01.jpg");
console.log("photo à deux personnes : visages comptés", twoFaces.faces.length);
console.log("total", Date.now() - t0, "ms");
